import { resolveAttributionCode } from "../../packages/core/hackathon.js";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  decodeEventLog,
  encodeFunctionData,
  hashTypedData,
  keccak256,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type Hex,
  parseTransaction,
} from "viem";
import {
  prepareAttributedTransaction,
  assertAttributedCalldata,
  verifyTx,
} from "../../packages/core/attribution.js";
import { Store } from "../../packages/core/storage.js";
import { clients, artifacts, manifest } from "../../packages/core/chain.js";
import {
  domain,
  intentTypes,
  parseIntent,
  quote,
  validateSnapshot,
  type Snapshot,
} from "../../packages/core/domain.js";
export async function tick(store: Store, stopAfterJournal = false) {
  const owner = randomUUID();
  if (!store.lease(owner)) return;
  store.db
    .prepare(
      "INSERT INTO metadata VALUES('workerHeartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(Date.now().toString());
  const c = clients(),
    m = manifest(),
    a = artifacts();
  const heartbeat = setInterval(() => store.lease(owner), 10000);
  try {
    if ((await c.publicClient.getChainId()) !== m.chainId)
      throw new Error("CHAIN_MISMATCH");
    // First reconcile durable bytes. Never allocate a new nonce while any prior attempt is unresolved.
    for (const attempt of store.attempts()) {
      const o = store.get(attempt.obligation)!;
      if (o.state === "FAILED") continue;
      if (o.state === "RECONCILED") {
        const previous = JSON.parse(o.receipt!);
        const head = await c.publicClient.getBlock();
        if (head.number >= BigInt(previous.blockNumber)) {
          const canonical = await c.publicClient.getBlock({
            blockNumber: BigInt(previous.blockNumber),
          });
          if (canonical.hash === previous.blockHash) continue;
        }
        store.invalidateReceipt(o.id);
      }
      let receipt;
      try {
        receipt = await c.publicClient.getTransactionReceipt({
          hash: attempt.hash as Hex,
        });
      } catch (error) {
        if (!(error instanceof TransactionReceiptNotFoundError)) return;
      }
      if (!receipt) {
        let known = false;
        try {
          await c.publicClient.getTransaction({ hash: attempt.hash as Hex });
          known = true;
        } catch (error) {
          if (!(error instanceof TransactionNotFoundError)) return;
        }
        if (!known) {
          // Never rewrite/re-tag a durable signed payload or backfill history.
          try {
            assertAttributedCalldata(
              parseTransaction(attempt.raw as Hex).data ?? "0x",
              resolveAttributionCode(),
            );
          } catch {
            store.db
              .prepare(
                "UPDATE obligations SET reason='ATTRIBUTION_MISSING_OR_MISMATCH' WHERE id=?",
              )
              .run(o.id);
            return;
          }
          try {
            await c.publicClient.sendRawTransaction({
              serializedTransaction: attempt.raw as Hex,
            });
          } catch (e) {
            store.audit({
              id: o.id,
              reason: "RPC_UNCERTAIN",
              errorClass: (e as Error).name,
            });
          }
        }
        if (o.state === "PREPARED")
          store.transition(o.id, "PREPARED", "SUBMITTED");
        return;
      }
      if (o.state === "PREPARED")
        store.transition(o.id, "PREPARED", "SUBMITTED");
      if (receipt.status !== "success") {
        const paid = await c.publicClient.readContract({
          address: m.vault,
          abi: a.TreasuryVault.abi,
          functionName: "isPaid",
          args: [o.id],
        });
        if (paid) {
          store.db
            .prepare(
              "UPDATE obligations SET reason='CHAIN_RECEIPT_INCONSISTENT' WHERE id=?",
            )
            .run(o.id);
          return;
        }
        store.transition(o.id, "SUBMITTED", "FAILED", "CHAIN_REVERT");
        continue;
      }
      const canonical = await c.publicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });
      if (canonical.hash !== receipt.blockHash) return;
      const expected = parseIntent(JSON.parse(o.intent));
      let payment: any;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== m.vault.toLowerCase()) continue;
        try {
          const decoded: any = decodeEventLog({
            abi: a.TreasuryVault.abi,
            data: log.data,
            topics: log.topics,
          });
          if (
            decoded.eventName === "Payment" &&
            (decoded.args as any).obligationId === o.id
          )
            payment = decoded.args;
        } catch {}
      }
      if (
        !payment ||
        payment.token.toLowerCase() !==
          expected.settlementToken.toLowerCase() ||
        payment.recipient.toLowerCase() !== expected.recipient.toLowerCase() ||
        payment.amountLukasWad !== expected.amountLukasWad
      )
        throw new Error("RECEIPT_EVENT_MISMATCH");
      const roundValues = (await c.publicClient.readContract({
        address: m.oracle,
        abi: a.FixtureOracle.abi,
        functionName: "rounds",
        args: [payment.round],
      })) as [bigint, bigint, bigint, Hex];
      if (
        payment.intentHash !==
          hashTypedData({
            domain: domain(31337, m.vault),
            types: intentTypes,
            primaryType: "Intent",
            message: expected,
          }) ||
        payment.amount !==
          quote(
            expected.amountLukasWad,
            roundValues[0],
            roundValues[1],
            m.decimals,
          )
      )
        throw new Error("RECEIPT_AMOUNT_OR_HASH");
      const decodedAttribution = await verifyTx({
        client: c.publicClient,
        hash: receipt.transactionHash,
      });
      store.receipt(o.id, {
        mode: "Simulation",
        chainId: 31337,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        vault: m.vault,
        recipient: payment.recipient,
        token: payment.token,
        symbol: "SIMCOP",
        decimals: m.decimals,
        actualSettlementAtomic: payment.amount,
        amountLukasWad: payment.amountLukasWad,
        oracleRound: payment.round,
        intentHash: payment.intentHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        attribution: decodedAttribution ?? "LOCAL_UNTAGGED_NOT_ELIGIBLE",
        finality: "local-single-node",
      });
    }
    const block = await c.publicClient.getBlock();
    const now = Number(block.timestamp);
    for (const o of store.list()) {
      if (!["SCHEDULED", "BLOCKED", "EVALUATING", "PREPARED"].includes(o.state))
        continue;
      const intent = parseIntent(JSON.parse(o.intent));
      if (intent.validAfter > BigInt(now)) continue;
      // A crash during evaluation is safe to retry; PREPARED with no journal has never broadcast.
      if (o.state === "PREPARED") {
        store.transition(o.id, "PREPARED", "BLOCKED", "RECOVER_PRE_SIGN");
        continue;
      }
      if (o.state !== "EVALUATING")
        store.transition(o.id, o.state, "EVALUATING");
      try {
        if (intent.deadline < BigInt(now)) {
          store.transition(
            o.id,
            "EVALUATING",
            "EXPIRED",
            "EXPIRED_AUTHORIZATION",
          );
          continue;
        }
        const snapshot: Snapshot = JSON.parse(
          fs.readFileSync(".local/snapshot.json", "utf8"),
        );
        validateSnapshot(snapshot, now);
        const round = (await c.publicClient.readContract({
          address: m.oracle,
          abi: a.FixtureOracle.abi,
          functionName: "latest",
          args: [],
        })) as bigint;
        const onchain = (await c.publicClient.readContract({
          address: m.oracle,
          abi: a.FixtureOracle.abi,
          functionName: "rounds",
          args: [round],
        })) as [bigint, bigint, bigint, Hex];
        if (
          onchain[0] !== BigInt(snapshot.indexUsdWad) ||
          onchain[2] !== BigInt(snapshot.oldestComponentUpdatedAt) ||
          onchain[3] !== snapshot.methodologyHash
        )
          throw new Error("SNAPSHOT_CHAIN_MISMATCH");
        const amount = quote(
          intent.amountLukasWad,
          onchain[0],
          onchain[1],
          m.decimals,
        );
        if (amount > intent.maxSettlementAtomic)
          throw new Error("MAX_SETTLEMENT_EXCEEDED");
        await c.publicClient.simulateContract({
          address: m.vault,
          abi: a.TreasuryVault.abi,
          functionName: "executePayment",
          args: [intent, o.signature, round],
          account: c.executor.account,
        });
        const businessData = encodeFunctionData({
          abi: a.TreasuryVault.abi,
          functionName: "executePayment",
          args: [intent, o.signature, round],
        });
        const data = prepareAttributedTransaction(
          businessData,
          resolveAttributionCode(),
        );
        await c.publicClient.call({
          account: c.executor.account.address,
          to: m.vault,
          data,
        });
        const request = await c.executor.prepareTransactionRequest({
          account: c.executor.account,
          to: m.vault,
          data,
          chain: c.executor.chain,
        });
        // Local budget only. Remote economic/gas budgets must be operator reviewed.
        if (
          (request.gas ?? 0n) *
            (request.maxFeePerGas ?? request.gasPrice ?? 0n) >
          10n ** 16n
        )
          throw new Error("GAS_CAP");
        if (!store.lease(owner)) throw new Error("LEASE_LOST");
        store.transition(o.id, "EVALUATING", "PREPARED");
        const raw = await c.executor.signTransaction(request);
        const hash = keccak256(raw);
        store.attempt(o.id, hash, raw, request.nonce!);
        if (stopAfterJournal) return;
        try {
          await c.publicClient.sendRawTransaction({
            serializedTransaction: raw,
          });
        } catch (e) {
          store.audit({
            id: o.id,
            reason: "RPC_UNCERTAIN",
            errorClass: (e as Error).name,
          });
        }
        store.transition(o.id, "PREPARED", "SUBMITTED");
        return;
      } catch (e) {
        const current = store.get(o.id)!;
        if (current.state === "EVALUATING")
          store.transition(
            o.id,
            "EVALUATING",
            "BLOCKED",
            [
              "PRICE_STALE",
              "MAX_SETTLEMENT_EXCEEDED",
              "SNAPSHOT_CHAIN_MISMATCH",
              "GAS_CAP",
              "LEASE_LOST",
            ].find((code) => (e as Error).message.includes(code)) ??
              "CONTRACT_POLICY_OR_RPC",
          );
        else throw e;
      }
    }
  } finally {
    clearInterval(heartbeat);
    store.release(owner);
  }
}

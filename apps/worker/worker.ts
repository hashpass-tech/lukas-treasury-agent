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
import { replaceAttempt } from "../../packages/core/replacement.js";
import {
  runtimeConfig,
  assertMainnetAuthorization,
} from "../../packages/core/config.js";
import { evaluatePolicy, type Policy } from "../../packages/core/policy.js";
import { clients, artifacts, manifest } from "../../packages/core/chain.js";
import {
  domain,
  intentTypes,
  parseIntent,
  quote,
  validateSnapshot,
  type Snapshot,
} from "../../packages/core/domain.js";
export async function tick(
  store: Store,
  stopAfterJournal = false,
  stopBeforeSign = false,
) {
  const config = runtimeConfig({ readOnly: true });
  let writesEnabled = true;
  if (config.mode === "CELO_MAINNET_PILOT") {
    try {
      assertMainnetAuthorization();
    } catch {
      writesEnabled = false;
    }
  }
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
  store.bind(m.chainId, m.vault);
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
        const currentAttempt = store.db
          .prepare("SELECT active FROM attempts WHERE hash=?")
          .get(attempt.hash) as { active: number };
        if (!currentAttempt.active) continue;
        let known = false;
        try {
          await c.publicClient.getTransaction({ hash: attempt.hash as Hex });
          known = true;
        } catch (error) {
          if (!(error instanceof TransactionNotFoundError)) return;
        }
        if (
          writesEnabled &&
          known &&
          Date.now() - attempt.created >
            Number(process.env.PENDING_REPLACEMENT_MS ?? 120000) &&
          store.attempts().filter((a) => a.obligation === o.id).length < 3
        ) {
          try {
            await replaceAttempt(store, attempt, owner);
          } catch {
            store.db
              .prepare(
                "UPDATE obligations SET reason='REPLACEMENT_GAS_CAP_OR_RPC' WHERE id=?",
              )
              .run(o.id);
          }
          return;
        }
        if (!known) {
          if (!writesEnabled) continue;
          const nonce = await c.publicClient.getTransactionCount({
            address: c.executor.account.address,
            blockTag: "latest",
          });
          const paid = await c.publicClient.readContract({
            address: m.vault,
            abi: a.TreasuryVault.abi,
            functionName: "isPaid",
            args: [o.id],
          });
          if (nonce > attempt.nonce || paid) {
            store.db
              .prepare(
                "UPDATE obligations SET reason='NONCE_OR_PAYMENT_REQUIRES_RECONCILIATION' WHERE id=?",
              )
              .run(o.id);
            return;
          }

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
        if (writesEnabled) return;
        continue;
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
          continue;
        }
        store.db
          .prepare(
            "UPDATE attempts SET active=0,submissionState='FAILED',receiptStatus='reverted' WHERE hash=?",
          )
          .run(attempt.hash);
        store.transition(o.id, "SUBMITTED", "FAILED", "CHAIN_REVERT");
        continue;
      }
      const canonical = await c.publicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });
      if (canonical.hash !== receipt.blockHash) return;
      const head = await c.publicClient.getBlockNumber({ cacheTime: 0 });
      if (head - receipt.blockNumber + 1n < BigInt(config.finality)) {
        store.db
          .prepare(
            "UPDATE obligations SET reason='AWAITING_FINALITY' WHERE id=?",
          )
          .run(o.id);
        return;
      }
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
            domain: domain(m.chainId, m.vault),
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
        mode: m.mode,
        chainId: m.chainId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        vault: m.vault,
        recipient: payment.recipient,
        token: payment.token,
        symbol: m.symbol ?? "SIMCOP",
        decimals: m.decimals,
        actualSettlementAtomic: payment.amount,
        amountLukasWad: payment.amountLukasWad,
        oracleRound: payment.round,
        intentHash: payment.intentHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        attribution: decodedAttribution ?? "LOCAL_UNTAGGED_NOT_ELIGIBLE",
        finality:
          m.chainId === 31337
            ? "local-single-node"
            : `${config.finality}-confirmations`,
      });
      store.db
        .prepare(
          "UPDATE attempts SET receiptStatus=?,blockNumber=?,blockHash=?,gasUsed=?,effectiveGasPrice=?,actualSettlementAtomic=? WHERE hash=?",
        )
        .run(
          receipt.status,
          receipt.blockNumber.toString(),
          receipt.blockHash,
          receipt.gasUsed.toString(),
          receipt.effectiveGasPrice.toString(),
          payment.amount.toString(),
          attempt.hash,
        );
    }
    if (!writesEnabled) return;
    const block = await c.publicClient.getBlock();
    const now = Number(block.timestamp);
    // Recover prepared nonce reservations before newer scheduled work.
    for (const o of store
      .list()
      .sort(
        (a, b) =>
          Number(b.state === "PREPARED") - Number(a.state === "PREPARED"),
      )) {
      if (
        ["AWAITING_AUTHORIZATION", "AUTHORIZED"].includes(o.state) &&
        parseIntent(JSON.parse(o.intent)).deadline < BigInt(now)
      ) {
        store.transition(o.id, o.state, "EXPIRED", "EXPIRED_AUTHORIZATION");
        continue;
      }
      if (!["SCHEDULED", "BLOCKED", "EVALUATING", "PREPARED"].includes(o.state))
        continue;
      const intent = parseIntent(JSON.parse(o.intent));
      if (
        o.state === "BLOCKED" &&
        (o.retryAt === null || o.retryAt > Date.now())
      )
        continue;
      if (intent.validAfter > BigInt(now)) continue;
      // A crash during evaluation is safe to retry; PREPARED with no journal has never broadcast.
      if (o.state === "PREPARED") {
        const staged = store.prepared(o.id);
        if (staged) {
          const request = {
            ...staged.request,
            account: c.executor.account,
            chain: c.executor.chain,
          };
          const raw = await c.executor.signTransaction(request),
            hash = keccak256(raw);
          if (!store.lease(owner)) return;
          store.attempt(
            o.id,
            hash,
            raw,
            request.nonce,
            c.executor.account.address.toLowerCase(),
            undefined,
            staged.quoteId,
          );
          try {
            await c.publicClient.sendRawTransaction({
              serializedTransaction: raw,
            });
          } catch {
            store.audit({ id: o.id, reason: "RPC_UNCERTAIN" });
          }
          store.transition(o.id, "PREPARED", "SUBMITTED");
          return;
        }
        store.transition(o.id, "PREPARED", "BLOCKED", "RECOVER_PRE_SIGN");
        store.db
          .prepare("UPDATE obligations SET retryAt=? WHERE id=?")
          .run(Date.now() + 1000, o.id);
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
          fs.readFileSync(config.snapshotPath, "utf8"),
        );
        validateSnapshot(
          snapshot,
          now,
          300,
          m.chainId,
          Number(process.env.SOURCE_CHAIN_ID || m.chainId),
        );
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
          onchain[2] > BigInt(snapshot.oldestComponentUpdatedAt) ||
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
        const read = (functionName: string, args: unknown[] = []) =>
          c.publicClient.readContract({
            address: m.vault,
            abi: a.TreasuryVault.abi,
            functionName,
            args,
          });
        const [
          tokenPolicy,
          allowed,
          paused,
          epoch,
          age,
          paid,
          canceled,
          spent,
          funds,
          gasBalance,
        ] = await Promise.all([
          read("tokens", [intent.settlementToken]),
          read("recipients", [intent.recipient]),
          read("paused"),
          read("policyEpoch"),
          read("maximumOracleAge"),
          read("isPaid", [o.id]),
          read("canceled", [o.id]),
          read("dailySpent", [
            intent.settlementToken,
            BigInt(Math.floor(now / 86400)),
          ]),
          c.publicClient.readContract({
            address: intent.settlementToken,
            abi: a.SimulationToken.abi,
            functionName: "balanceOf",
            args: [m.vault],
          }),
          c.publicClient.getBalance({ address: c.executor.account.address }),
        ]);
        const t = tokenPolicy as [number, boolean, bigint, bigint];
        const p: Policy = {
          chainId: m.chainId,
          vault: m.vault,
          owner: m.owner,
          executor: m.executor,
          policyEpoch: String(epoch),
          paused: Boolean(paused),
          allowedTokens: t[1] ? [intent.settlementToken] : [],
          allowedRecipients: allowed ? [intent.recipient] : [],
          perTxCap: t[2].toString(),
          dailyCap: t[3].toString(),
          maximumOracleAgeSeconds: Number(age),
          maximumQuoteAgeSeconds: 300,
          maximumGasCostNativeAtomic: config.gasCap.toString(),
          maximumRetries: 12,
          validUntil: Number(intent.deadline),
        };
        const decision = evaluatePolicy({
          intent,
          policy: p,
          snapshot,
          now,
          tokenPriceWad: onchain[1],
          decimals: t[0],
          balance: funds as bigint,
          dailySpent: spent as bigint,
          reserved: 0n,
          paid: Boolean(paid),
          canceled: Boolean(canceled),
          gasBalance,
          authority: "EXECUTE_AUTHORIZED",
        });
        store.audit({ id: o.id, event: "POLICY_EVALUATION", ...decision });
        if (decision.decision !== "ALLOW") throw new Error(decision.reasons[0]);
        store.reserve(
          o.id,
          intent.settlementToken,
          Math.floor(now / 86400),
          amount,
          t[3],
          spent as bigint,
        );
        const quoteId = store.recordQuote(
          o.id,
          {
            amountAtomic: amount,
            tokenPriceUsdWad: onchain[1],
            round,
            rounding: "ceiling-single-rational",
            createdAt: now,
            expiresAt: Math.min(
              now + 300,
              snapshot.oldestComponentUpdatedAt + 300,
            ),
            snapshotId: snapshot.snapshotId,
          },
          snapshot,
        );
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
          config.gasCap
        )
          throw new Error("GAS_CAP");
        if (!store.lease(owner)) throw new Error("LEASE_LOST");
        const durableRequest: Record<string, unknown> = {};
        for (const key of [
          "chainId",
          "nonce",
          "to",
          "data",
          "value",
          "gas",
          "gasPrice",
          "maxFeePerGas",
          "maxPriorityFeePerGas",
          "type",
          "accessList",
        ])
          if ((request as any)[key] !== undefined)
            durableRequest[key] = (request as any)[key];
        store.stagePrepared(o.id, durableRequest, quoteId);
        if (stopBeforeSign) return;
        const raw = await c.executor.signTransaction(request);
        const hash = keccak256(raw);
        if (!store.lease(owner)) throw new Error("LEASE_LOST");
        store.attempt(
          o.id,
          hash,
          raw,
          request.nonce!,
          c.executor.account.address.toLowerCase(),
          undefined,
          quoteId,
        );
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
          store.retry(
            o.id,
            [
              "PRICE_STALE",
              "MAX_SETTLEMENT_EXCEEDED",
              "SNAPSHOT_CHAIN_MISMATCH",
              "GAS_CAP",
              "LEASE_LOST",
              "POLICY_EPOCH_CHANGED",
              "PAUSED",
              "TOKEN_NOT_ALLOWED",
              "RECIPIENT_NOT_ALLOWED",
              "PER_TX_CAP_EXCEEDED",
              "DAILY_CAP_EXCEEDED",
              "INSUFFICIENT_BALANCE",
              "INSUFFICIENT_GAS",
              "CANCELED_ONCHAIN",
              "DUPLICATE_PAYMENT",
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

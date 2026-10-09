import {
  encodeFunctionData,
  decodeEventLog,
  type Hex,
  type Address,
} from "viem";
import { randomUUID } from "node:crypto";
import { clients, manifest, artifacts } from "./chain.js";
import { prepareAttributedTransaction } from "./attribution.js";
import { resolveAttributionCode } from "./hackathon.js";
import { Store } from "./storage.js";
import { stringify } from "./domain.js";
export const ownerActions = [
  "fund",
  "pause",
  "unpause",
  "withdraw",
  "setRecipient",
  "setToken",
  "setExecutor",
  "configurePolicy",
  "cancelIntent",
] as const;
export type OwnerAction = (typeof ownerActions)[number];
export function prepareOwnerAction(
  store: Store,
  wallet: string,
  action: OwnerAction,
  args: unknown[],
) {
  if (!ownerActions.includes(action))
    throw new Error("OWNER_ACTION_UNSUPPORTED");
  const m = manifest();
  if (wallet.toLowerCase() !== m.owner.toLowerCase())
    throw new Error("NOT_TREASURY_OWNER");
  const data = prepareAttributedTransaction(
    encodeFunctionData({
      abi:
        action === "fund"
          ? artifacts().SimulationToken.abi
          : artifacts().TreasuryVault.abi,
      functionName: action === "fund" ? "transfer" : action,
      args: action === "fund" ? [m.vault, args[0]] : args,
    }),
    resolveAttributionCode(),
  );
  const id = randomUUID(),
    payload = {
      id,
      action,
      args,
      chainId: m.chainId,
      from: m.owner,
      to: action === "fund" ? m.token : m.vault,
      data,
      value: "0x0",
    };
  store.db
    .prepare(
      "INSERT INTO prepared_actions(id,wallet,payload,createdAt) VALUES(?,?,?,?)",
    )
    .run(id, wallet.toLowerCase(), stringify(payload), Date.now());
  return JSON.parse(stringify(payload));
}
export async function verifyOwnerAction(
  store: Store,
  id: string,
  wallet: string,
  hash: Hex,
) {
  const row = store.db
    .prepare("SELECT * FROM prepared_actions WHERE id=? AND wallet=?")
    .get(id, wallet.toLowerCase()) as any;
  if (!row) throw new Error("NOT_FOUND");
  const p = JSON.parse(row.payload),
    c = clients(),
    m = manifest();
  const [tx, receipt] = await Promise.all([
    c.publicClient.getTransaction({ hash }),
    c.publicClient.getTransactionReceipt({ hash }),
  ]);
  if (
    (await c.publicClient.getChainId()) !== p.chainId ||
    receipt.status !== "success" ||
    tx.from.toLowerCase() !== wallet.toLowerCase() ||
    tx.to?.toLowerCase() !== p.to.toLowerCase() ||
    tx.input.toLowerCase() !== p.data.toLowerCase() ||
    tx.value !== 0n
  )
    throw new Error("OWNER_TRANSACTION_MISMATCH");
  const block = await c.publicClient.getBlock({
    blockNumber: receipt.blockNumber,
  });
  if (block.hash !== receipt.blockHash)
    throw new Error("OWNER_TRANSACTION_REORG");
  const { runtimeConfig } = await import("./config.js");
  const depth = runtimeConfig({ readOnly: true }).finality;
  if (
    (await c.publicClient.getBlockNumber({ cacheTime: 0 })) -
      receipt.blockNumber +
      1n <
    BigInt(depth)
  )
    throw new Error("AWAITING_FINALITY");
  if (p.action === "fund") {
    const funded = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== m.token.toLowerCase()) return false;
      try {
        const e = decodeEventLog({
          abi: artifacts().SimulationToken.abi,
          data: log.data,
          topics: log.topics,
        }) as any;
        return (
          e.eventName === "Transfer" &&
          e.args.from.toLowerCase() === wallet.toLowerCase() &&
          e.args.to.toLowerCase() === m.vault.toLowerCase() &&
          e.args.value === BigInt(p.args[0])
        );
      } catch {
        return false;
      }
    });
    if (!funded) throw new Error("FUNDING_EVENT_MISSING");
  }
  const read = (functionName: string, args: unknown[] = []) =>
    c.publicClient.readContract({
      address: m.vault,
      abi: artifacts().TreasuryVault.abi,
      functionName,
      args,
      blockNumber: receipt.blockNumber,
    });
  if (p.action === "cancelIntent" && !(await read("canceled", [p.args[0]])))
    throw new Error("OWNER_EFFECT_MISSING");
  if (p.action === "pause" && !(await read("paused")))
    throw new Error("OWNER_EFFECT_MISSING");
  if (p.action === "unpause" && (await read("paused")))
    throw new Error("OWNER_EFFECT_MISSING");
  if (
    p.action === "setExecutor" &&
    String(await read("executor")).toLowerCase() !== p.args[0].toLowerCase()
  )
    throw new Error("OWNER_EFFECT_MISSING");
  if (
    p.action === "configurePolicy" &&
    String(await read("maximumOracleAge")) !== p.args[0]
  )
    throw new Error("OWNER_EFFECT_MISSING");
  if (
    p.action === "setRecipient" &&
    (await read("recipients", [p.args[0]])) !== p.args[1]
  )
    throw new Error("OWNER_EFFECT_MISSING");
  if (p.action === "setToken") {
    const actual = (await read("tokens", [p.args[0]])) as unknown[];
    for (let n = 0; n < 4; n++)
      if (String(actual[n]) !== String(p.args[n + 1]))
        throw new Error("OWNER_EFFECT_MISSING");
  }
  const epoch = String(await read("policyEpoch"));
  store.tx(() => {
    store.db
      .prepare(
        "UPDATE prepared_actions SET transactionHash=?,status='CHAIN_EFFECTIVE' WHERE id=?",
      )
      .run(hash, id);
    if (p.action === "setRecipient")
      store.db
        .prepare(
          "INSERT INTO recipient_allowlist VALUES(?,?,?,?) ON CONFLICT(treasury,recipient) DO UPDATE SET allowed=excluded.allowed,transactionHash=excluded.transactionHash",
        )
        .run(
          m.vault.toLowerCase(),
          p.args[0].toLowerCase(),
          p.args[1] ? 1 : 0,
          hash,
        );
    if (p.action === "setToken")
      store.db
        .prepare(
          "INSERT INTO token_allowlist VALUES(?,?,?,?,?,?) ON CONFLICT(treasury,token) DO UPDATE SET enabled=excluded.enabled,decimals=excluded.decimals,transactionHash=excluded.transactionHash",
        )
        .run(
          m.vault.toLowerCase(),
          p.args[0].toLowerCase(),
          p.args[1],
          p.args[2] ? 1 : 0,
          "Owner transaction; token review required",
          hash,
        );
    if (p.action === "cancelIntent") {
      const o = store.get(p.args[0]);
      if (
        o &&
        [
          "AWAITING_AUTHORIZATION",
          "AUTHORIZED",
          "SCHEDULED",
          "BLOCKED",
          "EVALUATING",
        ].includes(o.state)
      ) {
        store.db
          .prepare(
            "UPDATE obligations SET state='CANCELED',reason='CANCELED_ONCHAIN',version=version+1 WHERE id=?",
          )
          .run(o.id);
        store.db
          .prepare("DELETE FROM reservations WHERE obligation=?")
          .run(o.id);
      }
    }
    store.db
      .prepare("INSERT OR REPLACE INTO policies VALUES(?,?,?,?,?)")
      .run(
        `${m.vault}:${epoch}`,
        m.vault.toLowerCase(),
        epoch,
        stringify({ action: p.action, args: p.args }),
        hash,
      );
    store.audit({
      event: "OWNER_ACTION_CHAIN_EFFECTIVE",
      action: p.action,
      transactionHash: hash,
      blockHash: receipt.blockHash,
      policyEpoch: epoch,
    });
  });
  return {
    status: "CHAIN_EFFECTIVE",
    transactionHash: hash,
    policyEpoch: epoch,
  };
}

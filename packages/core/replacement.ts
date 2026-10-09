import {
  parseTransaction,
  keccak256,
  recoverTransactionAddress,
  type Hex,
  type TransactionSerialized,
} from "viem";
import { Store } from "./storage.js";
import { clients, manifest } from "./chain.js";
import { runtimeConfig } from "./config.js";
import { assertAttributedCalldata } from "./attribution.js";
import { resolveAttributionCode } from "./hackathon.js";
export async function replaceAttempt(
  store: Store,
  attempt: ReturnType<Store["attempts"]>[number],
  leaseOwner: string,
) {
  const c = clients(),
    m = manifest(),
    config = runtimeConfig(),
    raw = attempt.raw as Hex,
    original = parseTransaction(raw);
  if (
    keccak256(raw) !== attempt.hash ||
    original.to?.toLowerCase() !== m.vault.toLowerCase() ||
    original.chainId !== m.chainId ||
    original.nonce !== attempt.nonce ||
    (
      await recoverTransactionAddress({
        serializedTransaction: raw as TransactionSerialized,
      })
    ).toLowerCase() !== m.executor.toLowerCase()
  )
    throw new Error("REPLACEMENT_JOURNAL_MISMATCH");
  assertAttributedCalldata(original.data ?? "0x", resolveAttributionCode());
  const bump = (value: bigint) => value + (value + 7n) / 8n + 1n;
  const fees =
    original.type === "legacy"
      ? { type: "legacy" as const, gasPrice: bump(original.gasPrice!) }
      : {
          type: "eip1559" as const,
          maxFeePerGas: bump(original.maxFeePerGas!),
          maxPriorityFeePerGas: bump(original.maxPriorityFeePerGas!),
        };
  const fee = "gasPrice" in fees ? fees.gasPrice : fees.maxFeePerGas;
  if (!original.gas || original.gas * (fee ?? 0n) > config.gasCap)
    throw new Error("GAS_CAP");
  const request = {
    chain: c.executor.chain,
    account: c.executor.account,
    to: original.to,
    data: original.data,
    value: original.value ?? 0n,
    gas: original.gas,
    nonce: original.nonce,
    ...fees,
  };
  const replacement = await c.executor.signTransaction(request),
    hash = keccak256(replacement);
  if (!store.lease(leaseOwner)) throw new Error("LEASE_LOST");
  store.attempt(
    attempt.obligation,
    hash,
    replacement,
    attempt.nonce,
    attempt.signer,
    attempt.hash,
  );
  store.audit({
    id: attempt.obligation,
    event: "FEE_REPLACEMENT",
    originalHash: attempt.hash,
    replacementHash: hash,
    nonce: attempt.nonce,
    gasFeeCap: fee,
  });
  try {
    await c.publicClient.sendRawTransaction({
      serializedTransaction: replacement,
    });
  } catch {
    store.audit({ id: attempt.obligation, reason: "RPC_UNCERTAIN" });
  }
  return hash;
}

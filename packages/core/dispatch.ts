import {
  keccak256,
  stringToHex,
  type Hex,
  type Address,
  TransactionReceiptNotFoundError,
  TransactionNotFoundError,
} from "viem";
import { Store } from "./storage.js";
import { stringify } from "./domain.js";
import { assertAttributedCalldata } from "./attribution.js";
import { resolveAttributionCode } from "./hackathon.js";
export async function durableDispatch(
  store: Store,
  key: string,
  c: any,
  wallet: any,
  input: { to?: Address; data: Hex; value?: bigint },
) {
  key = `${wallet.chain.id}:${key}`;
  assertAttributedCalldata(input.data, resolveAttributionCode());
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS remote_operations(key TEXT PRIMARY KEY,payloadHash TEXT NOT NULL,hash TEXT UNIQUE NOT NULL,raw TEXT NOT NULL,createdAt INTEGER NOT NULL)",
  );
  const payloadHash = keccak256(
    stringToHex(
      stringify({
        chainId: wallet.chain.id,
        signer: wallet.account.address,
        ...input,
      }),
    ),
  );
  let operation = store.db
    .prepare("SELECT * FROM remote_operations WHERE key=?")
    .get(key) as any;
  if (operation && operation.payloadHash !== payloadHash)
    throw new Error("DEPLOYMENT_IDEMPOTENCY_CONFLICT");
  if (!operation) {
    const request = await wallet.prepareTransactionRequest({
      ...input,
      account: wallet.account,
      chain: wallet.chain,
    });
    const raw = await wallet.signTransaction(request),
      hash = keccak256(raw);
    store.tx(() => {
      store.db
        .prepare("INSERT INTO remote_operations VALUES(?,?,?,?,?)")
        .run(
          key,
          payloadHash,
          hash,
          store.journal.protect(raw, hash),
          Date.now(),
        );
      store.audit({ event: "REMOTE_SIGNED_JOURNAL", key, hash });
    });
    operation = store.db
      .prepare("SELECT * FROM remote_operations WHERE key=?")
      .get(key) as any;
  }
  let receipt;
  try {
    receipt = await c.publicClient.getTransactionReceipt({
      hash: operation.hash,
    });
  } catch (e) {
    if (!(e instanceof TransactionReceiptNotFoundError))
      throw new Error("RPC_UNCERTAIN");
  }
  if (!receipt) {
    let known = false;
    try {
      await c.publicClient.getTransaction({ hash: operation.hash });
      known = true;
    } catch (e) {
      if (!(e instanceof TransactionNotFoundError))
        throw new Error("RPC_UNCERTAIN");
    }
    if (!known) {
      const raw = store.journal.recover(operation.raw, operation.hash);
      try {
        await c.publicClient.sendRawTransaction({ serializedTransaction: raw });
      } catch {
        throw new Error("RPC_UNCERTAIN_RESTART_TO_RECONCILE");
      }
    }
    receipt = await c.publicClient.waitForTransactionReceipt({
      hash: operation.hash,
      confirmations: Number(process.env.CONFIRMATIONS ?? 5),
      timeout: 60000,
    });
  }
  if (receipt.status !== "success")
    throw new Error("DEPLOYMENT_TRANSACTION_REVERTED");
  const confirmations = Number(process.env.CONFIRMATIONS ?? 5);
  const head = await c.publicClient.getBlockNumber();
  if (BigInt(head) - BigInt(receipt.blockNumber) + 1n < BigInt(confirmations))
    receipt = await c.publicClient.waitForTransactionReceipt({
      hash: operation.hash,
      confirmations,
      timeout: 60000,
    });
  const canonical = await c.publicClient.getBlock({
    blockNumber: receipt.blockNumber,
  });
  if (canonical.hash !== receipt.blockHash)
    throw new Error("DEPLOYMENT_TRANSACTION_REORG");
  return receipt;
}

import { it, expect } from "vitest";
import { mnemonicToAccount } from "viem/accounts";
import { localMnemonic } from "../packages/core/chain.js";
import { verifySignedTransaction } from "../packages/core/signer.js";
import { prepareAttributedTransaction } from "../packages/core/attribution.js";
import { resolveAttributionCode } from "../packages/core/hackathon.js";
import { runtimeConfig } from "../packages/core/config.js";
it("verifies remote signer bytes rather than trusting returned calldata, nonce, fees or signer", async () => {
  const account = mnemonicToAccount(localMnemonic),
    transaction = {
      chainId: 31337,
      nonce: 0,
      gas: 50000n,
      maxFeePerGas: 10n,
      maxPriorityFeePerGas: 1n,
      type: "eip1559" as const,
      to: account.address,
      value: 0n,
      data: prepareAttributedTransaction("0x1234", resolveAttributionCode()),
    };
  const raw = await account.signTransaction(transaction);
  await verifySignedTransaction(transaction, raw, account.address);
  for (const patch of [
    { nonce: 1 },
    { maxFeePerGas: 11n },
    { data: "0x1234" },
    { value: 1n },
  ])
    await expect(
      verifySignedTransaction(
        { ...transaction, ...patch },
        raw,
        account.address,
      ),
    ).rejects.toThrow("SIGNER_TRANSACTION_MISMATCH");
  await expect(
    verifySignedTransaction(
      transaction,
      raw,
      mnemonicToAccount(localMnemonic, { addressIndex: 1 }).address,
    ),
  ).rejects.toThrow("SIGNER_ADDRESS_MISMATCH");
});
it("remote runtime refuses wrong chain, insecure RPC, and missing protected signer", () => {
  const previous = { ...process.env };
  try {
    process.env.MODE = "CELO_SEPOLIA";
    process.env.CHAIN_ID = "42220";
    expect(() => runtimeConfig()).toThrow("CHAIN_MISMATCH");
    process.env.CHAIN_ID = "11142220";
    process.env.RPC_URL = "http://localhost:8545";
    expect(() => runtimeConfig()).toThrow("HTTPS_RPC_REQUIRED");
    process.env.RPC_URL = "https://example.invalid";
    delete process.env.SIGNER_URL;
    expect(() => runtimeConfig()).toThrow("REMOTE_SIGNER_AND_JOURNAL_REQUIRED");
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

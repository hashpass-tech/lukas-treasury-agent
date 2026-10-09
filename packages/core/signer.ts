import { toAccount } from "viem/accounts";
import {
  parseTransaction,
  recoverTransactionAddress,
  type Address,
  type Hex,
  type TransactionSerialized,
  encodeFunctionData,
} from "viem";
import { assertAttributedCalldata } from "./attribution.js";
import { resolveAttributionCode } from "./hackathon.js";
import { stringify } from "./domain.js";
import { assertMainnetAuthorization } from "./config.js";
import fs from "node:fs";

export function remoteAccount(
  address: Address,
  role: "owner" | "executor" | "publisher" | "deployer",
) {
  const endpoint = new URL(
    process.env[`${role.toUpperCase()}_SIGNER_URL`] ?? process.env.SIGNER_URL!,
  );
  if (endpoint.protocol !== "https:") throw new Error("HTTPS_SIGNER_REQUIRED");
  async function request(method: string, payload: unknown) {
    if (process.env.MODE === "CELO_MAINNET_PILOT" && role !== "owner")
      assertMainnetAuthorization();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...((process.env[`${role.toUpperCase()}_SIGNER_AUTH_TOKEN`] ??
        process.env.SIGNER_AUTH_TOKEN)
          ? {
              Authorization: `Bearer ${process.env[`${role.toUpperCase()}_SIGNER_AUTH_TOKEN`] ?? process.env.SIGNER_AUTH_TOKEN}`,
            }
          : {}),
      },
      body: stringify({ method, role, address, payload }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("SIGNER_UNAVAILABLE");
    const result = (await response.json()) as {
      signature?: Hex;
      rawTransaction?: Hex;
    };
    return result;
  }
  return toAccount({
    address,
    async signMessage({ message }) {
      if (role !== "owner") throw new Error("SIGNER_MESSAGE_FORBIDDEN");
      const r = await request("signMessage", { message });
      if (!r.signature) throw new Error("SIGNER_INVALID_RESULT");
      return r.signature;
    },
    async signTypedData(parameters) {
      if (role !== "owner") throw new Error("SIGNER_TYPED_DATA_FORBIDDEN");
      const r = await request("signTypedData", parameters);
      if (!r.signature) throw new Error("SIGNER_INVALID_RESULT");
      return r.signature;
    },
    async signTransaction(transaction) {
      assertAttributedCalldata(
        transaction.data ?? "0x",
        resolveAttributionCode(),
      );
      const expectedChain =
        process.env.MODE === "CELO_SEPOLIA" ? 11142220 : 42220;
      if (transaction.chainId !== expectedChain)
        throw new Error("CHAIN_MISMATCH");
      if (role === "executor") {
        const m = JSON.parse(
          fs.readFileSync(
            process.env.DEPLOYMENT_MANIFEST ?? ".local/deployment.json",
            "utf8",
          ),
        );
        const abi = JSON.parse(fs.readFileSync(".local/contracts.json", "utf8"))
          .TreasuryVault.abi;
        const selector = encodeFunctionData({
          abi,
          functionName: "executePayment",
          args: [
            {
              obligationId: "0x" + "00".repeat(32),
              vault: m.vault,
              referenceToken: "0x" + "00".repeat(20),
              settlementToken: m.token,
              recipient: m.recipient,
              amountLukasWad: 1n,
              maxSettlementAtomic: 1n,
              validAfter: 0n,
              deadline: 1n,
              policyEpoch: 1n,
              methodologyHash: m.methodologyHash,
              salt: "0x" + "00".repeat(32),
            },
            "0x",
            1n,
          ],
        }).slice(0, 10);
        if (
          transaction.to?.toLowerCase() !== m.vault.toLowerCase() ||
          !transaction.data?.startsWith(selector) ||
          (transaction.value ?? 0n) !== 0n
        )
          throw new Error("EXECUTOR_SCOPE");
        const cap = BigInt(process.env.MAXIMUM_GAS_COST_NATIVE_ATOMIC ?? "0");
        if (
          cap <= 0n ||
          !transaction.gas ||
          transaction.gas *
            (transaction.maxFeePerGas ?? transaction.gasPrice ?? 0n) >
            cap
        )
          throw new Error("GAS_CAP");
      }
      const result = await request("signTransaction", transaction);
      if (!result.rawTransaction) throw new Error("SIGNER_INVALID_RESULT");
      await verifySignedTransaction(
        transaction as any,
        result.rawTransaction,
        address,
      );
      return result.rawTransaction;
    },
  });
}
export async function verifySignedTransaction(
  expected: Record<string, any>,
  raw: Hex,
  address: Address,
) {
  const actual = parseTransaction(raw);
  if (
    (
      await recoverTransactionAddress({
        serializedTransaction: raw as TransactionSerialized,
      })
    ).toLowerCase() !== address.toLowerCase()
  )
    throw new Error("SIGNER_ADDRESS_MISMATCH");
  for (const key of [
    "chainId",
    "nonce",
    "gas",
    "gasPrice",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "value",
    "data",
    "to",
  ]) {
    const left = (actual as any)[key] ?? (key === "value" ? 0n : undefined),
      right = expected[key] ?? (key === "value" ? 0n : undefined);
    if (String(left).toLowerCase() !== String(right).toLowerCase())
      throw new Error(`SIGNER_TRANSACTION_MISMATCH:${key}`);
  }
  assertAttributedCalldata(actual.data ?? "0x", resolveAttributionCode());
}

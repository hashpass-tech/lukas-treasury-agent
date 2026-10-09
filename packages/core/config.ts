import fs from "node:fs";
import { isAddress, type Address } from "viem";
import { hackathon, resolveAttributionCode } from "./hackathon.js";
export type Mode = "LOCAL" | "CELO_SEPOLIA" | "CELO_MAINNET_PILOT";
export function runtimeConfig(options: { readOnly?: boolean } = {}) {
  const mode = (process.env.MODE ?? "LOCAL") as Mode;
  if (!["LOCAL", "CELO_SEPOLIA", "CELO_MAINNET_PILOT"].includes(mode))
    throw new Error("INVALID_MODE");
  const chainId = {
    LOCAL: 31337,
    CELO_SEPOLIA: 11142220,
    CELO_MAINNET_PILOT: 42220,
  }[mode];
  if (process.env.CHAIN_ID && Number(process.env.CHAIN_ID) !== chainId)
    throw new Error("CHAIN_MISMATCH");
  const rpc =
    process.env.RPC_URL ??
    (mode === "CELO_SEPOLIA"
      ? process.env.CELO_SEPOLIA_RPC_URL
      : process.env.CELO_MAINNET_RPC_URL) ??
    (mode === "LOCAL" ? "http://127.0.0.1:8545" : "");
  if (!rpc) throw new Error("RPC_REQUIRED");
  const url = new URL(rpc);
  if (mode === "LOCAL" && !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("LOCAL_RPC_REQUIRED");
  if (mode !== "LOCAL" && url.protocol !== "https:")
    throw new Error("HTTPS_RPC_REQUIRED");
  const attributionCode = resolveAttributionCode();
  if (
    mode !== "LOCAL" &&
    (!process.env.JOURNAL_KEY_FILE || !process.env.SIGNER_URL)
  )
    throw new Error("REMOTE_SIGNER_AND_JOURNAL_REQUIRED");
  const finality = Number(
    process.env.CONFIRMATIONS ?? (mode === "LOCAL" ? "1" : "5"),
  );
  if (
    !Number.isSafeInteger(finality) ||
    finality < 1 ||
    (mode !== "LOCAL" && finality < 2)
  )
    throw new Error("INVALID_FINALITY");
  if (
    mode === "CELO_MAINNET_PILOT" &&
    publicAddress("AGENT_WALLET_ADDRESS").toLowerCase() !==
      hackathon.agentWallet?.toLowerCase()
  )
    throw new Error("AGENT_WALLET_PROJECT_MISMATCH");
  if (
    !options.readOnly &&
    mode === "CELO_MAINNET_PILOT" &&
    process.env.MAINNET_WRITES === "true"
  )
    assertMainnetAuthorization();
  if (mode !== "CELO_MAINNET_PILOT" && process.env.MAINNET_WRITES === "true")
    throw new Error("MAINNET_MODE_REQUIRED");
  return {
    mode,
    chainId,
    rpc,
    attributionCode,
    finality,
    manifestPath: process.env.DEPLOYMENT_MANIFEST ?? ".local/deployment.json",
    snapshotPath: process.env.SNAPSHOT_PATH ?? ".local/snapshot.json",
    gasCap: BigInt(
      process.env.MAXIMUM_GAS_COST_NATIVE_ATOMIC ||
        (mode === "LOCAL" ? "10000000000000000" : "0"),
    ),
  };
}
export function publicAddress(name: string): Address {
  const value = process.env[name];
  if (!value || !isAddress(value))
    throw new Error(`PUBLIC_ADDRESS_REQUIRED:${name}`);
  return value;
}
export function assertMainnetAuthorization() {
  if (
    process.env.MAINNET_WRITES !== "true" ||
    !process.env.MAINNET_AUTHORIZATION_FILE
  )
    throw new Error("MAINNET_WRITES_DISABLED");
  const a = JSON.parse(
    fs.readFileSync(process.env.MAINNET_AUTHORIZATION_FILE, "utf8"),
  );
  if (
    a.chainId !== 42220 ||
    a.attributionCode !== resolveAttributionCode() ||
    a.agentWallet?.toLowerCase() !==
      publicAddress("AGENT_WALLET_ADDRESS").toLowerCase() ||
    !a.operator ||
    !a.reviewReference ||
    !a.identityVerified ||
    !a.oracleVerified ||
    !a.tokensVerified ||
    !a.exposureCapsReviewed ||
    !Number.isFinite(Date.parse(a.expiresAt)) ||
    Date.parse(a.expiresAt) <= Date.now()
  )
    throw new Error("MAINNET_AUTHORIZATION_INVALID");
  if (
    process.env.ORACLE_MODE === "fixture" ||
    !process.env.MAXIMUM_GAS_COST_NATIVE_ATOMIC
  )
    throw new Error("MAINNET_ECONOMIC_POLICY_REQUIRED");
}

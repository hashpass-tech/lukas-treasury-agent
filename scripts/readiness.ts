import fs from "node:fs";
import { createPublicClient, http } from "viem";
import { assertAttributedCalldata } from "../packages/core/attribution.js";
import { Journal } from "../packages/core/journal.js";
import {
  hackathon,
  resolveAttributionCode,
} from "../packages/core/hackathon.js";
import { verifyTokenMetadata } from "../packages/core/token-registry.js";
import { verifiedRegistry } from "../packages/core/identity.js";
import { assertMainnetAuthorization } from "../packages/core/config.js";
const gates: Record<string, { pass: boolean; detail: string }> = {};
async function check(name: string, fn: () => Promise<string> | string) {
  try {
    gates[name] = { pass: true, detail: await fn() };
  } catch (e) {
    gates[name] = {
      pass: false,
      detail:
        (e as Error).message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/)?.[1] ??
        "UNVERIFIED",
    };
  }
}
await check("issuedAttribution", () => {
  if (resolveAttributionCode() !== hackathon.attributionCode)
    throw new Error("ATTRIBUTION_PROJECT_MISMATCH");
  return hackathon.attributionCode;
});
await check("permanentAgentWallet", () => {
  if (
    process.env.AGENT_WALLET_ADDRESS?.toLowerCase() !==
    hackathon.agentWallet.toLowerCase()
  )
    throw new Error("AGENT_WALLET_NOT_CONFIGURED");
  return hackathon.agentWallet;
});
const rpc = process.env.CELO_MAINNET_RPC_URL;
await check("mainnetRpc", async () => {
  if (!rpc || new URL(rpc).protocol !== "https:")
    throw new Error("MAINNET_RPC_MISSING");
  if (
    (await createPublicClient({ transport: http(rpc) }).getChainId()) !== 42220
  )
    throw new Error("CHAIN_MISMATCH");
  return "42220 verified";
});
await check("officialWfiat", async () => {
  if (!rpc || !process.env.MAINNET_TOKEN_METADATA)
    throw new Error("OFFICIAL_TOKEN_METADATA_REQUIRED");
  const token = await verifyTokenMetadata(
    createPublicClient({ transport: http(rpc) }),
    JSON.parse(fs.readFileSync(process.env.MAINNET_TOKEN_METADATA, "utf8")),
  );
  return `${token.symbol}:${token.address}`;
});
await check("canonicalIdentity", async () => {
  if (!rpc || !process.env.ERC8004_AGENT_ID)
    throw new Error("CANONICAL_IDENTITY_REQUIRED");
  const pc = createPublicClient({ transport: http(rpc) }),
    registry = await verifiedRegistry(pc, 42220),
    abi = (
      await import("../config/erc8004/IdentityRegistry.json", {
        with: { type: "json" },
      })
    ).default;
  for (const functionName of ["ownerOf", "getAgentWallet"]) {
    const value = await pc.readContract({
      address: registry,
      abi,
      functionName,
      args: [BigInt(process.env.ERC8004_AGENT_ID)],
    });
    if (String(value).toLowerCase() !== hackathon.agentWallet.toLowerCase())
      throw new Error("IDENTITY_BINDING_MISMATCH");
  }
  return `${registry}:${process.env.ERC8004_AGENT_ID}`;
});
await check("protectedSigner", () => {
  if (
    !process.env.SIGNER_URL ||
    new URL(process.env.SIGNER_URL).protocol !== "https:" ||
    !process.env.JOURNAL_KEY_FILE ||
    !fs.existsSync(process.env.JOURNAL_KEY_FILE)
  )
    throw new Error("PROTECTED_SIGNER_NOT_PROVISIONED");
  new Journal();
  return "Configured; remote operational/security review still required";
});
await check("reviewedMainnetPlan", () => {
  if (!fs.existsSync(".local/mainnet-plan.json"))
    throw new Error("MAINNET_PLAN_NOT_PREPARED");
  const plan = JSON.parse(fs.readFileSync(".local/mainnet-plan.json", "utf8"));
  if (!plan.planHash || plan.chainId !== 42220)
    throw new Error("MAINNET_PLAN_INVALID");
  return plan.planHash;
});
await check("operatorAuthorization", () => {
  assertMainnetAuthorization();
  return "Bounded operator authorization configured";
});
await check("realSepoliaEvidence", async () => {
  const rpc = process.env.CELO_SEPOLIA_RPC_URL;
  if (
    !rpc ||
    new URL(rpc).protocol !== "https:" ||
    ["localhost", "127.0.0.1"].includes(new URL(rpc).hostname) ||
    !fs.existsSync(".local/sepolia-receipt.json")
  )
    throw new Error("REAL_SEPOLIA_EVIDENCE_REQUIRED");
  const evidence = JSON.parse(
      fs.readFileSync(".local/sepolia-receipt.json", "utf8"),
    ),
    pc = createPublicClient({ transport: http(rpc) });
  if ((await pc.getChainId()) !== 11142220 || evidence.chainId !== 11142220)
    throw new Error("CHAIN_MISMATCH");
  const [receipt, tx] = await Promise.all([
    pc.getTransactionReceipt({ hash: evidence.transactionHash }),
    pc.getTransaction({ hash: evidence.transactionHash }),
  ]);
  if (
    receipt.status !== "success" ||
    receipt.blockHash !== evidence.blockHash ||
    tx.from.toLowerCase() !== hackathon.agentWallet.toLowerCase() ||
    tx.to?.toLowerCase() !== evidence.vault.toLowerCase() ||
    (await pc.getBlock({ blockNumber: receipt.blockNumber })).hash !==
      receipt.blockHash
  )
    throw new Error("SEPOLIA_EVIDENCE_UNVERIFIED");
  assertAttributedCalldata(tx.input, resolveAttributionCode());
  return receipt.transactionHash;
});
await check("independentReview", () => {
  if (!process.env.SECURITY_REVIEW_FILE)
    throw new Error("INDEPENDENT_REVIEW_REQUIRED");
  const review = JSON.parse(
      fs.readFileSync(process.env.SECURITY_REVIEW_FILE, "utf8"),
    ),
    plan = JSON.parse(fs.readFileSync(".local/mainnet-plan.json", "utf8"));
  if (
    review.approved !== true ||
    !review.reviewer ||
    !review.reviewReference ||
    review.planHash !== plan.planHash ||
    !/^([0-9a-f]{40})$/.test(review.sourceCommit ?? "") ||
    !Number.isFinite(Date.parse(review.expiresAt)) ||
    Date.parse(review.expiresAt) <= Date.now()
  )
    throw new Error("INDEPENDENT_REVIEW_INVALID");
  return `Operator-supplied independent review: ${review.reviewReference}`;
});
const ready = Object.values(gates).every((g) => g.pass);
console.log(
  JSON.stringify(
    {
      ready,
      mainnetWrites: process.env.MAINNET_WRITES === "true",
      event: hackathon,
      gates,
      tokenPilot: {
        ready: false,
        detail:
          "Separate LKS issuance/reserve/redemption release; this application does not authorize it",
      },
    },
    null,
    2,
  ),
);
process.exitCode = ready ? 0 : 1;

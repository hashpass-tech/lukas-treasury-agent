import fs from "node:fs";
import { z } from "zod";
import {
  createPublicClient,
  http,
  isAddress,
  encodeDeployData,
  encodeFunctionData,
  keccak256,
  stringToHex,
  type Address,
} from "viem";
import { installSafeErrors } from "./safe-errors.js";
import { artifacts, clients, type Manifest } from "../packages/core/chain.js";
import {
  publicAddress,
  assertMainnetAuthorization,
} from "../packages/core/config.js";
import { methodologyHash, stringify } from "../packages/core/domain.js";
import { verifyTokenMetadata } from "../packages/core/token-registry.js";
import { verifiedRegistry } from "../packages/core/identity.js";
import { durableDispatch } from "../packages/core/dispatch.js";
import { prepareAttributedTransaction } from "../packages/core/attribution.js";
import {
  hackathon,
  resolveAttributionCode,
} from "../packages/core/hackathon.js";
import { Store } from "../packages/core/storage.js";
installSafeErrors();
resolveAttributionCode({
  MODE: "CELO_MAINNET_PILOT",
  ATTRIBUTION_CODE: process.env.ATTRIBUTION_CODE ?? hackathon.attributionCode,
});
const address = z.string().refine(isAddress),
  uint = z.string().regex(/^[1-9][0-9]*$/);
const schema = z
  .object({
    chainId: z.literal(42220),
    owner: address,
    deployer: address,
    agentWallet: address,
    publisher: address,
    recipient: address,
    perTxCap: uint,
    dailyCap: uint,
    maximumOracleAgeSeconds: z.number().int().min(1).max(3600),
    maximumGasCostNativeAtomic: uint,
    tokenMetadata: z.unknown(),
    oracle: z.discriminatedUnion("mode", [
      z.object({
        mode: z.literal("native"),
        source: address,
        tokenPriceFeed: address,
        sourceCodeHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
        tokenFeedCodeHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      }),
      z.object({
        mode: z.literal("signed-mirror"),
        sourceChainId: z.number().int().positive(),
        sourceContract: address,
        acceptedTrustReference: z.string().min(20),
      }),
    ]),
    reviewReference: z.string().min(1),
  })
  .strict();
if (!process.env.MAINNET_PLAN_CONFIG)
  throw new Error("MAINNET_PLAN_CONFIG_REQUIRED");
const input = schema.parse(
  JSON.parse(fs.readFileSync(process.env.MAINNET_PLAN_CONFIG, "utf8")),
);
if (
  input.agentWallet.toLowerCase() !== hackathon.agentWallet.toLowerCase() ||
  BigInt(input.dailyCap) < BigInt(input.perTxCap)
)
  throw new Error("MAINNET_PLAN_INVALID");
if (
  new Set(
    [input.owner, input.deployer, input.agentWallet, input.publisher].map((x) =>
      x.toLowerCase(),
    ),
  ).size !== 4
)
  throw new Error("SEPARATE_ROLE_WALLETS_REQUIRED");
const rpc = process.env.CELO_MAINNET_RPC_URL ?? process.env.RPC_URL;
if (!rpc || new URL(rpc).protocol !== "https:")
  throw new Error("HTTPS_MAINNET_RPC_REQUIRED");
const pc = createPublicClient({ transport: http(rpc) });
if ((await pc.getChainId()) !== 42220) throw new Error("CHAIN_MISMATCH");
const token = await verifyTokenMetadata(pc, input.tokenMetadata),
  a = artifacts();
if (input.oracle.mode === "native")
  for (const [address, expected] of [
    [input.oracle.source, input.oracle.sourceCodeHash],
    [input.oracle.tokenPriceFeed, input.oracle.tokenFeedCodeHash],
  ]) {
    const code = await pc.getCode({ address: address as Address });
    if (!code || keccak256(code) !== expected)
      throw new Error("ORACLE_CODE_UNVERIFIED");
  }
const registry = await verifiedRegistry(pc, 42220),
  agentId = process.env.ERC8004_AGENT_ID;
if (!agentId?.match(/^[0-9]+$/)) throw new Error("CANONICAL_IDENTITY_REQUIRED");
const identityAbi = (
  await import("../config/erc8004/IdentityRegistry.json", {
    with: { type: "json" },
  })
).default;
for (const functionName of ["ownerOf", "getAgentWallet"]) {
  const value = await pc.readContract({
    address: registry,
    abi: identityAbi,
    functionName,
    args: [BigInt(agentId)],
  });
  if (String(value).toLowerCase() !== input.agentWallet.toLowerCase())
    throw new Error("IDENTITY_BINDING_MISMATCH");
}
const oracleName =
  input.oracle.mode === "native" ? "NativeIndexOracle" : "SignedMirrorOracle";
const oracleArgs =
  input.oracle.mode === "native"
    ? [input.oracle.source, input.oracle.tokenPriceFeed, methodologyHash]
    : [
        input.publisher,
        methodologyHash,
        input.oracle.sourceChainId,
        input.oracle.sourceContract,
        input.maximumOracleAgeSeconds,
      ];
const plan = {
  chainId: 42220,
  tag: resolveAttributionCode(),
  writesEnabled: false,
  input,
  canonicalIdentity: { registry, agentId },
  oracle: {
    name: oracleName,
    args: oracleArgs,
    bytecode: `0x${a[oracleName].evm.bytecode.object}`,
    abi: a[oracleName].abi,
  },
  vault: {
    name: "TreasuryVault",
    owner: input.owner,
    executor: input.agentWallet,
    methodologyHash,
    bytecode: `0x${a.TreasuryVault.evm.bytecode.object}`,
    abi: a.TreasuryVault.abi,
  },
  funding:
    "Owner wallet funds the reviewed vault with acquired official asset after deployment; no funds are moved by preparation",
};
const planHash = keccak256(stringToHex(stringify(plan)));
fs.mkdirSync(".local", { recursive: true });
fs.writeFileSync(".local/mainnet-plan.json", stringify({ ...plan, planHash }));
if (!process.argv.includes("--broadcast")) {
  console.log(
    stringify({
      status: "REVIEW_REQUIRED",
      planHash,
      artifact: ".local/mainnet-plan.json",
      writesEnabled: false,
    }),
  );
} else {
  if (
    process.env.MODE !== "CELO_MAINNET_PILOT" ||
    process.env.ORACLE_MODE !== input.oracle.mode
  )
    throw new Error("MAINNET_MODE_REQUIRED");
  assertMainnetAuthorization();
  const authorization = JSON.parse(
    fs.readFileSync(process.env.MAINNET_AUTHORIZATION_FILE!, "utf8"),
  );
  if (authorization.planHash !== planHash)
    throw new Error("MAINNET_PLAN_NOT_AUTHORIZED");
  for (const [name, value] of [
    ["MERCHANT_WALLET_ADDRESS", input.owner],
    ["DEPLOYER_WALLET_ADDRESS", input.deployer],
    ["AGENT_WALLET_ADDRESS", input.agentWallet],
    ["PUBLISHER_WALLET_ADDRESS", input.publisher],
    ["RECIPIENT_ADDRESS", input.recipient],
  ])
    if (publicAddress(name).toLowerCase() !== value.toLowerCase())
      throw new Error("MAINNET_ROLE_MISMATCH");
  const c = clients(),
    store = new Store(),
    tag = (data: `0x${string}`) =>
      prepareAttributedTransaction(data, resolveAttributionCode());
  try {
    const oracleReceipt = await durableDispatch(
      store,
      "deploy:oracle",
      c,
      c.deployer,
      {
        data: tag(
          encodeDeployData({
            abi: a[oracleName].abi,
            bytecode: `0x${a[oracleName].evm.bytecode.object}`,
            args: oracleArgs,
          }),
        ),
      },
    );
    if (!oracleReceipt.contractAddress)
      throw new Error("ORACLE_DEPLOYMENT_FAILED");
    const oracle = oracleReceipt.contractAddress;
    const receipt = await durableDispatch(
      store,
      "deploy:vault",
      c,
      c.deployer,
      {
        data: tag(
          encodeDeployData({
            abi: a.TreasuryVault.abi,
            bytecode: `0x${a.TreasuryVault.evm.bytecode.object}`,
            args: [input.owner, input.agentWallet, oracle, methodologyHash],
          }),
        ),
      },
    );
    if (!receipt.contractAddress) throw new Error("VAULT_DEPLOYMENT_FAILED");
    const vault = receipt.contractAddress;
    for (const [name, args] of [
      [
        "setToken",
        [
          token.address,
          token.decimals,
          true,
          BigInt(input.perTxCap),
          BigInt(input.dailyCap),
        ],
      ],
      ["setRecipient", [input.recipient, true]],
      ["configurePolicy", [BigInt(input.maximumOracleAgeSeconds)]],
    ] as const)
      await durableDispatch(store, `policy:${name}`, c, c.owner, {
        to: vault,
        data: tag(
          encodeFunctionData({
            abi: a.TreasuryVault.abi,
            functionName: name,
            args: [...args],
          }),
        ),
      });
    const m: Manifest = {
      chainId: 42220,
      mode: "Celo Mainnet Pilot",
      symbol: token.symbol,
      vault,
      token: token.address as Address,
      oracle,
      owner: input.owner as Address,
      executor: input.agentWallet as Address,
      recipient: input.recipient as Address,
      publisher: input.publisher as Address,
      decimals: token.decimals,
      methodologyHash,
      deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      process.env.DEPLOYMENT_MANIFEST ?? ".local/deployment.json",
      stringify(m),
    );
    store.bind(42220, vault);
    console.log(
      stringify({
        status: "DEPLOYED_WITH_REVIEWED_POLICY",
        manifest: m,
        fundingRequired: true,
      }),
    );
  } finally {
    store.close();
  }
}

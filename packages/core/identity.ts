import {
  encodeFunctionData,
  decodeEventLog,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import abi from "../../config/erc8004/IdentityRegistry.json" with { type: "json" };
import {
  prepareAttributedTransaction,
  assertAttributedCalldata,
} from "./attribution.js";
import { resolveAttributionCode } from "./hackathon.js";
import { Store } from "./storage.js";
const registries: Record<number, Address> = {
  42220: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  11142220: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
};
export async function verifiedRegistry(pc: PublicClient, chainId: number) {
  const registry = registries[chainId];
  if (!registry || (await pc.getChainId()) !== chainId)
    throw new Error("IDENTITY_CHAIN_MISMATCH");
  const code = await pc.getCode({ address: registry });
  if (!code || keccak256(code) !== process.env.REGISTRY_CODE_HASH)
    throw new Error("REGISTRY_CODE_UNVERIFIED");
  const slot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex;
  const implementation = await pc.getStorageAt({ address: registry, slot });
  if (!implementation) throw new Error("REGISTRY_IMPLEMENTATION_UNVERIFIED");
  const address = `0x${implementation.slice(-40)}` as Address,
    implementationCode = await pc.getCode({ address });
  if (
    !implementationCode ||
    keccak256(implementationCode) !==
      process.env.REGISTRY_IMPLEMENTATION_CODE_HASH
  )
    throw new Error("REGISTRY_IMPLEMENTATION_UNVERIFIED");
  return registry;
}
export function registrationMetadata(origin?: string) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "LUKAS Treasury",
    description:
      "Owner-authorized LUKAS obligations and local-currency settlement; JACK-inspired financial runtime",
    services: origin ? [{ name: "web", endpoint: origin }] : [],
    active: false,
    x402Support: false,
    registrations: [],
  };
}
export async function prepareIdentity(
  pc: PublicClient,
  chainId: number,
  wallet: Address,
  uri: string,
) {
  if (!uri.startsWith("https://")) throw new Error("HTTPS_METADATA_REQUIRED");
  const registry = await verifiedRegistry(pc, chainId);
  const response = await fetch(uri, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("METADATA_UNRESOLVED");
  const metadata = (await response.json()) as any;
  if (
    metadata.type !==
      "https://eips.ethereum.org/EIPS/eip-8004#registration-v1" ||
    typeof metadata.name !== "string" ||
    !Array.isArray(metadata.services) ||
    !Array.isArray(metadata.registrations) ||
    typeof metadata.active !== "boolean"
  )
    throw new Error("METADATA_INVALID");
  return {
    chainId,
    from: wallet,
    to: registry,
    value: "0x0",
    data: prepareAttributedTransaction(
      encodeFunctionData({ abi, functionName: "register", args: [uri] }),
      resolveAttributionCode(),
    ),
    metadataUri: uri,
    status: "REQUIRES_AGENT_WALLET_SIGNATURE",
  };
}
export async function verifyIdentity(
  store: Store,
  pc: PublicClient,
  chainId: number,
  wallet: Address,
  hash: Hex,
) {
  const registry = await verifiedRegistry(pc, chainId),
    receipt = await pc.getTransactionReceipt({ hash }),
    tx = await pc.getTransaction({ hash });
  if (
    receipt.status !== "success" ||
    tx.from.toLowerCase() !== wallet.toLowerCase() ||
    tx.to?.toLowerCase() !== registry.toLowerCase()
  )
    throw new Error("IDENTITY_TRANSACTION_MISMATCH");
  assertAttributedCalldata(tx.input, resolveAttributionCode());
  if (
    (await pc.getBlock({ blockNumber: receipt.blockNumber })).hash !==
    receipt.blockHash
  )
    throw new Error("IDENTITY_REORG");
  let registration: any;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi, data: log.data, topics: log.topics });
      if (event.eventName === "Registered") registration = event.args;
    } catch {}
  }
  if (
    !registration ||
    registration.owner.toLowerCase() !== wallet.toLowerCase()
  )
    throw new Error("IDENTITY_EVENT_MISSING");
  const [owner, boundWallet, uri] = await Promise.all(
    ["ownerOf", "getAgentWallet", "tokenURI"].map((functionName) =>
      pc.readContract({
        address: registry,
        abi,
        functionName,
        args: [registration.agentId],
      }),
    ),
  );
  if (
    String(owner).toLowerCase() !== wallet.toLowerCase() ||
    String(boundWallet).toLowerCase() !== wallet.toLowerCase() ||
    String(uri) !== registration.agentURI
  )
    throw new Error("IDENTITY_BINDING_MISMATCH");
  await prepareIdentity(pc, chainId, wallet, String(uri));
  store.db
    .prepare("INSERT OR REPLACE INTO agent_registrations VALUES(?,?,?,?,?,?)")
    .run(
      chainId,
      registry,
      registration.agentId.toString(),
      wallet,
      hash,
      String(uri),
    );
  store.audit({
    event: "IDENTITY_VERIFIED",
    chainId,
    registry,
    agentId: registration.agentId,
    transactionHash: hash,
  });
  return {
    chainId,
    registry,
    agentId: registration.agentId.toString(),
    wallet,
    transactionHash: hash,
    metadataUri: String(uri),
  };
}

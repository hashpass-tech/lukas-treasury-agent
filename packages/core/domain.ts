import { keccak256, stringToHex, type Address, type Hex } from "viem";
export const WAD = 10n ** 18n;
export const methodologyHash = keccak256(
  stringToHex(
    "lukas-raw-currency-basket:v1:BRL4000,MXN3000,COP1500,CLP1000,ARS500",
  ),
);
export const weights = {
  BRL: 4000,
  MXN: 3000,
  COP: 1500,
  CLP: 1000,
  ARS: 500,
} as const;
export type Component = {
  currency: keyof typeof weights;
  weightBps: number;
  usdWad: string;
  updatedAt: number;
};
export type Snapshot = {
  snapshotId: string;
  methodologyHash: Hex;
  sourceChainId: number;
  sourceContract: Address;
  sourceBlockNumber: string;
  sourceBlockHash: Hex;
  observedAt: number;
  oldestComponentUpdatedAt: number;
  indexUsdWad: string;
  components: Component[];
  trustMode: "fixture";
  provenance: string;
};
export function quote(
  amount: bigint,
  index: bigint,
  price: bigint,
  decimals: number,
): bigint {
  if (
    amount <= 0n ||
    amount > 10n ** 30n ||
    index <= 0n ||
    index > 10n ** 24n ||
    price <= 0n ||
    price > 10n ** 24n ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18
  )
    throw new Error("INVALID_AMOUNT_OR_PRICE");
  const numerator = amount * index * 10n ** BigInt(decimals),
    denominator = WAD * price;
  return (numerator + denominator - 1n) / denominator;
}
export function validateSnapshot(s: Snapshot, now: number, maxAge = 300) {
  if (
    s.methodologyHash !== methodologyHash ||
    s.trustMode !== "fixture" ||
    s.sourceChainId !== 31337
  )
    throw new Error("METHODOLOGY_OR_CHAIN");
  if (
    s.components.length !== 5 ||
    new Set(s.components.map((c) => c.currency)).size !== 5
  )
    throw new Error("MISSING_COMPONENT");
  for (const c of s.components) {
    if (
      c.weightBps !== weights[c.currency] ||
      BigInt(c.usdWad) <= 0n ||
      BigInt(c.usdWad) > 10n ** 24n
    )
      throw new Error("INVALID_COMPONENT");
    if (
      !Number.isInteger(c.updatedAt) ||
      c.updatedAt > now ||
      now - c.updatedAt > maxAge
    )
      throw new Error("PRICE_STALE");
  }
  const oldest = Math.min(...s.components.map((c) => c.updatedAt));
  const index =
    s.components.reduce(
      (sum, c) => sum + BigInt(c.usdWad) * BigInt(c.weightBps),
      0n,
    ) / 10000n;
  if (
    oldest !== s.oldestComponentUpdatedAt ||
    s.observedAt > now ||
    now - s.observedAt > maxAge ||
    index !== BigInt(s.indexUsdWad)
  )
    throw new Error("INVALID_SNAPSHOT");
}
export const intentTypes = {
  Intent: [
    { name: "obligationId", type: "bytes32" },
    { name: "vault", type: "address" },
    { name: "referenceToken", type: "address" },
    { name: "settlementToken", type: "address" },
    { name: "recipient", type: "address" },
    { name: "amountLukasWad", type: "uint256" },
    { name: "maxSettlementAtomic", type: "uint256" },
    { name: "validAfter", type: "uint64" },
    { name: "deadline", type: "uint64" },
    { name: "policyEpoch", type: "uint256" },
    { name: "methodologyHash", type: "bytes32" },
    { name: "salt", type: "bytes32" },
  ],
} as const;
export type Intent = {
  obligationId: Hex;
  vault: Address;
  referenceToken: Address;
  settlementToken: Address;
  recipient: Address;
  amountLukasWad: bigint;
  maxSettlementAtomic: bigint;
  validAfter: bigint;
  deadline: bigint;
  policyEpoch: bigint;
  methodologyHash: Hex;
  salt: Hex;
};
export const domain = (chainId: number, vault: Address) => ({
  name: "LUKAS Treasury",
  version: "1",
  chainId,
  verifyingContract: vault,
});
export const transitions: Record<string, string[]> = {
  DRAFT: ["AWAITING_AUTHORIZATION"],
  AWAITING_AUTHORIZATION: ["SCHEDULED"],
  SCHEDULED: ["EVALUATING"],
  EVALUATING: ["BLOCKED", "PREPARED", "EXPIRED"],
  BLOCKED: ["EVALUATING"],
  PREPARED: ["SUBMITTED", "BLOCKED"],
  SUBMITTED: ["RECONCILED", "FAILED"],
};
export function checkTransition(from: string, to: string) {
  if (!transitions[from]?.includes(to))
    throw new Error(`ILLEGAL_TRANSITION:${from}:${to}`);
}
export const stringify = (v: unknown) =>
  JSON.stringify(v, (_, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
export function parseIntent(v: Record<string, string>): Intent {
  return {
    ...v,
    amountLukasWad: BigInt(v.amountLukasWad),
    maxSettlementAtomic: BigInt(v.maxSettlementAtomic),
    validAfter: BigInt(v.validAfter),
    deadline: BigInt(v.deadline),
    policyEpoch: BigInt(v.policyEpoch),
  } as Intent;
}

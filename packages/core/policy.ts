import { type Address } from "viem";
import {
  type Intent,
  type Snapshot,
  quote,
  validateSnapshot,
} from "./domain.js";

export type Authority = "OBSERVE" | "PROPOSE" | "EXECUTE_AUTHORIZED";
export type Policy = {
  chainId: number;
  vault: Address;
  owner: Address;
  executor: Address;
  policyEpoch: string;
  paused: boolean;
  allowedTokens: Address[];
  allowedRecipients: Address[];
  perTxCap: string;
  dailyCap: string;
  maximumOracleAgeSeconds: number;
  maximumQuoteAgeSeconds: number;
  maximumGasCostNativeAtomic: string;
  maximumRetries: number;
  validUntil: number;
};
export type Decision = {
  decision:
    | "ALLOW"
    | "REQUIRE_NEW_AUTHORIZATION"
    | "BLOCKED_RETRYABLE"
    | "BLOCKED_TERMINAL";
  reasons: string[];
  amount?: string;
  evidence: Record<string, string | number | boolean>;
};
export function evaluatePolicy(input: {
  intent: Intent;
  policy: Policy;
  snapshot: Snapshot;
  now: number;
  tokenPriceWad: bigint;
  decimals: number;
  balance: bigint;
  dailySpent: bigint;
  reserved: bigint;
  paid: boolean;
  canceled: boolean;
  gasBalance: bigint;
  authority: Authority;
}): Decision {
  const { intent: i, policy: p } = input;
  const reject = (
    decision: Decision["decision"],
    reason: string,
  ): Decision => ({
    decision,
    reasons: [reason],
    evidence: {
      chainId: p.chainId,
      policyEpoch: p.policyEpoch,
      evaluatedAt: input.now,
    },
  });
  if (input.authority !== "EXECUTE_AUTHORIZED")
    return reject("BLOCKED_TERMINAL", "AUTHORITY_REQUIRED");
  if (input.paid) return reject("BLOCKED_TERMINAL", "DUPLICATE_PAYMENT");
  if (input.canceled) return reject("BLOCKED_TERMINAL", "CANCELED_ONCHAIN");
  if (i.vault.toLowerCase() !== p.vault.toLowerCase())
    return reject("BLOCKED_TERMINAL", "CHAIN_MISMATCH");
  if (p.paused) return reject("BLOCKED_RETRYABLE", "PAUSED");
  if (input.now > p.validUntil || BigInt(input.now) > i.deadline)
    return reject("REQUIRE_NEW_AUTHORIZATION", "EXPIRED_AUTHORIZATION");
  if (i.policyEpoch.toString() !== p.policyEpoch)
    return reject("REQUIRE_NEW_AUTHORIZATION", "POLICY_EPOCH_CHANGED");
  if (
    !p.allowedTokens.some(
      (t) => t.toLowerCase() === i.settlementToken.toLowerCase(),
    )
  )
    return reject("BLOCKED_TERMINAL", "TOKEN_NOT_ALLOWED");
  if (
    !p.allowedRecipients.some(
      (t) => t.toLowerCase() === i.recipient.toLowerCase(),
    )
  )
    return reject("BLOCKED_TERMINAL", "RECIPIENT_NOT_ALLOWED");
  try {
    validateSnapshot(
      input.snapshot,
      input.now,
      p.maximumOracleAgeSeconds,
      p.chainId,
      Number(process.env.SOURCE_CHAIN_ID || p.chainId),
    );
  } catch (error) {
    return reject(
      "BLOCKED_RETRYABLE",
      (error as Error).message === "PRICE_STALE"
        ? "PRICE_STALE"
        : "METHODOLOGY_MISMATCH",
    );
  }
  const amount = quote(
    i.amountLukasWad,
    BigInt(input.snapshot.indexUsdWad),
    input.tokenPriceWad,
    input.decimals,
  );
  if (amount > i.maxSettlementAtomic)
    return reject("REQUIRE_NEW_AUTHORIZATION", "MAX_SETTLEMENT_EXCEEDED");
  if (amount > BigInt(p.perTxCap))
    return reject("BLOCKED_TERMINAL", "PER_TX_CAP_EXCEEDED");
  if (amount + input.dailySpent + input.reserved > BigInt(p.dailyCap))
    return reject("BLOCKED_RETRYABLE", "DAILY_CAP_EXCEEDED");
  if (amount > input.balance)
    return reject("BLOCKED_RETRYABLE", "INSUFFICIENT_BALANCE");
  if (input.gasBalance < BigInt(p.maximumGasCostNativeAtomic))
    return reject("BLOCKED_RETRYABLE", "INSUFFICIENT_GAS");
  return {
    decision: "ALLOW",
    reasons: [],
    amount: amount.toString(),
    evidence: {
      evaluatedAt: input.now,
      snapshotId: input.snapshot.snapshotId,
      sourceUpdatedAt: input.snapshot.oldestComponentUpdatedAt,
      policyEpoch: p.policyEpoch,
    },
  };
}

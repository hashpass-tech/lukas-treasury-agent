import {
  type AtomicAmount,
  type CampaignPolicy,
  type CommissionAllocation,
  type PolicyWindow,
  cloneSnapshot,
} from "./domain";

export const BPS_SCALE = 10_000;

export const integerBps = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= BPS_SCALE;

const nonNegativeAtomic = (value: AtomicAmount | undefined): boolean =>
  value === undefined || (typeof value === "bigint" && value >= 0n);

const validWindow = (window: PolicyWindow | undefined): boolean =>
  window === undefined ||
  ((window.startsAt === undefined ||
    (Number.isInteger(window.startsAt) && window.startsAt >= 0)) &&
    (window.endsAt === undefined ||
      (Number.isInteger(window.endsAt) && window.endsAt >= 0)) &&
    (window.startsAt === undefined ||
      window.endsAt === undefined ||
      window.startsAt < window.endsAt));

const assertIdentifier = (value: string | undefined, error: string): void => {
  if (value !== undefined && value.trim().length === 0) throw new Error(error);
};

/** Validate all policy fields before they can become a committed snapshot. */
export const validateCampaignPolicy = (policy: CampaignPolicy): void => {
  if (policy.version.trim().length === 0) throw new Error("INVALID_POLICY");
  if (
    !integerBps(policy.principalBps) ||
    !integerBps(policy.promoterBps) ||
    !integerBps(policy.platformBps) ||
    !integerBps(policy.feeBps ?? 0) ||
    policy.principalBps +
      policy.promoterBps +
      policy.platformBps +
      (policy.feeBps ?? 0) >
      BPS_SCALE
  )
    throw new Error("INVALID_POLICY");

  for (const [role, recipient] of Object.entries(policy.recipients ?? {})) {
    if (
      !recipient ||
      recipient.role !== role ||
      recipient.recipientId.trim().length === 0
    )
      throw new Error("INVALID_POLICY_RECIPIENT");
  }
  assertIdentifier(policy.feeRecipientId, "INVALID_POLICY_RECIPIENT");
  if ((policy.feeBps ?? 0) > 0 && !policy.feeRecipientId) {
    throw new Error("FEE_RECIPIENT_REQUIRED");
  }

  for (const amount of [
    policy.maxBudgetAtomic,
    policy.maxExposureAtomic,
    policy.minUnitPriceAtomic,
    policy.minPrincipalAtomic,
    policy.maxGasAtomic,
  ]) {
    if (!nonNegativeAtomic(amount)) throw new Error("INVALID_POLICY_AMOUNT");
  }
  if (
    (policy.maxCapacity !== undefined &&
      (!Number.isInteger(policy.maxCapacity) || policy.maxCapacity <= 0)) ||
    (policy.quoteWindow !== undefined && !validWindow(policy.quoteWindow)) ||
    (policy.activityWindow !== undefined &&
      !validWindow(policy.activityWindow)) ||
    (policy.checkInWindow !== undefined &&
      !validWindow(policy.checkInWindow)) ||
    (policy.releaseWindow !== undefined && !validWindow(policy.releaseWindow))
  )
    throw new Error("INVALID_POLICY_LIMIT");
  if (
    policy.asset &&
    (policy.asset.tokenId.trim().length === 0 ||
      !Number.isInteger(policy.asset.decimals) ||
      policy.asset.decimals < 0 ||
      policy.asset.decimals > 36 ||
      (policy.asset.chainId !== undefined &&
        policy.asset.chainId.trim().length === 0))
  )
    throw new Error("INVALID_ASSET_BINDING");
};

export const policySnapshot = (policy: CampaignPolicy): CampaignPolicy => {
  validateCampaignPolicy(policy);
  return cloneSnapshot({ schemaVersion: "commerce.v1", ...policy });
};

export const assertPolicyWindow = (
  now: number,
  window: PolicyWindow | undefined,
  error = "POLICY_WINDOW_CLOSED",
): void => {
  if (window?.startsAt !== undefined && now < window.startsAt)
    throw new Error(error);
  if (window?.endsAt !== undefined && now >= window.endsAt)
    throw new Error(error);
};

export const assertActivityPolicy = (
  policy: CampaignPolicy,
  input: { now: number; capacity: number; unitPriceAtomic: AtomicAmount },
): void => {
  validateCampaignPolicy(policy);
  if (policy.paused) throw new Error("POLICY_PAUSED");
  if (policy.cancelled) throw new Error("POLICY_CANCELLED");
  if (policy.maxCapacity !== undefined && input.capacity > policy.maxCapacity)
    throw new Error("CAPACITY_LIMIT_EXCEEDED");
  if (
    policy.minUnitPriceAtomic !== undefined &&
    input.unitPriceAtomic < policy.minUnitPriceAtomic
  )
    throw new Error("PRICE_FLOOR_VIOLATION");
  assertActivityWindow(policy, input.now);
};

export const assertActivityWindow = (
  policy: CampaignPolicy,
  now: number,
): void =>
  assertPolicyWindow(now, policy.activityWindow, "ACTIVITY_WINDOW_CLOSED");

export const assertQuoteTtl = (
  policy: CampaignPolicy,
  issuedAt: number,
  expiresAt: number,
): void => {
  if (!Number.isInteger(issuedAt) || !Number.isInteger(expiresAt))
    throw new Error("INVALID_QUOTE_TTL");
  if (expiresAt <= issuedAt) throw new Error("INVALID_QUOTE_TTL");
  assertPolicyWindow(issuedAt, policy.quoteWindow, "QUOTE_WINDOW_CLOSED");
  if (
    policy.quoteWindow?.endsAt !== undefined &&
    expiresAt > policy.quoteWindow.endsAt
  )
    throw new Error("QUOTE_WINDOW_EXCEEDED");
};

/**
 * Allocate a paid amount with integer floor rounding.  The remainder is
 * explicit and stays in the principal custody bucket; a separately
 * prefunded fee is recorded independently when feeBps is configured.
 */
export const allocateAtomic = (
  totalAtomic: AtomicAmount,
  policy: CampaignPolicy,
): CommissionAllocation => {
  validateCampaignPolicy(policy);
  if (totalAtomic < 0n) throw new Error("INVALID_AMOUNT");
  const principalAtomic =
    (totalAtomic * BigInt(policy.principalBps)) / BigInt(BPS_SCALE);
  const promoterAtomic =
    (totalAtomic * BigInt(policy.promoterBps)) / BigInt(BPS_SCALE);
  const platformAtomic =
    (totalAtomic * BigInt(policy.platformBps)) / BigInt(BPS_SCALE);
  const feeAtomic =
    (totalAtomic * BigInt(policy.feeBps ?? 0)) / BigInt(BPS_SCALE);
  const remainderAtomic =
    totalAtomic - principalAtomic - promoterAtomic - platformAtomic - feeAtomic;
  return {
    principalAtomic,
    promoterAtomic,
    platformAtomic,
    remainderAtomic,
    totalAtomic,
    feeAtomic,
  };
};

export const allocationConserves = (
  allocation: CommissionAllocation,
): boolean =>
  allocation.totalAtomic ===
  allocation.principalAtomic +
    allocation.promoterAtomic +
    allocation.platformAtomic +
    (allocation.feeAtomic ?? 0n) +
    allocation.remainderAtomic;

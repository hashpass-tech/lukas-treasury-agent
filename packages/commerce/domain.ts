/**
 * Transport-neutral commerce values.
 *
 * The domain speaks in opaque identifiers and atomic integers.  Adapters may
 * map these values to HTTP, queues, partner passes, or a chain without
 * changing the accounting rules.  Optional policy fields keep the original
 * internal MVP fixtures source compatible while allowing a fuller campaign
 * contract to be adopted incrementally.
 */

export type AtomicAmount = bigint;

export type PolicyRecipientRole = "principal" | "promoter" | "platform" | "fee";

export type PolicyRecipient = {
  recipientId: string;
  role: PolicyRecipientRole;
};

export type PolicyWindow = {
  startsAt?: number;
  endsAt?: number;
};

export type AssetBinding = {
  chainId?: string;
  tokenId: string;
  decimals: number;
};

export type CampaignPolicy = {
  /** Monotonic, never-reused policy identifier scoped to an activity. */
  version: string;
  /** Stable contract marker for future ally adapters. */
  schemaVersion?: "commerce.v1";
  principalBps: number;
  promoterBps: number;
  platformBps: number;
  /** Explicit identities make attribution auditable across transports. */
  recipients?: Partial<Record<PolicyRecipientRole, PolicyRecipient>>;
  feeRecipientId?: string;
  /** Limits are optional for the legacy MVP profile and strict when present. */
  feeBps?: number;
  maxBudgetAtomic?: AtomicAmount;
  maxExposureAtomic?: AtomicAmount;
  maxCapacity?: number;
  minUnitPriceAtomic?: AtomicAmount;
  minPrincipalAtomic?: AtomicAmount;
  maxGasAtomic?: AtomicAmount;
  quoteWindow?: PolicyWindow;
  activityWindow?: PolicyWindow;
  checkInWindow?: PolicyWindow;
  releaseWindow?: PolicyWindow;
  /** Bind the committed terms to the selected asset and decimal scale. */
  asset?: AssetBinding;
  paused?: boolean;
  cancelled?: boolean;
};

export type CommercePolicy = CampaignPolicy;

export type ActivityStatus = "DRAFT" | "ACTIVE";

export type Activity = {
  activityId: string;
  tenantId: string;
  title: string;
  locale: string;
  currency: string;
  capacity: number;
  unitPriceAtomic: AtomicAmount;
  approvedPromoterIds: string[];
  policy: CampaignPolicy;
  status: ActivityStatus;
};

export type Promoter = {
  promoterId: string;
  tenantId: string;
  status: "APPROVED" | "SUSPENDED";
};

export type Offer = {
  offerId: string;
  activityId: string;
  tenantId: string;
  promoterId: string;
  policyVersion: string;
  unitPriceAtomic: AtomicAmount;
  availableQuantity: number;
  locale: string;
  currency: string;
};

export type Decision = {
  decisionId: string;
  activityId: string;
  tenantId: string;
  policyVersion: string;
  allowed: boolean;
  reasonCode: string;
  decidedAt: number;
};

export type Quote = {
  quoteId: string;
  offerId: string;
  activityId: string;
  tenantId: string;
  buyerId: string;
  promoterId: string;
  quantity: number;
  unitPriceAtomic: AtomicAmount;
  totalAtomic: AtomicAmount;
  policyVersion: string;
  issuedAt: number;
  expiresAt: number;
  status: "OPEN" | "RESERVED" | "EXPIRED";
};

export type Reservation = {
  reservationId: string;
  quoteId: string;
  activityId: string;
  tenantId: string;
  buyerId: string;
  promoterId: string;
  quantity: number;
  totalAtomic: AtomicAmount;
  policyVersion: string;
  expiresAt: number;
  status: "HELD" | "CONFIRMED" | "RELEASED";
  releasedAt?: number;
  releaseReason?: "expired" | "unpaid";
};

export type Booking = {
  bookingId: string;
  reservationId: string;
  paymentId: string;
  activityId: string;
  tenantId: string;
  buyerId: string;
  promoterId: string;
  quantity: number;
  paidAtomic: AtomicAmount;
  policyVersion: string;
  bookedAt: number;
  passId?: string;
  checkedInAt?: number;
};

export type PaymentAttempt = {
  paymentId: string;
  reservationId: string;
  bookingId: string;
  eventId: string;
  tenantId: string;
  amountAtomic: AtomicAmount;
  policyVersion: string;
  confirmedAt: number;
};

export type Pass = {
  passId: string;
  bookingId: string;
  activityId: string;
  tenantId: string;
  holderId: string;
  policyVersion: string;
  issuedAt: number;
  checkedInAt?: number;
};

export type AttendanceAttestation = {
  checkInId: string;
  passId: string;
  bookingId: string;
  activityId: string;
  tenantId: string;
  checkedInAt: number;
  policyVersion: string;
};

export type CommissionAllocation = {
  principalAtomic: AtomicAmount;
  promoterAtomic: AtomicAmount;
  platformAtomic: AtomicAmount;
  remainderAtomic: AtomicAmount;
  totalAtomic: AtomicAmount;
  /** Optional fee allocation bucket; a partner may fund it separately. */
  feeAtomic?: AtomicAmount;
};

export type Refund = {
  refundId: string;
  bookingId: string;
  tenantId: string;
  amountAtomic: AtomicAmount;
  reason: "cancelled" | "no-show" | "dispute" | "expired";
  policyVersion: string;
  createdAt: number;
};

export type SettlementReceipt = CommissionAllocation & {
  settlementId: string;
  bookingId: string;
  tenantId: string;
  policyVersion: string;
  promoterPaidAtomic: AtomicAmount;
  platformPaidAtomic: AtomicAmount;
  feePaidAtomic: AtomicAmount;
  outstandingAtomic: AtomicAmount;
  settledAt: number;
};

/**
 * Clone a domain value before returning it from an adapter.  This prevents a
 * caller from mutating the committed policy, quote, reservation, or booking
 * held by an implementation that uses in-memory state.
 */
export const cloneSnapshot = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneSnapshot) as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value))
    result[key] = cloneSnapshot(item);
  return result as T;
};

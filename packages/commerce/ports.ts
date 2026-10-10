/**
 * Transport-neutral commerce contracts.
 *
 * These contracts intentionally deal in opaque identifiers and integer atomic
 * amounts.  An HTTP, queue, HashPass, or chain adapter can implement them
 * without changing the policy or accounting layer.
 */

import type {
  AtomicAmount as DomainAtomicAmount,
  CommercePolicy as DomainCommercePolicy,
} from "./domain";

export type AtomicAmount = DomainAtomicAmount;
export type CommerceRole =
  | "operator"
  | "delegate"
  | "promoter"
  | "buyer"
  | "system";

export type CommerceCapability =
  | "activity-setup"
  | "offer-evaluation"
  | "quote-and-reservation"
  | "payment-confirmation"
  | "pass-issuance"
  | "single-use-check-in"
  | "commission-settlement"
  | "remote-payment"
  | "hashpass-native-pass";

export type AdapterCapability = {
  capability: CommerceCapability;
  supported: boolean;
  reason?: string;
};

export type AdapterCapabilities = {
  contractVersion: "commerce.v1";
  adapterId: string;
  capabilities: AdapterCapability[];
};

export type ActorContext = {
  tenantId: string;
  role: CommerceRole;
};

export type CommercePolicy = DomainCommercePolicy;

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
  policy: CommercePolicy;
  status: ActivityStatus;
};

export type SetupActivityInput = ActorContext & {
  activityId: string;
  title: string;
  locale: string;
  currency: string;
  capacity: number;
  unitPriceAtomic: AtomicAmount;
  approvedPromoterIds: string[];
  policy: CommercePolicy;
};

export type ActivateActivityInput = ActorContext & {
  activityId: string;
  policyVersion: string;
  idempotencyKey: string;
};

export type UpdatePolicyInput = ActorContext & {
  activityId: string;
  policy: CommercePolicy;
  idempotencyKey: string;
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

export type CreateOfferInput = ActorContext & {
  activityId: string;
  promoterId: string;
  policyVersion: string;
  idempotencyKey: string;
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

export type CreateQuoteInput = ActorContext & {
  offerId: string;
  buyerId: string;
  quantity: number;
  policyVersion: string;
  ttlSeconds: number;
  idempotencyKey: string;
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

export type ReserveInput = ActorContext & {
  quoteId: string;
  policyVersion: string;
  idempotencyKey: string;
};

export type ReconcileReservationInput = ActorContext & {
  reservationId: string;
  reason: "expired" | "unpaid";
  idempotencyKey: string;
};

export type PaymentConfirmation = {
  paymentId: string;
  reservationId: string;
  bookingId: string;
  eventId: string;
  tenantId: string;
  amountAtomic: AtomicAmount;
  policyVersion: string;
  confirmedAt: number;
};

export type ConfirmPaymentInput = ActorContext & {
  reservationId: string;
  paymentEventId: string;
  amountAtomic: AtomicAmount;
  policyVersion: string;
  idempotencyKey: string;
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

export type IssuePassInput = ActorContext & {
  bookingId: string;
  policyVersion: string;
  idempotencyKey: string;
};

export type CheckIn = {
  checkInId: string;
  passId: string;
  bookingId: string;
  activityId: string;
  tenantId: string;
  checkedInAt: number;
  policyVersion: string;
};

export type CheckInInput = ActorContext & {
  passId: string;
  checkInEventId: string;
  policyVersion: string;
  idempotencyKey: string;
};

export type Allocation = {
  principalAtomic: AtomicAmount;
  promoterAtomic: AtomicAmount;
  platformAtomic: AtomicAmount;
  remainderAtomic: AtomicAmount;
  totalAtomic: AtomicAmount;
  /** Optional fee allocation bucket; a partner may fund it separately. */
  feeAtomic?: AtomicAmount;
};

export type SettlementStatus = "SETTLED" | "PARTIAL" | "FAILED";

export type Settlement = Allocation & {
  settlementId: string;
  bookingId: string;
  tenantId: string;
  policyVersion: string;
  promoterPaidAtomic: AtomicAmount;
  platformPaidAtomic: AtomicAmount;
  feePaidAtomic: AtomicAmount;
  outstandingAtomic: AtomicAmount;
  status: SettlementStatus;
  settledAt: number;
};

export type SettleInput = ActorContext & {
  bookingId: string;
  policyVersion: string;
  availableBudgetAtomic: AtomicAmount;
  idempotencyKey: string;
};

export type CommerceEvent = {
  schemaVersion: "commerce.v1";
  eventId: string;
  type:
    | "activity.created"
    | "activity.activated"
    | "policy.updated"
    | "offer.created"
    | "quote.created"
    | "reservation.created"
    | "reservation.released"
    | "payment.confirmed"
    | "pass.issued"
    | "check-in.completed"
    | "settlement.recorded";
  tenantId: string;
  role: CommerceRole;
  policyVersion: string;
  idempotencyKey?: string;
  occurredAt: number;
  payload: Record<string, string>;
};

export type CommerceReceipt<T> = {
  receiptId: string;
  event: CommerceEvent;
  result: T;
};

export type ReportBooking = {
  bookingId: string;
  buyerId: string;
  promoterId: string;
  quantity: number;
  paidAtomic: AtomicAmount;
  policyVersion: string;
  checkInAt?: number;
  settlement?: Settlement;
};

export type CommerceReport = {
  tenantId: string;
  activityId: string;
  capacity: number;
  heldQuantity: number;
  confirmedQuantity: number;
  paidAtomic: AtomicAmount;
  principalAtomic: AtomicAmount;
  promoterDueAtomic: AtomicAmount;
  platformDueAtomic: AtomicAmount;
  feeDueAtomic: AtomicAmount;
  promoterPaidAtomic: AtomicAmount;
  platformPaidAtomic: AtomicAmount;
  feePaidAtomic: AtomicAmount;
  remainderAtomic: AtomicAmount;
  outstandingAtomic: AtomicAmount;
  allocationReconciled: boolean;
  bookings: ReportBooking[];
  events: CommerceEvent[];
};

export interface CommerceAdapter {
  capabilities(): AdapterCapabilities;
  supports(capability: CommerceCapability): AdapterCapability;
  setupActivity(input: SetupActivityInput): Activity;
  activateActivity(input: ActivateActivityInput): CommerceReceipt<Activity>;
  updatePolicy(input: UpdatePolicyInput): CommerceReceipt<Activity>;
  createOffer(input: CreateOfferInput): CommerceReceipt<Offer>;
  createQuote(input: CreateQuoteInput): CommerceReceipt<Quote>;
  reserve(input: ReserveInput): CommerceReceipt<Reservation>;
  reconcileReservation(
    input: ReconcileReservationInput,
  ): CommerceReceipt<Reservation>;
  report(input: ActorContext & { activityId: string }): CommerceReport;
}

export interface PaymentRailAdapter {
  capabilities(): AdapterCapabilities;
  supports(capability: CommerceCapability): AdapterCapability;
  confirmPayment(
    input: ConfirmPaymentInput,
  ): CommerceReceipt<PaymentConfirmation>;
}

export interface PassAdapter {
  capabilities(): AdapterCapabilities;
  supports(capability: CommerceCapability): AdapterCapability;
  issuePass(input: IssuePassInput): CommerceReceipt<Pass>;
  checkIn(input: CheckInInput): CommerceReceipt<CheckIn>;
  settle(input: SettleInput): CommerceReceipt<Settlement>;
}

export type {
  Activity as DomainActivity,
  AttendanceAttestation,
  CampaignPolicy,
  CommissionAllocation,
  Decision,
  PaymentAttempt,
  Promoter,
  Refund,
  SettlementReceipt,
} from "./domain";

import {
  type Activity,
  type AdapterCapabilities,
  type AdapterCapability,
  type Allocation,
  type CommerceAdapter,
  type CommerceCapability,
  type CommerceEvent,
  type CommercePolicy,
  type CommerceReceipt,
  type CommerceReport,
  type ConfirmPaymentInput,
  type CreateOfferInput,
  type CreateQuoteInput,
  type CheckIn,
  type CheckInInput,
  type IssuePassInput,
  type Offer,
  type Pass,
  type PaymentRailAdapter,
  type PaymentConfirmation,
  type ReconcileReservationInput,
  type Reservation,
  type ReserveInput,
  type ReportBooking,
  type SettleInput,
  type Settlement,
  type SetupActivityInput,
  type UpdatePolicyInput,
} from "./ports";
import type { Booking, Quote } from "./ports";
import { cloneSnapshot } from "./domain";
import {
  allocateAtomic,
  assertActivityPolicy,
  assertActivityWindow,
  assertPolicyWindow,
  assertQuoteTtl,
  policySnapshot,
  validateCampaignPolicy,
} from "./policy";

export interface Clock {
  now(): number;
}

export class DeterministicClock implements Clock {
  public constructor(private currentTime: number) {
    if (!Number.isInteger(currentTime) || currentTime < 0)
      throw new Error("INVALID_CLOCK");
  }

  public now(): number {
    return this.currentTime;
  }

  public advance(seconds: number): void {
    if (!Number.isInteger(seconds) || seconds < 0)
      throw new Error("INVALID_CLOCK_ADVANCE");
    this.currentTime += seconds;
  }
}

const ALL_CAPABILITIES: CommerceCapability[] = [
  "activity-setup",
  "offer-evaluation",
  "quote-and-reservation",
  "payment-confirmation",
  "pass-issuance",
  "single-use-check-in",
  "commission-settlement",
  "remote-payment",
  "hashpass-native-pass",
];

const LOCAL_CAPABILITIES = new Set<CommerceCapability>([
  "activity-setup",
  "offer-evaluation",
  "quote-and-reservation",
  "payment-confirmation",
  "pass-issuance",
  "single-use-check-in",
  "commission-settlement",
]);

const validatePolicy = validateCampaignPolicy;

const allocationFor = (
  totalAtomic: bigint,
  policy: CommercePolicy,
): Allocation => {
  return allocateAtomic(totalAtomic, policy);
};

const json = (value: unknown) =>
  JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

export class SimulationCommerceAdapter
  implements CommerceAdapter, PaymentRailAdapter
{
  public readonly adapterId: string = "simulation-commerce-v1";
  private readonly clock: Clock;
  private sequence = 0;
  private readonly activities = new Map<string, Activity>();
  private readonly offers = new Map<string, Offer>();
  private readonly quotes = new Map<string, Quote>();
  private readonly reservations = new Map<string, Reservation>();
  private readonly payments = new Map<string, PaymentConfirmation>();
  private readonly bookings = new Map<string, Booking>();
  private readonly passes = new Map<string, Pass>();
  private readonly checkIns = new Map<string, CheckIn>();
  private readonly settlements = new Map<string, Settlement>();
  private readonly policyHistory = new Map<string, CommercePolicy>();
  private readonly usedIdempotencyKeys = new Set<string>();
  private readonly usedPaymentEvents = new Set<string>();
  private readonly usedCheckInEvents = new Set<string>();
  private readonly reconciliationReceipts = new Map<
    string,
    CommerceReceipt<Reservation>
  >();
  private readonly events: CommerceEvent[] = [];

  public constructor(options: { clock?: Clock; adapterId?: string } = {}) {
    this.clock = options.clock ?? { now: () => Math.floor(Date.now() / 1000) };
    if (options.adapterId) this.adapterId = options.adapterId;
  }

  public capabilities(): AdapterCapabilities {
    return {
      contractVersion: "commerce.v1",
      adapterId: this.adapterId,
      capabilities: ALL_CAPABILITIES.map((capability) =>
        this.supports(capability),
      ),
    };
  }

  public supports(capability: CommerceCapability): AdapterCapability {
    if (LOCAL_CAPABILITIES.has(capability))
      return { capability, supported: true };
    return {
      capability,
      supported: false,
      reason:
        capability === "hashpass-native-pass"
          ? "The local simulator has no HashPass contract adapter."
          : "The local simulator never contacts a remote payment service.",
    };
  }

  public setupActivity(input: SetupActivityInput): Activity {
    this.assertActor(input.tenantId, input.role, "operator");
    if (
      input.activityId.trim().length === 0 ||
      input.title.trim().length === 0 ||
      input.locale.trim().length === 0 ||
      input.currency.trim().length === 0 ||
      !Number.isInteger(input.capacity) ||
      input.capacity <= 0 ||
      input.unitPriceAtomic <= 0n
    )
      throw new Error("INVALID_ACTIVITY");
    if (this.activities.has(input.activityId))
      throw new Error("ACTIVITY_EXISTS");
    validatePolicy(input.policy);
    assertActivityPolicy(input.policy, {
      now: this.clock.now(),
      capacity: input.capacity,
      unitPriceAtomic: input.unitPriceAtomic,
    });
    const activity: Activity = {
      activityId: input.activityId,
      tenantId: input.tenantId,
      title: input.title,
      locale: input.locale,
      currency: input.currency,
      capacity: input.capacity,
      unitPriceAtomic: input.unitPriceAtomic,
      approvedPromoterIds: [...new Set(input.approvedPromoterIds)],
      policy: policySnapshot(input.policy),
      status: "DRAFT",
    };
    this.activities.set(activity.activityId, activity);
    this.policyHistory.set(
      this.policyKey(activity.activityId, activity.policy.version),
      { ...activity.policy },
    );
    this.recordEvent({
      type: "activity.created",
      tenantId: input.tenantId,
      role: input.role,
      policyVersion: activity.policy.version,
      occurredAt: this.clock.now(),
      payload: { activityId: activity.activityId },
    });
    return this.copyActivity(activity);
  }

  public activateActivity(
    input: Parameters<CommerceAdapter["activateActivity"]>[0],
  ): CommerceReceipt<Activity> {
    this.assertActor(input.tenantId, input.role, "operator");
    const activity = this.activityFor(input.activityId, input.tenantId);
    if (activity.policy.version !== input.policyVersion)
      throw new Error("POLICY_VERSION_MISMATCH");
    assertActivityPolicy(activity.policy, {
      now: this.clock.now(),
      capacity: activity.capacity,
      unitPriceAtomic: activity.unitPriceAtomic,
    });
    this.claimIdempotency(input.idempotencyKey);
    if (activity.status !== "DRAFT") throw new Error("ACTIVITY_ALREADY_ACTIVE");
    activity.status = "ACTIVE";
    return this.receipt(
      "activity.activated",
      input,
      {
        activityId: activity.activityId,
        policyVersion: activity.policy.version,
      },
      this.copyActivity(activity),
    );
  }

  public updatePolicy(input: UpdatePolicyInput): CommerceReceipt<Activity> {
    this.assertActor(input.tenantId, input.role, "operator");
    const activity = this.activityFor(input.activityId, input.tenantId);
    validatePolicy(input.policy);
    if (
      input.policy.maxCapacity !== undefined &&
      activity.capacity > input.policy.maxCapacity
    )
      throw new Error("CAPACITY_LIMIT_EXCEEDED");
    if (
      input.policy.minUnitPriceAtomic !== undefined &&
      activity.unitPriceAtomic < input.policy.minUnitPriceAtomic
    )
      throw new Error("PRICE_FLOOR_VIOLATION");
    if (activity.policy.version === input.policy.version)
      throw new Error("POLICY_VERSION_NOT_IMMUTABLE");
    if (
      this.policyHistory.has(
        this.policyKey(activity.activityId, input.policy.version),
      )
    )
      throw new Error("POLICY_VERSION_ALREADY_USED");
    this.claimIdempotency(input.idempotencyKey);
    activity.policy = policySnapshot(input.policy);
    this.policyHistory.set(
      this.policyKey(activity.activityId, input.policy.version),
      policySnapshot(input.policy),
    );
    return this.receipt(
      "policy.updated",
      input,
      {
        activityId: activity.activityId,
        policyVersion: input.policy.version,
        principalBps: String(input.policy.principalBps),
        promoterBps: String(input.policy.promoterBps),
        platformBps: String(input.policy.platformBps),
      },
      this.copyActivity(activity),
    );
  }

  public createOffer(input: CreateOfferInput): CommerceReceipt<Offer> {
    this.assertActor(input.tenantId, input.role, "promoter");
    const activity = this.activeActivity(input.activityId, input.tenantId);
    if (activity.policy.version !== input.policyVersion)
      throw new Error("POLICY_VERSION_MISMATCH");
    if (!activity.approvedPromoterIds.includes(input.promoterId))
      throw new Error("PROMOTER_NOT_APPROVED");
    this.claimIdempotency(input.idempotencyKey);
    const offer: Offer = {
      offerId: this.nextId("offer"),
      activityId: activity.activityId,
      tenantId: activity.tenantId,
      promoterId: input.promoterId,
      policyVersion: activity.policy.version,
      unitPriceAtomic: activity.unitPriceAtomic,
      availableQuantity: this.availableQuantity(activity.activityId),
      locale: activity.locale,
      currency: activity.currency,
    };
    this.offers.set(offer.offerId, offer);
    return this.receipt(
      "offer.created",
      input,
      {
        offerId: offer.offerId,
        activityId: activity.activityId,
        policyVersion: activity.policy.version,
      },
      offer,
    );
  }

  public createQuote(input: CreateQuoteInput): CommerceReceipt<Quote> {
    this.assertActor(input.tenantId, input.role, "buyer");
    const offer = this.offerFor(input.offerId, input.tenantId);
    const activity = this.activeActivity(offer.activityId, input.tenantId);
    if (
      activity.policy.version !== input.policyVersion ||
      offer.policyVersion !== activity.policy.version
    )
      throw new Error("POLICY_VERSION_MISMATCH");
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity <= 0 ||
      input.quantity > offer.availableQuantity
    )
      throw new Error("CAPACITY_EXCEEDED");
    if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds <= 0)
      throw new Error("INVALID_QUOTE_TTL");
    this.claimIdempotency(input.idempotencyKey);
    const issuedAt = this.clock.now();
    assertQuoteTtl(activity.policy, issuedAt, issuedAt + input.ttlSeconds);
    const quote: Quote = {
      quoteId: this.nextId("quote"),
      offerId: offer.offerId,
      activityId: activity.activityId,
      tenantId: activity.tenantId,
      buyerId: input.buyerId,
      promoterId: offer.promoterId,
      quantity: input.quantity,
      unitPriceAtomic: offer.unitPriceAtomic,
      totalAtomic: offer.unitPriceAtomic * BigInt(input.quantity),
      policyVersion: activity.policy.version,
      issuedAt,
      expiresAt: issuedAt + input.ttlSeconds,
      status: "OPEN",
    };
    this.quotes.set(quote.quoteId, quote);
    return this.receipt(
      "quote.created",
      input,
      {
        quoteId: quote.quoteId,
        activityId: activity.activityId,
        policyVersion: quote.policyVersion,
      },
      quote,
    );
  }

  public reserve(input: ReserveInput): CommerceReceipt<Reservation> {
    this.assertActor(input.tenantId, input.role, "buyer");
    const quote = this.quoteFor(input.quoteId, input.tenantId);
    if (quote.policyVersion !== input.policyVersion)
      throw new Error("POLICY_VERSION_MISMATCH");
    if (quote.status !== "OPEN") throw new Error("QUOTE_ALREADY_RESERVED");
    if (this.clock.now() >= quote.expiresAt) {
      quote.status = "EXPIRED";
      throw new Error("QUOTE_EXPIRED");
    }
    if (quote.quantity > this.availableQuantity(quote.activityId))
      throw new Error("CAPACITY_EXCEEDED");
    this.claimIdempotency(input.idempotencyKey);
    const reservation: Reservation = {
      reservationId: this.nextId("reservation"),
      quoteId: quote.quoteId,
      activityId: quote.activityId,
      tenantId: quote.tenantId,
      buyerId: quote.buyerId,
      promoterId: quote.promoterId,
      quantity: quote.quantity,
      totalAtomic: quote.totalAtomic,
      policyVersion: quote.policyVersion,
      expiresAt: quote.expiresAt,
      status: "HELD",
    };
    quote.status = "RESERVED";
    this.reservations.set(reservation.reservationId, reservation);
    return this.receipt(
      "reservation.created",
      input,
      {
        reservationId: reservation.reservationId,
        activityId: reservation.activityId,
        policyVersion: reservation.policyVersion,
      },
      reservation,
    );
  }

  public reconcileReservation(
    input: ReconcileReservationInput,
  ): CommerceReceipt<Reservation> {
    this.assertActor(input.tenantId, input.role, "operator", "system");
    const prior = this.reconciliationReceipts.get(input.idempotencyKey);
    if (prior) {
      if (prior.result.reservationId !== input.reservationId)
        throw new Error("DUPLICATE_IDEMPOTENCY_KEY");
      return prior;
    }
    const reservation = this.reservationFor(
      input.reservationId,
      input.tenantId,
    );
    const activity = this.activityFor(
      reservation.activityId,
      reservation.tenantId,
    );
    const policy = this.policyForVersion(activity, reservation.policyVersion);
    if (reservation.status === "CONFIRMED")
      throw new Error("RESERVATION_ALREADY_CONFIRMED");
    if (reservation.status === "RELEASED")
      throw new Error("RESERVATION_ALREADY_RELEASED");
    if (input.reason === "expired" && this.clock.now() < reservation.expiresAt)
      throw new Error("RESERVATION_NOT_EXPIRED");
    assertPolicyWindow(
      this.clock.now(),
      policy.releaseWindow,
      "RELEASE_WINDOW_CLOSED",
    );
    this.claimIdempotency(input.idempotencyKey);
    reservation.status = "RELEASED";
    reservation.releasedAt = this.clock.now();
    reservation.releaseReason = input.reason;
    const receipt = this.receipt(
      "reservation.released",
      input,
      {
        reservationId: reservation.reservationId,
        activityId: reservation.activityId,
        policyVersion: reservation.policyVersion,
        reason: input.reason,
      },
      reservation,
    );
    this.reconciliationReceipts.set(input.idempotencyKey, receipt);
    return receipt;
  }

  public confirmPayment(
    input: ConfirmPaymentInput,
  ): CommerceReceipt<PaymentConfirmation> {
    this.assertActor(input.tenantId, input.role, "buyer", "system");
    const reservation = this.reservationFor(
      input.reservationId,
      input.tenantId,
    );
    if (reservation.status === "RELEASED")
      throw new Error("RESERVATION_RELEASED");
    if (reservation.status !== "HELD")
      throw new Error("RESERVATION_ALREADY_CONFIRMED");
    if (this.clock.now() >= reservation.expiresAt)
      throw new Error("QUOTE_EXPIRED");
    if (reservation.policyVersion !== input.policyVersion)
      throw new Error("POLICY_VERSION_MISMATCH");
    if (input.amountAtomic !== reservation.totalAtomic)
      throw new Error("PAYMENT_AMOUNT_MISMATCH");
    if (input.paymentEventId.trim().length === 0)
      throw new Error("INVALID_PAYMENT_EVENT");
    if (this.usedPaymentEvents.has(input.paymentEventId))
      throw new Error("DUPLICATE_PAYMENT_EVENT");
    const activity = this.activityFor(
      reservation.activityId,
      reservation.tenantId,
    );
    const policy = this.policyForVersion(activity, reservation.policyVersion);
    if (
      policy.maxExposureAtomic !== undefined &&
      input.amountAtomic > policy.maxExposureAtomic
    )
      throw new Error("EXPOSURE_LIMIT_EXCEEDED");
    if (policy.maxBudgetAtomic !== undefined) {
      const committedAtomic = [...this.bookings.values()]
        .filter((booking) => booking.activityId === reservation.activityId)
        .reduce((sum, booking) => sum + booking.paidAtomic, 0n);
      if (committedAtomic + input.amountAtomic > policy.maxBudgetAtomic)
        throw new Error("BUDGET_LIMIT_EXCEEDED");
    }
    if (
      policy.minPrincipalAtomic !== undefined &&
      allocateAtomic(input.amountAtomic, policy).principalAtomic <
        policy.minPrincipalAtomic
    )
      throw new Error("MINIMUM_PROCEEDS_VIOLATION");
    this.claimIdempotency(input.idempotencyKey);
    this.usedPaymentEvents.add(input.paymentEventId);
    reservation.status = "CONFIRMED";
    const payment: PaymentConfirmation = {
      paymentId: this.nextId("payment"),
      reservationId: reservation.reservationId,
      bookingId: this.nextId("booking"),
      eventId: input.paymentEventId,
      tenantId: reservation.tenantId,
      amountAtomic: reservation.totalAtomic,
      policyVersion: reservation.policyVersion,
      confirmedAt: this.clock.now(),
    };
    this.payments.set(payment.paymentId, payment);
    const booking: Booking = {
      bookingId: payment.bookingId,
      reservationId: reservation.reservationId,
      paymentId: payment.paymentId,
      activityId: reservation.activityId,
      tenantId: reservation.tenantId,
      buyerId: reservation.buyerId,
      promoterId: reservation.promoterId,
      quantity: reservation.quantity,
      paidAtomic: reservation.totalAtomic,
      policyVersion: reservation.policyVersion,
      bookedAt: payment.confirmedAt,
    };
    this.bookings.set(booking.bookingId, booking);
    return this.receipt(
      "payment.confirmed",
      input,
      {
        bookingId: booking.bookingId,
        activityId: booking.activityId,
        paymentEventId: payment.eventId,
        policyVersion: payment.policyVersion,
      },
      payment,
    );
  }

  public issuePass(input: IssuePassInput): CommerceReceipt<Pass> {
    this.assertActor(input.tenantId, input.role, "operator", "system");
    const booking = this.bookingFor(input.bookingId, input.tenantId);
    if (booking.policyVersion !== input.policyVersion)
      throw new Error("POLICY_VERSION_MISMATCH");
    if (booking.passId) throw new Error("PASS_ALREADY_ISSUED");
    this.claimIdempotency(input.idempotencyKey);
    const pass: Pass = {
      passId: this.nextId("pass"),
      bookingId: booking.bookingId,
      activityId: booking.activityId,
      tenantId: booking.tenantId,
      holderId: booking.buyerId,
      policyVersion: booking.policyVersion,
      issuedAt: this.clock.now(),
    };
    booking.passId = pass.passId;
    this.passes.set(pass.passId, pass);
    return this.receipt(
      "pass.issued",
      input,
      {
        passId: pass.passId,
        activityId: pass.activityId,
        policyVersion: pass.policyVersion,
      },
      pass,
    );
  }

  public checkIn(input: CheckInInput): CommerceReceipt<CheckIn> {
    this.assertActor(input.tenantId, input.role, "operator", "delegate");
    const pass = this.passFor(input.passId, input.tenantId);
    if (pass.policyVersion !== input.policyVersion)
      throw new Error("POLICY_VERSION_MISMATCH");
    if (input.checkInEventId.trim().length === 0)
      throw new Error("INVALID_CHECK_IN_EVENT");
    const policy = this.policyForVersion(
      this.activityFor(pass.activityId, input.tenantId),
      pass.policyVersion,
    );
    assertPolicyWindow(
      this.clock.now(),
      policy.checkInWindow,
      "CHECK_IN_WINDOW_CLOSED",
    );
    if (pass.checkedInAt !== undefined) throw new Error("DUPLICATE_CHECK_IN");
    if (this.usedCheckInEvents.has(input.checkInEventId))
      throw new Error("DUPLICATE_CHECK_IN_EVENT");
    this.claimIdempotency(input.idempotencyKey);
    const checkedInAt = this.clock.now();
    this.usedCheckInEvents.add(input.checkInEventId);
    pass.checkedInAt = checkedInAt;
    const booking = this.bookingFor(pass.bookingId, input.tenantId);
    booking.checkedInAt = checkedInAt;
    const checkIn: CheckIn = {
      checkInId: this.nextId("checkin"),
      passId: pass.passId,
      bookingId: pass.bookingId,
      activityId: pass.activityId,
      tenantId: pass.tenantId,
      checkedInAt,
      policyVersion: pass.policyVersion,
    };
    this.checkIns.set(checkIn.checkInId, checkIn);
    return this.receipt(
      "check-in.completed",
      input,
      {
        passId: pass.passId,
        activityId: pass.activityId,
        checkInEventId: input.checkInEventId,
        policyVersion: checkIn.policyVersion,
      },
      checkIn,
    );
  }

  public settle(input: SettleInput): CommerceReceipt<Settlement> {
    this.assertActor(input.tenantId, input.role, "operator", "system");
    const booking = this.bookingFor(input.bookingId, input.tenantId);
    if (booking.policyVersion !== input.policyVersion)
      throw new Error("POLICY_VERSION_MISMATCH");
    if (booking.checkedInAt === undefined)
      throw new Error("ATTENDANCE_REQUIRED");
    if (input.availableBudgetAtomic < 0n)
      throw new Error("INVALID_SETTLEMENT_BUDGET");
    this.claimIdempotency(input.idempotencyKey);
    const activity = this.activityFor(booking.activityId, booking.tenantId);
    const allocation = allocationFor(
      booking.paidAtomic,
      this.policyForVersion(activity, booking.policyVersion),
    );
    const prior = this.settlements.get(booking.bookingId);
    if (prior?.status === "SETTLED") throw new Error("SETTLEMENT_COMPLETE");
    const alreadyPromoter = prior?.promoterPaidAtomic ?? 0n;
    const alreadyPlatform = prior?.platformPaidAtomic ?? 0n;
    const alreadyFee = prior?.feePaidAtomic ?? 0n;
    const remainingBudget = input.availableBudgetAtomic;
    const promoterPaidAtomic =
      alreadyPromoter +
      (remainingBudget < allocation.promoterAtomic - alreadyPromoter
        ? remainingBudget
        : allocation.promoterAtomic - alreadyPromoter);
    const budgetAfterPromoter =
      remainingBudget - (promoterPaidAtomic - alreadyPromoter);
    const platformPaidAtomic =
      alreadyPlatform +
      (budgetAfterPromoter < allocation.platformAtomic - alreadyPlatform
        ? budgetAfterPromoter
        : allocation.platformAtomic - alreadyPlatform);
    const budgetAfterPlatform =
      budgetAfterPromoter - (platformPaidAtomic - alreadyPlatform);
    const feePaidAtomic =
      alreadyFee +
      (budgetAfterPlatform < (allocation.feeAtomic ?? 0n) - alreadyFee
        ? budgetAfterPlatform
        : (allocation.feeAtomic ?? 0n) - alreadyFee);
    const outstandingAtomic =
      allocation.promoterAtomic +
      allocation.platformAtomic -
      promoterPaidAtomic -
      platformPaidAtomic +
      (allocation.feeAtomic ?? 0n) -
      feePaidAtomic;
    const status: Settlement["status"] =
      outstandingAtomic === 0n
        ? "SETTLED"
        : promoterPaidAtomic + platformPaidAtomic + feePaidAtomic === 0n
          ? "FAILED"
          : "PARTIAL";
    const settlement: Settlement = {
      ...allocation,
      settlementId: prior?.settlementId ?? this.nextId("settlement"),
      bookingId: booking.bookingId,
      tenantId: booking.tenantId,
      policyVersion: booking.policyVersion,
      promoterPaidAtomic,
      platformPaidAtomic,
      feePaidAtomic,
      outstandingAtomic,
      status,
      settledAt: this.clock.now(),
    };
    this.settlements.set(booking.bookingId, settlement);
    return this.receipt(
      "settlement.recorded",
      input,
      {
        bookingId: booking.bookingId,
        activityId: booking.activityId,
        policyVersion: settlement.policyVersion,
        status,
      },
      settlement,
    );
  }

  public report(
    input: Parameters<CommerceAdapter["report"]>[0],
  ): CommerceReport {
    this.assertActor(input.tenantId, input.role, "operator", "system");
    const activity = this.activityFor(input.activityId, input.tenantId);
    const activityBookings = [...this.bookings.values()].filter(
      (booking) => booking.activityId === activity.activityId,
    );
    const activityReservations = [...this.reservations.values()].filter(
      (reservation) => reservation.activityId === activity.activityId,
    );
    const bookings: ReportBooking[] = activityBookings.map((booking) => ({
      bookingId: booking.bookingId,
      buyerId: booking.buyerId,
      promoterId: booking.promoterId,
      quantity: booking.quantity,
      paidAtomic: booking.paidAtomic,
      policyVersion: booking.policyVersion,
      checkInAt: booking.checkedInAt,
      settlement: this.settlements.get(booking.bookingId),
    }));
    let paidAtomic = 0n;
    let principalAtomic = 0n;
    let promoterDueAtomic = 0n;
    let platformDueAtomic = 0n;
    let feeDueAtomic = 0n;
    let promoterPaidAtomic = 0n;
    let platformPaidAtomic = 0n;
    let feePaidAtomic = 0n;
    let remainderAtomic = 0n;
    let outstandingAtomic = 0n;
    for (const booking of activityBookings) {
      paidAtomic += booking.paidAtomic;
      const allocation = allocationFor(
        booking.paidAtomic,
        this.policyForVersion(activity, booking.policyVersion),
      );
      principalAtomic += allocation.principalAtomic;
      promoterDueAtomic += allocation.promoterAtomic;
      platformDueAtomic += allocation.platformAtomic;
      feeDueAtomic += allocation.feeAtomic ?? 0n;
      remainderAtomic += allocation.remainderAtomic;
      const settlement = this.settlements.get(booking.bookingId);
      promoterPaidAtomic += settlement?.promoterPaidAtomic ?? 0n;
      platformPaidAtomic += settlement?.platformPaidAtomic ?? 0n;
      feePaidAtomic += settlement?.feePaidAtomic ?? 0n;
      outstandingAtomic +=
        settlement?.outstandingAtomic ??
        allocation.promoterAtomic +
          allocation.platformAtomic +
          (allocation.feeAtomic ?? 0n);
    }
    const allocationReconciled =
      paidAtomic ===
      principalAtomic +
        remainderAtomic +
        promoterDueAtomic +
        platformDueAtomic +
        feeDueAtomic;
    return {
      tenantId: activity.tenantId,
      activityId: activity.activityId,
      capacity: activity.capacity,
      heldQuantity: activityReservations
        .filter((reservation) => reservation.status === "HELD")
        .reduce((sum, reservation) => sum + reservation.quantity, 0),
      confirmedQuantity: activityBookings.reduce(
        (sum, booking) => sum + booking.quantity,
        0,
      ),
      paidAtomic,
      principalAtomic,
      promoterDueAtomic,
      platformDueAtomic,
      feeDueAtomic,
      promoterPaidAtomic,
      platformPaidAtomic,
      feePaidAtomic,
      remainderAtomic,
      outstandingAtomic,
      allocationReconciled,
      bookings,
      events: this.events.filter(
        (event) => event.payload.activityId === activity.activityId,
      ),
    };
  }

  private policyForVersion(
    activity: Activity,
    version: string,
  ): CommercePolicy {
    const policy = this.policyHistory.get(
      this.policyKey(activity.activityId, version),
    );
    if (!policy) throw new Error("POLICY_VERSION_UNKNOWN");
    return policy;
  }

  private receipt<T>(
    type: CommerceEvent["type"],
    input: {
      tenantId: string;
      role: SetupActivityInput["role"];
      idempotencyKey?: string;
    },
    payload: Record<string, string>,
    result: T,
  ): CommerceReceipt<T> {
    const event = this.recordEvent({
      type,
      tenantId: input.tenantId,
      role: input.role,
      idempotencyKey: input.idempotencyKey,
      policyVersion: payload.policyVersion,
      occurredAt: this.clock.now(),
      payload,
    });
    return {
      receiptId: event.eventId,
      event: cloneSnapshot(event),
      result: cloneSnapshot(result),
    };
  }

  private recordEvent(
    input: Omit<CommerceEvent, "eventId" | "schemaVersion">,
  ): CommerceEvent {
    const event: CommerceEvent = {
      schemaVersion: "commerce.v1",
      eventId: this.nextId("event"),
      ...input,
    };
    this.events.push(event);
    return event;
  }

  private claimIdempotency(key: string): void {
    if (key.trim().length === 0) throw new Error("INVALID_IDEMPOTENCY_KEY");
    if (this.usedIdempotencyKeys.has(key))
      throw new Error("DUPLICATE_IDEMPOTENCY_KEY");
    this.usedIdempotencyKeys.add(key);
  }

  private assertActor(
    tenantId: string,
    role: SetupActivityInput["role"],
    ...allowed: SetupActivityInput["role"][]
  ): void {
    if (tenantId.trim().length === 0 || !allowed.includes(role))
      throw new Error("ACTOR_NOT_AUTHORIZED");
  }

  private activityFor(activityId: string, tenantId: string): Activity {
    const activity = this.activities.get(activityId);
    if (!activity || activity.tenantId !== tenantId)
      throw new Error("ACTIVITY_NOT_FOUND");
    return activity;
  }

  private activeActivity(activityId: string, tenantId: string): Activity {
    const activity = this.activityFor(activityId, tenantId);
    if (activity.status !== "ACTIVE") throw new Error("ACTIVITY_NOT_ACTIVE");
    if (activity.policy.paused) throw new Error("POLICY_PAUSED");
    if (activity.policy.cancelled) throw new Error("POLICY_CANCELLED");
    assertActivityWindow(activity.policy, this.clock.now());
    return activity;
  }

  private offerFor(offerId: string, tenantId: string): Offer {
    const offer = this.offers.get(offerId);
    if (!offer || offer.tenantId !== tenantId)
      throw new Error("OFFER_NOT_FOUND");
    return offer;
  }

  private quoteFor(quoteId: string, tenantId: string): Quote {
    const quote = this.quotes.get(quoteId);
    if (!quote || quote.tenantId !== tenantId)
      throw new Error("QUOTE_NOT_FOUND");
    return quote;
  }

  private reservationFor(reservationId: string, tenantId: string): Reservation {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.tenantId !== tenantId)
      throw new Error("RESERVATION_NOT_FOUND");
    return reservation;
  }

  private bookingFor(bookingId: string, tenantId: string): Booking {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.tenantId !== tenantId)
      throw new Error("BOOKING_NOT_FOUND");
    return booking;
  }

  private passFor(passId: string, tenantId: string): Pass {
    const pass = this.passes.get(passId);
    if (!pass || pass.tenantId !== tenantId) throw new Error("PASS_NOT_FOUND");
    return pass;
  }

  private availableQuantity(activityId: string): number {
    const activity = this.activities.get(activityId);
    if (!activity) throw new Error("ACTIVITY_NOT_FOUND");
    let used = 0;
    for (const reservation of this.reservations.values()) {
      if (
        reservation.activityId === activityId &&
        reservation.status !== "RELEASED"
      )
        used += reservation.quantity;
    }
    return activity.capacity - used;
  }

  private copyActivity(activity: Activity): Activity {
    return cloneSnapshot(activity);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence.toString().padStart(4, "0")}`;
  }

  private policyKey(activityId: string, version: string): string {
    return `${activityId}:${version}`;
  }
}

export { allocationFor };

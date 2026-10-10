import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  allocationFor,
  allocationConserves,
  allocateAtomic,
  DeterministicClock,
  SimulationCommerceAdapter,
  validateCampaignPolicy,
} from "../packages/commerce";

const tenantId = "tenant-demo";
const policyV1 = {
  version: "policy-v1",
  principalBps: 9_000,
  promoterBps: 700,
  platformBps: 200,
};

const setup = (capacity = 3) => {
  const clock = new DeterministicClock(1_700_000_000);
  const commerce = new SimulationCommerceAdapter({ clock });
  commerce.setupActivity({
    tenantId,
    role: "operator",
    activityId: "activity-demo",
    title: "Taller interno de HashPass",
    locale: "es-CO",
    currency: "USDC.atomic",
    capacity,
    unitPriceAtomic: 1_003n,
    approvedPromoterIds: ["promoter-demo"],
    policy: policyV1,
  });
  commerce.activateActivity({
    tenantId,
    role: "operator",
    activityId: "activity-demo",
    policyVersion: policyV1.version,
    idempotencyKey: "activate-1",
  });
  const offer = commerce.createOffer({
    tenantId,
    role: "promoter",
    activityId: "activity-demo",
    promoterId: "promoter-demo",
    policyVersion: policyV1.version,
    idempotencyKey: "offer-1",
  }).result;
  return { clock, commerce, offer };
};

const book = (
  commerce: SimulationCommerceAdapter,
  offerId: string,
  suffix: string,
  policyVersion = policyV1.version,
  completeCheckIn = true,
) => {
  const quote = commerce.createQuote({
    tenantId,
    role: "buyer",
    offerId,
    buyerId: `buyer-${suffix}`,
    quantity: 1,
    policyVersion,
    ttlSeconds: 60,
    idempotencyKey: `quote-${suffix}`,
  }).result;
  const reservation = commerce.reserve({
    tenantId,
    role: "buyer",
    quoteId: quote.quoteId,
    policyVersion,
    idempotencyKey: `reserve-${suffix}`,
  }).result;
  const payment = commerce.confirmPayment({
    tenantId,
    role: "system",
    reservationId: reservation.reservationId,
    paymentEventId: `payment-event-${suffix}`,
    amountAtomic: quote.totalAtomic,
    policyVersion,
    idempotencyKey: `payment-${suffix}`,
  }).result;
  const pass = commerce.issuePass({
    tenantId,
    role: "system",
    bookingId: payment.bookingId,
    policyVersion,
    idempotencyKey: `pass-${suffix}`,
  }).result;
  if (completeCheckIn)
    commerce.checkIn({
      tenantId,
      role: "delegate",
      passId: pass.passId,
      checkInEventId: `checkin-event-${suffix}`,
      policyVersion,
      idempotencyKey: `checkin-${suffix}`,
    });
  return { quote, reservation, payment, pass };
};

describe("internal commerce MVP", () => {
  it("runs the complete local flow and reconciles integer allocations", () => {
    const { commerce, offer } = setup();
    const result = book(commerce, offer.offerId, "one");
    const settlement = commerce.settle({
      tenantId,
      role: "system",
      bookingId: result.payment.bookingId,
      policyVersion: policyV1.version,
      availableBudgetAtomic: 90n,
      idempotencyKey: "settle-one",
    }).result;
    const report = commerce.report({
      tenantId,
      role: "operator",
      activityId: "activity-demo",
    });

    expect(settlement.status).toBe("SETTLED");
    expect(report.paidAtomic).toBe(1_003n);
    expect(report.principalAtomic).toBe(902n);
    expect(report.promoterDueAtomic).toBe(70n);
    expect(report.platformDueAtomic).toBe(20n);
    expect(report.remainderAtomic).toBe(11n);
    expect(report.promoterPaidAtomic).toBe(70n);
    expect(report.platformPaidAtomic).toBe(20n);
    expect(report.outstandingAtomic).toBe(0n);
    expect(report.allocationReconciled).toBe(true);
    expect(
      report.events.every((event) => event.policyVersion === policyV1.version),
    ).toBe(true);
    expect(report.events.map((event) => event.type)).toEqual([
      "activity.created",
      "activity.activated",
      "offer.created",
      "quote.created",
      "reservation.created",
      "payment.confirmed",
      "pass.issued",
      "check-in.completed",
      "settlement.recorded",
    ]);
  });

  it("rejects stale policy, over-capacity, expired quote, and duplicate keys", () => {
    const { clock, commerce, offer } = setup(1);
    expect(() =>
      commerce.createQuote({
        tenantId,
        role: "buyer",
        offerId: offer.offerId,
        buyerId: "buyer-one",
        quantity: 1,
        policyVersion: "policy-wrong",
        ttlSeconds: 60,
        idempotencyKey: "bad-policy",
      }),
    ).toThrow("POLICY_VERSION_MISMATCH");

    const quote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-one",
      quantity: 1,
      policyVersion: policyV1.version,
      ttlSeconds: 1,
      idempotencyKey: "quote-expiring",
    }).result;
    clock.advance(1);
    expect(() =>
      commerce.reserve({
        tenantId,
        role: "buyer",
        quoteId: quote.quoteId,
        policyVersion: policyV1.version,
        idempotencyKey: "reserve-expired",
      }),
    ).toThrow("QUOTE_EXPIRED");

    const freshQuote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-two",
      quantity: 1,
      policyVersion: policyV1.version,
      ttlSeconds: 60,
      idempotencyKey: "quote-capacity",
    }).result;
    commerce.reserve({
      tenantId,
      role: "buyer",
      quoteId: freshQuote.quoteId,
      policyVersion: policyV1.version,
      idempotencyKey: "reserve-capacity",
    });
    const overCapacityQuote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-three",
      quantity: 1,
      policyVersion: policyV1.version,
      ttlSeconds: 60,
      idempotencyKey: "quote-over-capacity",
    }).result;
    expect(() =>
      commerce.reserve({
        tenantId,
        role: "buyer",
        quoteId: overCapacityQuote.quoteId,
        policyVersion: policyV1.version,
        idempotencyKey: "reserve-over-capacity",
      }),
    ).toThrow("CAPACITY_EXCEEDED");

    expect(() =>
      commerce.createQuote({
        tenantId,
        role: "buyer",
        offerId: offer.offerId,
        buyerId: "buyer-four",
        quantity: 1,
        policyVersion: policyV1.version,
        ttlSeconds: 60,
        idempotencyKey: "quote-capacity",
      }),
    ).toThrow("DUPLICATE_IDEMPOTENCY_KEY");
  });

  it("freezes accepted policy versions and rejects duplicate check-in", () => {
    const { commerce, offer } = setup();
    const result = book(commerce, offer.offerId, "frozen");
    expect(() =>
      commerce.checkIn({
        tenantId,
        role: "delegate",
        passId: result.pass.passId,
        checkInEventId: "checkin-event-frozen-duplicate",
        policyVersion: policyV1.version,
        idempotencyKey: "checkin-duplicate",
      }),
    ).toThrow("DUPLICATE_CHECK_IN");

    commerce.updatePolicy({
      tenantId,
      role: "operator",
      activityId: "activity-demo",
      policy: {
        version: "policy-v2",
        principalBps: 8_500,
        promoterBps: 1_000,
        platformBps: 300,
      },
      idempotencyKey: "policy-v2",
    });
    expect(() =>
      commerce.updatePolicy({
        tenantId,
        role: "operator",
        activityId: "activity-demo",
        policy: policyV1,
        idempotencyKey: "policy-v1-reuse",
      }),
    ).toThrow("POLICY_VERSION_ALREADY_USED");
    const settlement = commerce.settle({
      tenantId,
      role: "operator",
      bookingId: result.payment.bookingId,
      policyVersion: policyV1.version,
      availableBudgetAtomic: 90n,
      idempotencyKey: "settle-frozen",
    }).result;
    expect(settlement.promoterAtomic).toBe(70n);
    expect(settlement.platformAtomic).toBe(20n);
  });

  it("records failed and partial settlement explicitly", () => {
    const { commerce, offer } = setup(3);
    const failedBooking = book(commerce, offer.offerId, "failed");
    const failed = commerce.settle({
      tenantId,
      role: "operator",
      bookingId: failedBooking.payment.bookingId,
      policyVersion: policyV1.version,
      availableBudgetAtomic: 0n,
      idempotencyKey: "settle-failed",
    }).result;
    expect(failed.status).toBe("FAILED");
    expect(failed.outstandingAtomic).toBe(90n);

    const partialBooking = book(commerce, offer.offerId, "partial");
    const partial = commerce.settle({
      tenantId,
      role: "operator",
      bookingId: partialBooking.payment.bookingId,
      policyVersion: policyV1.version,
      availableBudgetAtomic: 50n,
      idempotencyKey: "settle-partial",
    }).result;
    expect(partial.status).toBe("PARTIAL");
    expect(partial.promoterPaidAtomic).toBe(50n);
    expect(partial.platformPaidAtomic).toBe(0n);
    expect(partial.outstandingAtomic).toBe(40n);
  });

  it("reports unsupported external capabilities explicitly", () => {
    const { commerce } = setup();
    expect(commerce.supports("remote-payment")).toEqual({
      capability: "remote-payment",
      supported: false,
      reason: "The local simulator never contacts a remote payment service.",
    });
    expect(commerce.supports("hashpass-native-pass").supported).toBe(false);
  });

  it("releases expired reservations and replays the same idempotency receipt", () => {
    const { clock, commerce, offer } = setup(1);
    const quote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-expired-hold",
      quantity: 1,
      policyVersion: policyV1.version,
      ttlSeconds: 1,
      idempotencyKey: "quote-expired-hold",
    }).result;
    const reservation = commerce.reserve({
      tenantId,
      role: "buyer",
      quoteId: quote.quoteId,
      policyVersion: policyV1.version,
      idempotencyKey: "reserve-expired-hold",
    }).result;
    clock.advance(1);
    const first = commerce.reconcileReservation({
      tenantId,
      role: "operator",
      reservationId: reservation.reservationId,
      reason: "expired",
      idempotencyKey: "release-expired-hold",
    });
    const replay = commerce.reconcileReservation({
      tenantId,
      role: "operator",
      reservationId: reservation.reservationId,
      reason: "expired",
      idempotencyKey: "release-expired-hold",
    });
    expect(first.result.status).toBe("RELEASED");
    expect(first.result.releaseReason).toBe("expired");
    expect(replay).toBe(first);

    const replacementQuote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-replacement",
      quantity: 1,
      policyVersion: policyV1.version,
      ttlSeconds: 60,
      idempotencyKey: "quote-replacement",
    }).result;
    expect(
      commerce.reserve({
        tenantId,
        role: "buyer",
        quoteId: replacementQuote.quoteId,
        policyVersion: policyV1.version,
        idempotencyKey: "reserve-replacement",
      }).result.status,
    ).toBe("HELD");
  });

  it("rejects empty check-in event identifiers", () => {
    const { commerce, offer } = setup();
    const result = book(
      commerce,
      offer.offerId,
      "empty-checkin",
      policyV1.version,
      false,
    );
    expect(() =>
      commerce.checkIn({
        tenantId,
        role: "delegate",
        passId: result.pass.passId,
        checkInEventId: "   ",
        policyVersion: policyV1.version,
        idempotencyKey: "checkin-empty-event",
      }),
    ).toThrow("INVALID_CHECK_IN_EVENT");
  });

  it("preserves conservation for arbitrary integer atomic amounts", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (amount) => {
        const allocation = allocationFor(BigInt(amount), policyV1);
        expect(
          allocation.principalAtomic +
            allocation.promoterAtomic +
            allocation.platformAtomic +
            allocation.remainderAtomic,
        ).toBe(allocation.totalAtomic);
      }),
    );
  });

  it("validates fee recipients and conserves richer policy allocations", () => {
    const withFee = {
      ...policyV1,
      feeBps: 100,
      feeRecipientId: "fee-treasury",
      asset: { tokenId: "demo-token", decimals: 6 },
      maxBudgetAtomic: 10_000n,
      maxExposureAtomic: 2_000n,
      maxCapacity: 10,
      minUnitPriceAtomic: 1n,
      maxGasAtomic: 50n,
    };
    validateCampaignPolicy(withFee);
    const allocation = allocateAtomic(1_003n, withFee);
    expect(allocation.feeAtomic).toBe(10n);
    expect(allocationConserves(allocation)).toBe(true);
    expect(() =>
      validateCampaignPolicy({ ...withFee, feeRecipientId: undefined }),
    ).toThrow("FEE_RECIPIENT_REQUIRED");
  });

  it("returns immutable quote snapshots while retaining committed terms", () => {
    const { commerce, offer } = setup();
    const quote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-snapshot",
      quantity: 1,
      policyVersion: policyV1.version,
      ttlSeconds: 60,
      idempotencyKey: "quote-snapshot",
    }).result;
    quote.totalAtomic = 1n;
    const reservation = commerce.reserve({
      tenantId,
      role: "buyer",
      quoteId: quote.quoteId,
      policyVersion: policyV1.version,
      idempotencyKey: "reserve-snapshot",
    }).result;
    expect(reservation.totalAtomic).toBe(1_003n);
  });
});

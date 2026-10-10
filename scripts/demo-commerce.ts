import {
  DeterministicClock,
  SimulationCommerceAdapter,
} from "../packages/commerce";

const tenantId = "tenant-internal-demo";
const policy = {
  version: "policy-demo-v1",
  principalBps: 9_000,
  promoterBps: 700,
  platformBps: 200,
};

const stringify = (value: unknown) =>
  JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );

const rejected = (label: string, action: () => unknown) => {
  try {
    action();
    return { label, rejected: false, error: "NO_ERROR" };
  } catch (error) {
    return {
      label,
      rejected: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const clock = new DeterministicClock(1_700_000_000);
const commerce = new SimulationCommerceAdapter({ clock });

commerce.setupActivity({
  tenantId,
  role: "operator",
  activityId: "activity-internal-demo",
  title: "Demostración interna de checkout y check-in",
  locale: "es-CO",
  currency: "USDC.atomic",
  capacity: 2,
  unitPriceAtomic: 1_003n,
  approvedPromoterIds: ["promoter-internal"],
  policy,
});
commerce.activateActivity({
  tenantId,
  role: "operator",
  activityId: "activity-internal-demo",
  policyVersion: policy.version,
  idempotencyKey: "activate-demo",
});
const offer = commerce.createOffer({
  tenantId,
  role: "promoter",
  activityId: "activity-internal-demo",
  promoterId: "promoter-internal",
  policyVersion: policy.version,
  idempotencyKey: "offer-demo",
}).result;
const quote = commerce.createQuote({
  tenantId,
  role: "buyer",
  offerId: offer.offerId,
  buyerId: "buyer-internal",
  quantity: 1,
  policyVersion: policy.version,
  ttlSeconds: 60,
  idempotencyKey: "quote-demo",
}).result;
const reservation = commerce.reserve({
  tenantId,
  role: "buyer",
  quoteId: quote.quoteId,
  policyVersion: policy.version,
  idempotencyKey: "reservation-demo",
}).result;
const payment = commerce.confirmPayment({
  tenantId,
  role: "system",
  reservationId: reservation.reservationId,
  paymentEventId: "payment-event-demo",
  amountAtomic: quote.totalAtomic,
  policyVersion: policy.version,
  idempotencyKey: "payment-demo",
}).result;
const pass = commerce.issuePass({
  tenantId,
  role: "system",
  bookingId: payment.bookingId,
  policyVersion: policy.version,
  idempotencyKey: "pass-demo",
}).result;
commerce.checkIn({
  tenantId,
  role: "delegate",
  passId: pass.passId,
  checkInEventId: "checkin-event-demo",
  policyVersion: policy.version,
  idempotencyKey: "checkin-demo",
});
const settlement = commerce.settle({
  tenantId,
  role: "system",
  bookingId: payment.bookingId,
  policyVersion: policy.version,
  availableBudgetAtomic: 90n,
  idempotencyKey: "settlement-demo",
}).result;

const failureChecks = [
  rejected("policy-version-mismatch", () =>
    commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-wrong-policy",
      quantity: 1,
      policyVersion: "policy-wrong",
      ttlSeconds: 60,
      idempotencyKey: "quote-wrong-policy",
    }),
  ),
  rejected("duplicate-idempotency-key", () =>
    commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-duplicate-key",
      quantity: 1,
      policyVersion: policy.version,
      ttlSeconds: 60,
      idempotencyKey: "quote-demo",
    }),
  ),
  rejected("duplicate-check-in", () =>
    commerce.checkIn({
      tenantId,
      role: "delegate",
      passId: pass.passId,
      checkInEventId: "checkin-event-again",
      policyVersion: policy.version,
      idempotencyKey: "checkin-again",
    }),
  ),
  rejected("over-capacity", () => {
    const extraQuote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-over-capacity",
      quantity: 2,
      policyVersion: policy.version,
      ttlSeconds: 60,
      idempotencyKey: "quote-over-capacity",
    }).result;
    return commerce.reserve({
      tenantId,
      role: "buyer",
      quoteId: extraQuote.quoteId,
      policyVersion: policy.version,
      idempotencyKey: "reserve-over-capacity",
    });
  }),
  rejected("expired-quote", () => {
    const expiringQuote = commerce.createQuote({
      tenantId,
      role: "buyer",
      offerId: offer.offerId,
      buyerId: "buyer-expired",
      quantity: 1,
      policyVersion: policy.version,
      ttlSeconds: 1,
      idempotencyKey: "quote-expiring",
    }).result;
    clock.advance(1);
    return commerce.reserve({
      tenantId,
      role: "buyer",
      quoteId: expiringQuote.quoteId,
      policyVersion: policy.version,
      idempotencyKey: "reserve-expired",
    });
  }),
];

console.log(
  stringify({
    label: "INTERNAL_SIMULATION_ONLY",
    warning:
      "Local deterministic evidence; no external service, remote chain, credential, partner integration, or real fund was used.",
    capabilities: commerce.capabilities(),
    booking: {
      quoteId: quote.quoteId,
      reservationId: reservation.reservationId,
      paymentId: payment.paymentId,
      passId: pass.passId,
      settlementStatus: settlement.status,
    },
    failureChecks,
    report: commerce.report({
      tenantId,
      role: "operator",
      activityId: "activity-internal-demo",
    }),
  }),
);

---
id: HP-02
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
follow_up_issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/2
depends_on: ["MVP-01"]
---

# Specify commerce domain and accounting

Status: done

Issue step: 1

Target: October 12–14, 2026

## Prerequisites

Complete MVP-01 and link its internal demo exit evidence. External operator validation is useful later but does not block this internal MVP task. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Define Activity, CampaignPolicy, Promoter, Offer, Decision, Reservation, Booking, PaymentAttempt, Pass, AttendanceAttestation, CommissionAllocation, Refund and SettlementReceipt as transport-neutral domain values.
2. Specify separate reservation, payment, attendance, refund and settlement transitions; immutable policy/quote snapshots and tenant/chain/token bindings.
3. Define integer atomic amounts using verified decimals, integer basis points, rounding/remainder ownership, price floor and minimum economic proceeds.
4. Document principal-forwarding custody, separately prefunded fees, first-valid-promoter attribution, identity-based self-referral checks and their limits, attendance trust, no-show/expiry/dispute/allocation-release rules, and the internal simulation versus future partner-rail boundary.

## Affected Files

packages/commerce/domain.ts and policy.ts; packages/commerce/ports.ts; docs/commerce/architecture.md and economics.md

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [x] Policy defines recipients, fee/budget/exposure/capacity limits, quote/activity/check-in/release windows, gas bounds and pause/cancel behavior.
- [x] Principal, allocated budget, refunds and earned fees conserve value; prefunding is neither revenue nor extra GMV. Refund execution and a durable liability ledger remain HP-04 scope.
- [x] Accepted bookings retain immutable terms after policy changes; committed allocations cannot be confiscated by an admin bypass.
- [x] The domain and accounting API can be exercised by the internal simulation without importing HashPass or any external transport, while preserving stable adapter fields for future allies.

## Validation and Exit Evidence

Checks: `pnpm test` (25 passed), `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check .`, `pnpm build`, `pnpm demo:commerce`, and `pnpm specs:sync && pnpm specs:validate` passed. The SDD judge scored HP-02 4.3/5. The demo is explicitly local and does not provide external payment, identity, partner, or chain evidence.

Reviewed artifacts: `packages/commerce/domain.ts`, `packages/commerce/policy.ts`, `packages/commerce/ports.ts`, `packages/commerce/simulation.ts`, `docs/commerce/architecture.md`, and `docs/commerce/economics.md`. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: working tree; no commit requested
- Checks / evidence: internal deterministic simulation only; no HashPass or allied adapter is implemented
- Remaining limits / next task: HP-03 can build the direct payment contract. HP-04 must add a real refund transition and liability ledger before any real-money rail. Partner identity/pass integration remains HP-03/HP-10 follow-up work.

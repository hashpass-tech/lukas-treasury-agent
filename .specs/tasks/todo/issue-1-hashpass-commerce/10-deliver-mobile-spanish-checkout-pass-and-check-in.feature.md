---
id: HP-10
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-07", "HP-08"]
---

# Deliver mobile Spanish checkout pass and check-in

Status: pending

Issue step: 5

Target: October 22–25, 2026

## Prerequisites

Complete HP-07, HP-08 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Show provider/activity/date, binding final COP price, frozen referral, recipient, cancellation terms, wCOP/Celo payment, gas/fees and hold countdown.
2. Select and document the pilot wallet/wCOP/gas acquisition flow; use wallet signing without browser-stored keys or public demo identities.
3. Issue opaque signed QR without personal data only after canonical payment; expose booking status and authenticated single-use check-in.
4. Inspect actual HashPass adapter support; use standalone pass/check-in fallback if unsupported and label integration honestly; cover pending, rejected, canceled and refund states.

## Affected Files

apps/web; packages/commerce/passes.ts and narrow HashPass adapter (new); tests/e2e commerce flow (new)

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Mobile buyer can reserve/pay/receive pass and operator can check in once.
- [ ] No claimed PSE/Nequi/card feature or unsupported integration.
- [ ] Expired/unavailable/insufficient-fund/paused flows offer truthful recovery; invalid or unpaid pass rejected.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

---
id: HP-04
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-03"]
---

# Implement attendance settlement and truthful refunds

Status: pending

Issue step: 2

Target: October 16–18, 2026

## Prerequisites

Complete HP-03 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Bind operator/delegate attendance attestation to activity, booking, policy and release window; restrict delegation and prevent replay.
2. Settle promoter and HashPass allocations atomically or as independently idempotent components with explicit partial states.
3. Implement booking-bound operator-funded refund to original payer, refund event and release of unearned allocations only after confirmation.
4. Enforce specified no-show, cutoff, dispute/pause and unused-budget release rules; document post-settlement operator handling and possible locked-fund recovery.

## Affected Files

CommerceSettlement.sol; packages/commerce/settlement.ts and refunds.ts (new); commerce contract tests

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Attendance is required before earned commission release; duplicate check-in/settlement cannot repay.
- [ ] Booking is never fully settled while one required component remains unpaid.
- [ ] Absent refund funding/authority remains REFUND_PENDING; buyer principal is not represented as protected escrow.
- [ ] Refund and release accounting conserve principal and committed allocations.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

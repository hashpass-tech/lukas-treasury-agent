---
id: HP-11
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-09", "HP-10"]
---

# Deliver operator promoter and financial reporting views

Status: pending

Issue step: 5

Target: October 23–26, 2026

## Prerequisites

Complete HP-09, HP-10 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Build activity/date/capacity, floor/proceeds, budget, promoter approvals and concise fee/cancellation setup in Spanish.
2. Show exact limits/recipients, funding/authorization, offer preview, pause and unallocated withdrawal.
3. Show promoter link, confirmed sales, attendance eligibility, pending commission and verified receipts.
4. Report gross sales/refunds/completed sales, economic merchant proceeds, accrued/paid promoter fees and recognized HashPass fee separately.

## Affected Files

apps/web operator/promoter views; packages/commerce/reporting.ts (new)

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Each role completes tasks without a developer runbook.
- [ ] Reports reconcile to booking/payment/allocation/refund/settlement evidence without counting prefunding twice.
- [ ] Onboarding friction and known identity/Sybil limits are visible in pilot notes.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

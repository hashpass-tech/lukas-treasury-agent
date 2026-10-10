---
id: HP-08
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-04", "HP-05", "HP-06", "HP-07"]
---

# Reconcile durable commerce payment and settlement attempts

Status: pending

Issue step: 3

Target: October 20–23, 2026

## Prerequisites

Complete HP-04, HP-05, HP-06, HP-07 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Adapt leases, nonce control and private signed-byte journals to commerce; persist prepared requests and attempts before broadcast.
2. Confirm canonical successful receipt, configured chain/token/contract, booking event, exact amount, payer/recipient and unique event consumption before payment confirmation.
3. Reconcile pending/mined/reverted/replaced attempts, crash before/after broadcast, restarts and reorgs; invalidate downstream eligibility/pass on lost canonical payment.
4. Handle partial payouts and REFUND_PENDING explicitly; block inventory release while payment outcome is unresolved.

## Affected Files

apps/worker/worker.ts adapter; packages/commerce/reconciliation.ts (new); commerce integration tests (new)

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Duplicate callbacks, retry/restart and nonce replacement do not produce another booking or payout.
- [ ] Submitted/unresolved payment never becomes paid based only on hash or screenshot.
- [ ] Reorg and recovery tests preserve inventory, journal and money invariants.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

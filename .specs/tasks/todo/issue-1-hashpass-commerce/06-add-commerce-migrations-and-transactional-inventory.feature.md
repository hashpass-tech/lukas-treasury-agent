---
id: HP-06
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-02", "HP-03"]
---

# Add commerce migrations and transactional inventory

Status: pending

Issue step: 3

Target: October 17–20, 2026

## Prerequisites

Complete HP-02, HP-03 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Add versioned transactional migrations, tenant foreign keys, immutable snapshots, payment-event and booking uniqueness, attempts and decision journal.
2. Reserve seats transactionally with server-issued opaque booking IDs, scoped idempotency keys and short quote expiries.
3. Keep confirmed bookings plus active/resolution-held reservations within allocated capacity; synchronize only operator-assigned inventory.
4. Keep seats held when submitted payment is unresolved; define reconciliation-before-release and explicit human recovery, with concurrency and rollback tests.

## Affected Files

packages/core/storage.ts shared utilities; packages/commerce/storage.ts and migrations (new); commerce storage tests (new)

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Two concurrent last-seat requests cannot oversell.
- [ ] Retry with same payload is idempotent; conflicting payload fails.
- [ ] Expired unresolved submission cannot free a seat prematurely; paid/canceled/refunded/provisional states remain distinct.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

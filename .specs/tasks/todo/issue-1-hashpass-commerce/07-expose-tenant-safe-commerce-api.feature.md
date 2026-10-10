---
id: HP-07
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-05", "HP-06"]
---

# Expose tenant-safe commerce API

Status: pending

Issue step: 3

Target: October 19–21, 2026

## Prerequisites

Complete HP-05, HP-06 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Reuse wallet authentication and add explicit operator, promoter, buyer and delegated check-in authorization on every endpoint.
2. Implement activity/capacity, promoter approvals, signed policy, funding status, offer publish/pause and unallocated withdrawal preparation.
3. Provide public offer reads and buyer-scoped reservation/quote/booking status; compute all prices and fees server-side and freeze attribution before acceptance.
4. Add invalid-input, cross-tenant/role, ownership, stale-policy, expiry and idempotency cases; expose clear failure/recovery responses.

## Affected Files

apps/api/server.ts; packages/commerce/services.ts (new); commerce API tests (new)

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Other tenants cannot read/mutate private records or check in buyers.
- [ ] Client price/recipient/promoter manipulation cannot alter signed terms.
- [ ] Public reads disclose only appropriate offer data; sensitive attendees stay off-chain.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

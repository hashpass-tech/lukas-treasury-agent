---
id: HP-12
type: test
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-09", "HP-10", "HP-11"]
---

# Verify commerce invariants recovery and CI discovery

Status: pending

Issue step: 6

Target: October 24–27, 2026

## Prerequisites

Complete HP-09, HP-10, HP-11 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Add property tests for integer rounding/conservation, immutable policy, inventory transitions and agent action bounds.
2. Complete real-EVM authorization/replay/expiry/prefunding/withdrawal/refund/malicious-token cases; test concurrent purchases and unique event consumption.
3. Exercise submission timeout, journal crashes, nonce replacement, reorg, partial settlement and pending refund; add full browser lifecycle and negative cases.
4. Update explicit test discovery in package.json and CI; run lint/typecheck/build/unit/contracts/integration/e2e and retain existing safeguards.

## Affected Files

tests commerce unit/property/contract/integration/e2e files; package.json scripts; .github/workflows/ci.yml

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] New commerce tests actually run in CI, not only as unreferenced files.
- [ ] Every monetary/inventory invariant has meaningful adversarial coverage.
- [ ] All relevant checks pass; test failures and coverage limits are recorded truthfully.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

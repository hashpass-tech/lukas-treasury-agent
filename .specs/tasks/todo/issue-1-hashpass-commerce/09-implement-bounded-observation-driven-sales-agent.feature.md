---
id: HP-09
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-02", "HP-07", "HP-08"]
---

# Implement bounded observation-driven sales agent

Status: pending

Issue step: 4

Target: October 21–24, 2026

## Prerequisites

Complete HP-02, HP-07, HP-08 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Read trusted capacity/reservations, confirmed sales, time, sales pace, promoter performance, funded budget and policy version; block stale/missing evidence.
2. Implement deterministic authorized tiers: maintain/pause, activate approved price/commission, publish portal offer, expire offer and settle eligible attendance.
3. Validate merchant proceeds and funded caps on every action; log observations, alternatives, reason codes, expected economics and outcome.
4. Demonstrate changed observations changing an offer and valid attendance autonomously triggering settlement; optional generated copy never controls keys/authority.

## Affected Files

packages/commerce/agent.ts and policy.ts; decision journal; apps/worker/worker.ts

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Routine actions use one-time campaign authority; broader actions require new authorization.
- [ ] At least one decision responds to observed sales/capacity/time, beyond payment forwarding.
- [ ] No arbitrary outreach, fabricated forecasts, unrestricted recipients or budget overruns.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

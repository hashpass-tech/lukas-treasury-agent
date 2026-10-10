---
id: HP-01
type: docs
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: []
---

# Validate later external pilot and record scope decision

Status: active

Priority: P1 — post-internal-MVP evidence gate

Issue step: 0

Target: October 10–12, 2026

## Prerequisites

No implementation dependency. This task is intentionally non-blocking for the internal MVP. Operator participation and private commercial evidence are required only before claiming external demand or proceeding to a real pilot. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Interview at least five paid-activity operators about unsold seats, channels, acquisition costs, payment friction and refunds.
2. Select one independent operator, Colombian city and dated activity deliverable before October 30; identify a genuine promoter and prospective buyers.
3. Obtain written inventory, price-floor, minimum-proceeds, fee/budget, channel, attendance and cancellation agreement; run a manual paid-sales trial.
4. Record scrubbed findings, a comparison method and explicit proceed/narrow/stop decision for the later external pilot. Do not claim external demand or expand to real-money deployment without the commercial exit evidence.

## Affected Files

docs/commerce/pilot-validation.md; docs/commerce/operator-interview.md; docs/commerce/pilot-agreement-checklist.md; private operator evidence outside GitHub

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Independent operator supplies actual paid inventory and accepts a payment arrangement.
- [ ] Agreed economics, reachable channel and actual paid trial evidence exist.
- [ ] Baseline limitations and crypto onboarding needs are recorded; attributed sales are not claimed as causal incrementality.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: preparation artifacts created; commercial acceptance evidence remains missing
- Remaining limits / next task: five interviews, independent operator/activity selection, written agreement, reachable channel, onboarding assessment and actual paid trial are required before any external pilot; HP-02 and the internal MVP no longer wait on this task.

## Partial Progress — October 10, 2026

Prepared the evidence ledger, decision criteria, Spanish interview guide and explicit commercial agreement checklist. No implementation step or acceptance criterion is complete: these artifacts prepare collection rather than prove participation, agreement or payment.

The user confirmed no pilot operator, city, dated activity or manual paid-trial evidence exists yet. The user reports an existing product at hashpass.tech and repository https://github.com/hashpass-tech/hashpass.tech/; it is a reuse candidate, not independent commercial evidence or a verified API integration.

Preparation artifacts: [validation](../../../../docs/commerce/pilot-validation.md), [interview guide](../../../../docs/commerce/operator-interview.md), [agreement checklist](../../../../docs/commerce/pilot-agreement-checklist.md). No contacts, money movements or commerce code changes were performed. HP-01 remains active and gates the full build.

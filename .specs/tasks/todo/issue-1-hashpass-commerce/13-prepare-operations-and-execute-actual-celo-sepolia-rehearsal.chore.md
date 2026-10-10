---
id: HP-13
type: chore
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-05", "HP-12"]
---

# Prepare operations and execute actual Celo Sepolia rehearsal

Status: pending

Issue step: 6

Target: October 25–27, 2026

## Prerequisites

Complete HP-05, HP-12 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Adapt direct-wCOP readiness independently of LUKAS oracle requirements; retain verified chain/token/contract/identity/authority checks.
2. Prepare protected roles, HTTPS, persistent disk, backups/restore and alerts for low funds, stuck attempts, budget mismatch and worker failure.
3. Obtain explicit deployment authorization and run an actual Sepolia lifecycle with clearly labeled test assets; keep emulator evidence separate.
4. Record versioned deployment/contract review, policy/gas caps and scrubbed receipts; rehearse recovery and restoration.

## Affected Files

scripts/ops.ts; deployments; docs/mainnet-readiness.md, security.md and runbook.md

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Real testnet receipts replace no emulator claims; exact network and test token are labeled.
- [ ] Backup restoration and monitoring are demonstrated.
- [ ] Mainnet remains disabled until concrete reviewed deployment and operator authority gates are satisfied.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

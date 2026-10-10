---
id: HP-14
type: chore
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-01", "HP-13"]
---

# Verify official wCOP event identity and mainnet authorization

Status: pending

Issue step: 6, 7

Target: October 26–27, 2026

## Prerequisites

Complete HP-01, HP-13 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Verify official token provenance with primary sources, Celo 42220 code/proxy, decimals/behavior, acquisition route and funded balances; never use SIMCOP/TESTCOP on mainnet.
2. Confirm authenticated enrollment/repository association and existing permanent agent wallet; register ERC-8004 with authorized signer on canonical registry and verify metadata/ID/receipt.
3. Verify attribution on actual calldata and all replacement paths; if team membership changes, obtain issued team tag before further transactions.
4. Review contracts/exposure, custody and attendance assumptions and explicit bounded operator/deployment authorization; record real wallet/identity bindings in existing authorized config, not secrets in specs.

## Affected Files

config/tokens; config/hackathon.json; scripts/ops.ts; deployments; docs/hackathons/agents-on-open-rails.md

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] Official token, canonical identity and real chain evidence verified.
- [ ] Mainnet authorization covers actual contract/policy/recipients/gas/window before writes.
- [ ] Reuse, independent/newly onboarded/team-funded user provenance and submission eligibility are stated honestly.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

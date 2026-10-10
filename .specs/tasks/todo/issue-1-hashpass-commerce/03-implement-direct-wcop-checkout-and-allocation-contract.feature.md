---
id: HP-03
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-02"]
---

# Implement direct wCOP checkout and allocation contract

Status: pending

Issue step: 2

Target: October 14–17, 2026

## Prerequisites

Complete HP-02 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Create a separate direct-amount EIP-712 domain/schema binding chain, contract, campaign/policy, booking, payer/operator/promoter/platform recipients, principal/allocation, nonce and expiry.
2. Implement booking-specific checkout with exact principal forwarded to operator and uniquely identifiable payment event; atomically reserve sufficient confirmed commission funding or revert.
3. Enforce booking uniqueness, signatures, policy authority, expiry and allocated/unallocated balances; withdraw only unallocated funds.
4. Add real-EVM tests for unauthorized/replayed/expired quotes, wrong chain/token/recipient, insufficient budget, duplicate booking, allocated withdrawal and unsupported fee-on-transfer/rebasing tokens.

## Affected Files

packages/contracts/CommerceSettlement.sol (new); packages/commerce/intents.ts (new); scripts/compile.ts; commerce contract tests (new)

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] No LUKAS index, oracle or basket conversion is used for fixed-wCOP commerce.
- [ ] Payment acceptance and allocation are atomic and exact; duplicate/replayed payment cannot allocate or transfer twice.
- [ ] Fund-flow documentation and meaningful local contract tests cover principal and budget conservation.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

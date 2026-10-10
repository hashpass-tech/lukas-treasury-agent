---
id: HP-05
type: feature
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: ["HP-03", "HP-04"]
---

# Extend constrained signer and attribution for commerce

Status: pending

Issue step: 2, 7

Target: October 17–19, 2026

## Prerequisites

Complete HP-03, HP-04 and link their exit evidence. These are planned tasks; no pilot, deployment or identity evidence is claimed.

## Implementation Steps

1. Add commerce-only method and typed-message allowlists with chain, recipient, amount, nonce, policy, gas and expiry checks; preserve old LOCAL/LUKAS protections.
2. Apply official ERC-8021 suffix before signing every application transaction: approval, deploy/config, funding, checkout, refund, withdrawal, settlement, replacement and identity registration.
3. Retain the issued configuration and permanent event wallet role without copying keys or private account identifiers into specs.
4. Test suffix decoding and replacement preservation and rejection of arbitrary signing, wrong recipients or chain.

## Affected Files

packages/core/attribution.ts and chain.ts; packages/commerce/signer.ts (new); scripts/ops.ts; tests/attribution.test.ts

Paths marked new are proposed implementation locations, not existing functionality.

## Acceptance Criteria

- [ ] No unrestricted signing path is introduced; remote writes remain gated.
- [ ] Attribution is tested on all application-originated paths and cannot be retroactively added.
- [ ] Merchant/buyer roles are distinct from permanent agent identity.

## Validation and Exit Evidence

Record relevant checks, reviewed artifacts and scrubbed evidence for the criteria above. Money/identity/network steps require actual authorized execution; local mocks are insufficient evidence. Keep credentials, raw journals, private customer records, screenshots and recordings out of tracked docs.

## Handoff

- PR / commit: pending
- Checks / evidence: pending
- Remaining limits / next task: pending

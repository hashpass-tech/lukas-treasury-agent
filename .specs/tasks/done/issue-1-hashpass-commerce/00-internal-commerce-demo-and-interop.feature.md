---
id: MVP-01
type: feature
track: internal-mvp
issue: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1
depends_on: []
---

# Build an internal commerce demo with future partner adapters

Status: done

Priority: P0 — first internal MVP slice

## Goal

Deliver a deterministic local demo that proves the core commerce capability without an operator, external API, remote chain, real customer, or third-party deployment. The demo must exercise one complete path: policy and inventory setup, bounded offer decision, buyer quote and reservation, simulated payment confirmation, pass issuance, single-use check-in, commission allocation and a reconciled report.

The internal simulator is a development rail only. Its interfaces must be transport-neutral and preserve the fields a future HashPass or allied integration needs, but it must not claim HashPass interoperability until an adapter is implemented and tested against an approved contract.

## Interoperability boundary

Define stable ports for `CommerceAdapter`, `PassAdapter` and `PaymentRailAdapter`. Ports exchange opaque IDs, integer atomic amounts, policy versions, role/tenant identifiers, idempotency keys and event/receipt records. They must not import HashPass code, assume a particular HTTP framework, use floating-point money or expose private keys.

The internal implementation is `SimulationCommerceAdapter`. A future HashPass adapter may implement the same ports and must be able to map its own pass/check-in identifiers without changing commerce accounting or policy decisions. Unsupported external capabilities must return an explicit capability result rather than silently simulating them.

## Implementation Steps

1. Define commerce value objects and state machines for activity, campaign policy, offer, quote, reservation, booking, pass, attendance and settlement. Enforce integer atomic amounts, basis-point fees, capacity limits, immutable policy versions and conservation checks.
2. Define adapter ports and versioned event/receipt DTOs for commerce, payment rail and pass/check-in integrations. Include idempotency and capability negotiation fields.
3. Implement an in-memory simulation adapter with deterministic clock injection. Support setup, offer activation, quote/reservation, payment confirmation, pass issuance, one-time check-in, promoter/platform allocation and an auditable report.
4. Add unit/property tests for rounding, conservation, capacity, quote expiry, duplicate requests, policy immutability, duplicate check-in and partial/failed settlement. Add one scenario test that runs the complete internal demo.
5. Document the demo command, trust boundaries, simulated capabilities and the exact adapter contract required before HashPass or another ally can be connected.

## Affected Files

`packages/commerce/` (new), `tests/commerce/` or `tests/commerce-domain.test.ts` (new), `scripts/demo-commerce.ts` (new), `package.json`, `docs/commerce/internal-demo.md`, `docs/commerce/interoperability.md` (new).

## Acceptance Criteria

- [x] `pnpm demo:commerce` runs without network access, external credentials, external services or real funds and prints a scrubbed end-to-end report.
- [x] The scenario rejects over-capacity, expired-quote, duplicate-idempotency, duplicate-check-in and policy-version mismatch cases deterministically.
- [x] All monetary values use integer atomic units; principal, promoter allocation, platform allocation and remainder reconcile exactly.
- [x] Adapter ports contain no HashPass-specific import or transport assumption and include booking, payment, pass, check-in, settlement, idempotency and capability data needed for a future adapter.
- [x] A future adapter can replace the simulation rail without changing the policy/accounting API; unsupported capabilities are explicit.
- [x] Tests run in the normal test command and typecheck/lint/build remain green. `pnpm test` (23 tests), `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check .`, and `pnpm build` pass.
- [x] The demo is clearly labeled internal simulation evidence, not operator demand, production payment, Celo readiness, HashPass integration or product-market-fit evidence.

## Validation and Exit Evidence

Record the demo output, test commands and a short adapter mapping note. Do not record private keys, customer data, external credentials or fabricated partner evidence. This task unblocks domain/API development; external operator validation remains a later evidence task and does not block the internal MVP.

## Handoff

- PR / commit: working tree; no commit or PR created
- Checks / evidence: `pnpm test` (23 tests passed), `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check .`, `pnpm build`, and `pnpm demo:commerce` (full report plus five deterministic rejection checks). Events carry `commerce.v1` and policy versions; expired reservation release is explicit and idempotent.
- Remaining limits / next task: no HashPass/allied adapter is implemented or claimed; contract review and optional external pilot remain later evidence tasks after the internal demo is stable

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Inferred from the existing application:** an owner or operator reviewing a
policy-controlled treasury demo, and an engineer evaluating whether the same
flows can be reused by Hashpass or another allied operator.

## Product Purpose

LUKAS Treasury demonstrates how a bounded treasury can schedule obligations in
LUKAS and settle them in an allowlisted local-currency token. The MVP succeeds
when a visitor can understand the policy boundary, inspect a deterministic
obligation and receipt, and see which actions are available to an owner.

## Positioning

The product makes authorization explicit: recipient, token, settlement cap,
policy epoch and validity window are visible before a signature or chain
transaction. The static build is a read-only internal demo; it must remain
interoperable with Hashpass or another allied integration when live adapters
are introduced.

## Operating Context

The primary surface is a browser dashboard served as a static GitHub Pages
demo, with a local/API-backed mode for wallet and chain actions. It uses
deterministic synthetic values in the static build and identifies those values
as demo data.

## Capabilities and Constraints

- Show treasury balance, reference value, supplier receipt, policy and
  readiness state.
- Draft, parse, review and sign bounded payment obligations in live mode.
- Prepare owner controls for pause, funding, withdrawal and policy changes in
  live mode.
- Static mode is read-only and must not imply that demo data is mainnet proof.
- Preserve adapter-friendly domain boundaries so future Hashpass or allied
  integrations can reuse the surface without coupling the UI to one provider.

## Brand Commitments

- Product name: LUKAS Treasury.
- Existing relationship: JACK-inspired runtime language, with upstream
  integration pending licensing.
- Interoperability with Hashpass and future allies is a product constraint.
- The user requested a distinctive, modern interface with reusable,
  cross-platform components.

## Evidence on Hand

- Deterministic demo state: `apps/web/app/static-demo.ts`.
- Existing API and chain flows: `apps/web/app/page.tsx`.
- Public static demo: `https://hashpass-tech.github.io/lukas-treasury-agent/`.
- No paid pilot or external operator evidence has been supplied yet.

## Product Principles

1. Show the money boundary before the mechanism behind it.
2. Make every authorization legible before it becomes executable.
3. Label synthetic and local/testnet evidence clearly.
4. Keep the interface portable across custody, settlement and identity
   adapters.
5. Prefer a calm operator workflow over dashboard decoration.

## Accessibility & Inclusion

The web demo should support keyboard navigation, visible focus, readable
contrast, reduced-motion preferences, and layouts that remain usable at narrow
mobile widths.

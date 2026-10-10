# LUKAS Treasury UI guidelines

The web surface uses the **Port Ledger** design system documented in
[`DESIGN.md`](../DESIGN.md). It is deliberately small so the same primitives
can be rebuilt in React, native mobile, or an allied Hashpass surface without
coupling the visual layer to one API provider.

## Principles

- Put the operator's decision first: readiness, obligation and owner control.
- Show exact terms before an action can sign or send.
- Treat synthetic, local and testnet evidence as visibly different from
  reviewed mainnet evidence.
- Keep surfaces composable: panels contain groups, rows contain facts, and
  actions remain portable.

## Component contract

Every reusable component should accept semantic content and state rather than
provider-specific data. Use these shared variants:

| Component       | Required states                                  | Cross-platform rule                                 |
| --------------- | ------------------------------------------------ | --------------------------------------------------- |
| `StatusPill`    | ready, review, blocked, settled                  | Always include text; color is secondary.            |
| `ActionButton`  | primary, secondary, quiet, destructive, disabled | Keep the action verb explicit.                      |
| `Field`         | default, focused, read-only, disabled, error     | Label and hint remain visible outside placeholders. |
| `Panel`         | default, highlighted, quiet                      | One elevation treatment; avoid nested panels.       |
| `DataList`      | normal, stale, empty                             | Labels and values align as a readable pair.         |
| `ObligationRow` | queued, settled, blocked, expired                | Receipt details stay disclosure-based.              |

## Layout and type

Use a 4px spacing unit, 14px panel corners, 8px control corners, and a
12-column desktop grid. Use the self-hosted Space Grotesk Variable face for
thin display and UI copy; use self-hosted DM Mono only for addresses, hashes
and chain data. Keep paragraphs at a comfortable reading measure and never
encode critical information only through color.

Hot pink marks the primary action and active navigation. Lime marks a safe or
settled state. Motion is purposeful: the hero reveals once, the operating
indicator breathes while live, and hover movement stays subtle. Reduced-motion
users receive the same information without entrance or pulse effects.

## Handoff checklist

1. Verify the first viewport at 1440px and 390px.
2. Verify keyboard focus and a reduced-motion render.
3. Confirm disabled static-demo actions explain why they are unavailable.
4. Run the Impeccable detector on changed UI files.
5. Run `pnpm lint`, `pnpm test`, and `pnpm build` before publishing.

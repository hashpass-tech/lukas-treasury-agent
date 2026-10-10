# LUKAS Treasury Design System

<!-- impeccable:design-schema 1 -->

## Direction

**Port Ledger** — a policy-controlled treasury presented like a trusted
dispatch desk: deep midnight ink, warm paper surfaces, mint movement signals,
and amber attention states. The first viewport should show the treasury doing
its work, not a generic hero followed by cards.

## Use scene

An operator opens the dashboard to answer three questions quickly:

1. Is the treasury ready to settle?
2. What exact obligation is in flight?
3. What can the owner change safely?

## Visual language

- Midnight navy is the operating surface; warm ivory is the reading surface.
- Lime means allowed, fresh, funded or settled. Amber means review, synthetic
  data or a bounded warning. Hot pink marks primary actions and active
  navigation. Coral is reserved for an error or blocked state.
- Space Grotesk Variable gives display and UI copy a thin, technical editorial
  voice; DM Mono is reserved for wallet addresses, hashes and chain identifiers.
- Layout uses a 12-column editorial grid on wide screens and a single-column
  reading order on small screens.
- Borders are quiet 1px rules. Panels use one elevation treatment: a soft
  shadow with a small offset. No decorative gradients or glass effects.
- The signature interaction is the live obligation review: exact amount,
  cap, recipient, policy epoch and validity window appear together before a
  signing action.

## Tokens

```css
--ink-950: #080b14;
--ink-900: #101522;
--ink-800: #1b2334;
--ink-700: #293349;
--paper-100: #f6f4ee;
--paper-200: #e9e8e1;
--text-strong: #f7f8f5;
--text-muted: #a9b3c5;
--mint-400: #b9f279;
--mint-500: #83dd69;
--amber-300: #f4c887;
--coral-300: #ff9c91;
--hot-pink: #ff5ca8;
--radius-panel: 14px;
--radius-control: 8px;
--space-unit: 4px;
```

## Component grammar

- `BrandMark`: product name plus a small live-mode indicator.
- `StatusPill`: short state with text and a colored status dot.
- `MetricCard`: one number, one label and one factual note; never nests cards.
- `Panel`: section title, optional utility action, and a single content group.
- `Field`: explicit label, control, supporting hint and disabled/read-only state.
- `ObligationRow`: amount, recipient identity, state and receipt disclosure.
- `ActionButton`: primary, secondary, quiet and destructive variants.
- `DataList`: aligned label/value rows for policy and readiness evidence.

## Responsive rules

- Wide (`>= 1080px`): header, hero split, four metrics, then two-column work
  area and two-column controls/readiness.
- Mid (`720px–1079px`): keep the hero split, collapse work and control areas
  to one column, keep metrics in two columns.
- Small (`< 720px`): one-column flow, 16px page gutters, full-width primary
  actions, address rows wrap, and navigation becomes a compact utility row.

## Accessibility

All controls have visible labels, keyboard focus uses the mint ring, disabled
controls retain readable contrast, status is communicated with text as well as
color, and `prefers-reduced-motion` removes non-essential transitions.

# Internal commerce demo

Run the deterministic local scenario with:

```sh
pnpm demo:commerce
```

The command uses `SimulationCommerceAdapter` and an injected fixed clock. It
creates a finite Spanish-ready activity, activates an approved promoter offer,
quotes and reserves one seat, confirms a simulated payment, issues a local
pass, consumes a single-use check-in, records promoter/platform allocations,
and prints a reconciled report. The output also exercises policy mismatch,
duplicate idempotency, over-capacity, expired quote, and duplicate check-in
rejections.

The simulator is intentionally local. It does not contact HashPass, a payment
provider, a remote chain, a wallet, or any external API. Atomic values are
`bigint` values in the adapter and are rendered as decimal strings only in the
console output. A policy version is copied into quotes, reservations,
payments, passes, check-ins, and settlements so an accepted booking cannot be
rewritten by a later policy update.

The report separates principal, promoter due, platform due, paid allocations,
rounding remainder, and outstanding settlement. Every row satisfies:

```text
paid = principal + promoter due + platform due + remainder
```

The output is internal simulation evidence. It does not establish operator
demand, production payment readiness, Celo readiness, HashPass integration,
product-market fit, or an external pilot.

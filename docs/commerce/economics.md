# Commerce accounting rules

The internal commerce boundary uses integer atomic amounts throughout. A
currency or token adapter supplies the verified decimal scale in the policy's
asset binding. The domain never parses floating point prices and never treats
an integer amount as a human display value.

## Allocation

Basis points use the fixed scale `10_000`. For a paid amount `T`, each bucket
is calculated with integer floor division:

```text
principal = floor(T × principalBps / 10_000)
promoter  = floor(T × promoterBps  / 10_000)
platform  = floor(T × platformBps  / 10_000)
fee       = floor(T × feeBps       / 10_000)
remainder = T - principal - promoter - platform - fee
```

The helper `allocateAtomic` returns every bucket and
`allocationConserves` checks that their sum equals the paid amount exactly.
The remainder stays with principal custody by default. A policy must keep the
sum of all configured basis point buckets at or below `10_000`; it cannot
create value through rounding.

The legacy MVP policy leaves `feeBps` unset, which is equivalent to zero. A
separately prefunded fee bucket is accounted for only when configured with a
fee recipient. Prefunding is a liability or available settlement budget; it
is not revenue and does not increase GMV or principal forwarded.

## Limits and floors

Policies may set a maximum activity capacity, aggregate budget, per-payment
exposure, minimum unit price, minimum principal proceeds, and maximum gas
amount. The simulator rejects values outside the applicable capacity, price,
budget, exposure, and proceeds limits; a transport adapter compares its own
gas estimate with `maxGasAtomic`. Quote, activity, check-in, and release
windows are explicit Unix-second windows with half-open end boundaries.

## Reservation, refund, and settlement

Reservation holds capacity but does not create revenue. An expired or unpaid
hold can be released and its capacity becomes available again. Payment must
match the immutable quote total exactly. A future refund records a bounded
amount, booking, reason, and policy version; it reverses the relevant
liability before any earned fee is paid.

Settlement requires an attendance attestation in the internal flow. It pays
promoter, platform, and fee obligations from an explicitly supplied budget,
records any outstanding amount, and supports `FAILED`, `PARTIAL`, and
`SETTLED` outcomes. An administrator cannot change a historical policy or
confiscate a committed allocation through a later policy update.

## Attribution and trust boundaries

Only an approved promoter can create an offer. A production adapter must
perform first-valid-promoter attribution and identity-based self-referral
checks at its identity boundary. Those checks are signals with documented
limits, not proof of a person's intent. Attendance is an attestation from an
authorized operator or delegate and must be single use. Dispute, no-show, and
refund handling belongs in an auditable state transition; it must not silently
rewrite the original quote or booking terms.

The simulator demonstrates these accounting and state rules locally. It does
not prove token custody, real payments, partner identity, or remote signing.

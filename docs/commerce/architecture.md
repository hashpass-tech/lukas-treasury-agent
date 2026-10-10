# Commerce domain boundary

The commerce package is the internal MVP boundary for selling a capacity
limited activity. It owns domain values and transitions; an adapter owns the
transport and custody details. The current `SimulationCommerceAdapter` keeps
state in memory so the flow can be demonstrated without HashPass, a partner
API, a wallet, or a chain.

The stable adapter contract is `commerce.v1`. Its records use opaque strings
for tenant, activity, buyer, promoter, payment event, pass, and idempotency
identifiers. Monetary values are `bigint` atomic amounts. A future ally adapter
can translate these fields to its own API while preserving the same policy
version, quote, reservation, payment, attendance, and settlement semantics.

## Value model

`domain.ts` names the transport neutral values used by the boundary:

- `CampaignPolicy` records recipients, integer basis points, asset decimals,
  budget and exposure limits, price floors, capacity, gas bounds, time windows,
  and pause/cancel state.
- `Activity`, `Promoter`, `Offer`, `Decision`, `Quote`, `Reservation`,
  `Booking`, `PaymentAttempt`, `Pass`, and `AttendanceAttestation` carry
  identifiers plus the policy version used to create them.
- `CommissionAllocation`, `Refund`, and `SettlementReceipt` describe value
  movement without naming a payment provider.

`ports.ts` contains adapter-facing inputs and receipts. The optional policy
limits keep the original internal MVP fixture compatible; when a limit is
present it is validated before the policy can be committed.

## State transitions

An operator creates a draft activity with policy version `v1`, then activates
it. An approved promoter creates an offer. A buyer receives a quote with an
expiry, reserves capacity, and confirms the exact quoted atomic amount. A
payment confirmation creates the booking. An operator or delegate issues one
pass and records one check-in attestation. Settlement can then pay the
promoter and platform allocation, including separately prefunded fees when a
fee basis point bucket is configured.

Expired or unpaid holds are explicitly released. Idempotency keys, payment
event identifiers, and check-in event identifiers are single use. The
simulator replays a release receipt for the same reconciliation key and
rejects replayed payment or attendance events.

## Immutability and versioning

Policy versions are scoped to an activity and cannot be reused. A quote stores
the price, quantity, total, expiry, and policy version it accepted. A booking
stores the reservation, paid amount, parties, quantity, and policy version.
Updating an activity policy therefore affects future offers and quotes only;
settlement looks up the historical policy version captured by the booking.
Adapter receipts return cloned snapshots so callers cannot mutate the
simulator's committed state through a response.

## Ally integration seam

An external adapter should implement the existing capability negotiation and
map its own identity or pass records to the opaque IDs in `ports.ts`. It must
preserve tenant binding, policy version binding, idempotency, exact amount
matching, single-use check-in, and settlement receipts. HashPass or another
ally remains a future transport and identity adapter; no integration claim is
made by this internal simulation.

# Commerce interoperability boundary

`packages/commerce/ports.ts` defines the stable `CommerceAdapter`,
`PaymentRailAdapter`, and `PassAdapter` ports. They exchange opaque tenant,
role, booking, payment, pass, and check-in identifiers; integer atomic amounts;
policy versions; idempotency keys; and versioned event/receipt records.

An adapter can be implemented behind HTTP, a queue, a database, a chain
client, HashPass, or another allied system without changing the policy or
accounting API. The ports do not import HashPass, assume an HTTP framework, use
floating-point money, or handle private keys. A partner adapter owns its
identifier mapping and must preserve these semantics:

- a payment confirmation is tied to one booking-specific event and one policy
  version;
- capacity remains held until a reservation is confirmed or explicitly
  reconciled; expired or unpaid holds use the explicit idempotent
  `reconcileReservation` operation;
- a pass is issued only after payment confirmation and a check-in event is
  consumed at most once;
- settlement exposes principal, promoter due, platform due, integer rounding
  remainder, paid amounts, and outstanding amounts;
- every mutating operation carries a tenant, role, and idempotency key.
- every emitted event carries the `commerce.v1` schema and the policy version
  that governed the operation.

`SimulationCommerceAdapter` implements the local capabilities and returns an
explicit unsupported result for `remote-payment` and
`hashpass-native-pass`. That result is a capability boundary, not a simulated
claim of partner integration. A future HashPass or allied adapter must be
contract-tested against the same ports, including authorization, idempotency,
payment event identity, pass issuance, single-use check-in, policy-version
freezing, and partial/failed settlement behavior.

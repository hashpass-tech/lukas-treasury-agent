# Internal commerce MVP with future HashPass/allied interoperability

Source: [Issue #1](https://github.com/hashpass-tech/lukas-treasury-agent/issues/1), retrieved October 10, 2026. Full source: [snapshot](../../../ISSUE-1.md). Execution order: [plan](../../../PLAN.md).

## Goal

- [x] Demonstrate the complete bounded commerce capability locally, without external development or services, while preserving stable adapter contracts for future HashPass/allied integrations and later wCOP deployment.

## Baseline and Scope

Reviewed local HEAD: `117394b67c542c0ae85526ace0eefe2c9a4001bd`. Issue planning baseline: `5bad364740f529fe114e11a0382b016df6c6d60a`. This is a planning specification, not an implemented commerce release.

The current Hono API, Next app, SQLite Store, worker journal/recovery and attribution utilities are reuse candidates. `Intent.amountLukasWad`, methodology/oracle fields and TreasuryVault are LUKAS-specific. `assertLocal()` rejects remote chain/mode/RPC use; existing operational commands prepare plans, not deployment. Commerce requires a distinct domain, contract and constrained signer, rather than renamed UI fields.

The first MVP is one deterministic internal simulation: a finite activity, policy, approved promoter, Spanish-ready checkout data, simulated payment, pass issuance, single-use check-in and a success-fee report. It must run without an operator, external API, remote chain, customer, credentials or real funds. Principal and fee allocations are modeled explicitly, and the simulation is labeled as simulation evidence.

The implementation exposes transport-neutral commerce, payment-rail and pass/check-in ports. Future HashPass or allied adapters can map their identifiers and capabilities into those ports without changing policy, accounting or agent decisions. An adapter is not considered integrated until its contract, authorization, idempotency and check-in semantics are tested.

The later external pilot remains one real dated activity, finite allocated seats, operator-approved promoters, mobile checkout and a success fee on completed attributed sales. Principal goes to the operator; separately prefunded budget pays earned promoter and platform fees. Buyer funds are not protective escrow. Refunds require operator funding/authorization. Attendance relies on authenticated operator/delegate testimony.

Exclude LKS issuance/redemption, basket FX, remittances/payroll, a discovery marketplace, protected resale, NFT passes, hardware, inbox scraping, unrestricted outreach, automated paid advertising and track-driven x402 scope. Optional LLM copy has no key access or policy authority.

## Invariants

- Integer atomic amounts and basis points; verified token decimals; explicit rounding remainder. Retail floor and minimum economic proceeds are separate.
- Principal is forwarded exactly once; required allocation is accepted atomically with booking; allocated funds cannot be withdrawn as free budget.
- Confirmed bookings plus held seats never exceed allocation; unresolved submitted payments retain capacity until reconciled.
- Accepted quotes freeze activity, price, fees, recipient, first-valid-promoter and policy version; new policy cannot rewrite them.
- Canonical success and exact booking-specific payment event precede pass issuance; unique event consumption, check-in and settlement resist replay.
- Attendance-bound payout tracks all recipients; partial payout is not full settlement. Unfunded refund stays pending and outstanding.
- Tenant/role checks and constrained signer bind chain, method, policy, recipients, amount, nonce, gas and time. Reorg/restart/replacement preserve invariants.
- GMV, budget prefunding, merchant economic proceeds and recognized revenue are separate. Attributed sales are not causal incrementality without a comparison.

## Tasks

- [x] MVP-01: [Build an internal commerce demo with future partner adapters](../../done/issue-1-hashpass-commerce/00-internal-commerce-demo-and-interop.feature.md)
- [ ] HP-01: [Validate paid pilot and record scope decision](../../in-progress/issue-1-hashpass-commerce/01-validate-paid-pilot-and-record-scope-decision.docs.md)
- [x] HP-02: [Specify commerce domain and accounting](../../done/issue-1-hashpass-commerce/02-specify-commerce-domain-and-accounting.feature.md)
- [ ] HP-03: [Implement direct wCOP checkout and allocation contract](./03-implement-direct-wcop-checkout-and-allocation-contract.feature.md)
- [ ] HP-04: [Implement attendance settlement and truthful refunds](./04-implement-attendance-settlement-and-truthful-refunds.feature.md)
- [ ] HP-05: [Extend constrained signer and attribution for commerce](./05-extend-constrained-signer-and-attribution-for-commerce.feature.md)
- [ ] HP-06: [Add commerce migrations and transactional inventory](./06-add-commerce-migrations-and-transactional-inventory.feature.md)
- [ ] HP-07: [Expose tenant-safe commerce API](./07-expose-tenant-safe-commerce-api.feature.md)
- [ ] HP-08: [Reconcile durable commerce payment and settlement attempts](./08-reconcile-durable-commerce-payment-and-settlement-attempts.feature.md)
- [ ] HP-09: [Implement bounded observation-driven sales agent](./09-implement-bounded-observation-driven-sales-agent.feature.md)
- [ ] HP-10: [Deliver mobile Spanish checkout pass and check-in](./10-deliver-mobile-spanish-checkout-pass-and-check-in.feature.md)
- [ ] HP-11: [Deliver operator promoter and financial reporting views](./11-deliver-operator-promoter-and-financial-reporting-views.feature.md)
- [ ] HP-12: [Verify commerce invariants recovery and CI discovery](./12-verify-commerce-invariants-recovery-and-ci-discovery.test.md)
- [ ] HP-13: [Prepare operations and execute actual Celo Sepolia rehearsal](./13-prepare-operations-and-execute-actual-celo-sepolia-rehearsal.chore.md)
- [ ] HP-14: [Verify official wCOP event identity and mainnet authorization](./14-verify-official-wcop-event-identity-and-mainnet-authorization.chore.md)
- [ ] HP-15: [Run independent paid pilot and reconcile business results](./15-run-independent-paid-pilot-and-reconcile-business-results.docs.md)
- [ ] HP-16: [Freeze delivery evidence and prepare submission](./16-freeze-delivery-evidence-and-prepare-submission.docs.md)

## Acceptance Criteria

- [x] A local demo runs end to end without external services, credentials, remote chain or real funds.
- [x] The demo deterministically exercises policy, capacity, quote/reservation, simulated payment, pass, check-in, allocation and reporting failure cases.
- [x] Commerce and partner adapter ports are transport-neutral, integer-safe, idempotent and capability-aware.
- [x] A future HashPass/allied adapter can replace the simulation rail without changing policy/accounting interfaces.

### Later External Validation Criteria

- [ ] Independent operator agreement, real inventory and concrete paid trial justify the full build.
- [ ] Buyer reserves, pays official wCOP, receives verified pass and attends; agent settles earned commissions and fee exactly once.
- [ ] Changed capacity/sales/time causes a bounded audited offer decision without per-action approval within existing authority.
- [ ] Inventory/payment/allocation/refund/retry invariants are proven in unit/property, real-EVM, recovery and browser tests running in CI.
- [ ] Actual authorized Celo Sepolia rehearsal and verified mainnet token, contracts, canonical ERC-8004 identity and attribution evidence exist.
- [ ] Permanent event wallet and issued tag are preserved through existing configuration; independent-user provenance and reuse are honest.
- [ ] Actual pilot results reconcile receipts, merchant proceeds, acquisition cost and recognized platform fee without double counting.
- [ ] Custody, attendance trust, refund liabilities, onboarding friction and unresolved commercial hypotheses are documented.
- [ ] Functional MVP and evidence freeze October 30; submission deadline checked live before submission.

## Open Evidence Gates

No operator agreement, completed paid pilot, verified official token configuration, real remote deployment, identity registration or mainnet authorization is asserted by this spec. MVP-01 collects internal demo evidence. HP-01 and HP-13–16 collect later external/network/submission evidence. Dates beyond the issue snapshot must be verified before use.

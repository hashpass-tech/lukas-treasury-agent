# Issue #1 execution plan

MVP-01 is complete as the first internal delivery slice. It does not require an operator, external API, remote chain, real customer or third-party deployment. HP-01 remains active preparation for a later external validation gate; its missing commercial evidence does not block the internal MVP. Dates are planning targets from the issue, not delivery claims. Dependencies use stable IDs and remain valid when files move.

| ID     | Task                                                                                                                                                                            | Depends on                 | Issue step |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------- |
| MVP-01 | [Build an internal commerce demo with future partner adapters](tasks/done/issue-1-hashpass-commerce/00-internal-commerce-demo-and-interop.feature.md)                           | None                       | MVP        |
| HP-01  | [Validate paid pilot and record scope decision](tasks/in-progress/issue-1-hashpass-commerce/01-validate-paid-pilot-and-record-scope-decision.docs.md)                           | None                       | 0          |
| HP-02  | [Specify commerce domain and accounting](tasks/done/issue-1-hashpass-commerce/02-specify-commerce-domain-and-accounting.feature.md)                                             | MVP-01                     | 1          |
| HP-03  | [Implement direct wCOP checkout and allocation contract](tasks/todo/issue-1-hashpass-commerce/03-implement-direct-wcop-checkout-and-allocation-contract.feature.md)             | HP-02                      | 2          |
| HP-04  | [Implement attendance settlement and truthful refunds](tasks/todo/issue-1-hashpass-commerce/04-implement-attendance-settlement-and-truthful-refunds.feature.md)                 | HP-03                      | 2          |
| HP-05  | [Extend constrained signer and attribution for commerce](tasks/todo/issue-1-hashpass-commerce/05-extend-constrained-signer-and-attribution-for-commerce.feature.md)             | HP-03, HP-04               | 2, 7       |
| HP-06  | [Add commerce migrations and transactional inventory](tasks/todo/issue-1-hashpass-commerce/06-add-commerce-migrations-and-transactional-inventory.feature.md)                   | HP-02, HP-03               | 3          |
| HP-07  | [Expose tenant-safe commerce API](tasks/todo/issue-1-hashpass-commerce/07-expose-tenant-safe-commerce-api.feature.md)                                                           | HP-05, HP-06               | 3          |
| HP-08  | [Reconcile durable commerce payment and settlement attempts](tasks/todo/issue-1-hashpass-commerce/08-reconcile-durable-commerce-payment-and-settlement-attempts.feature.md)     | HP-04, HP-05, HP-06, HP-07 | 3          |
| HP-09  | [Implement bounded observation-driven sales agent](tasks/todo/issue-1-hashpass-commerce/09-implement-bounded-observation-driven-sales-agent.feature.md)                         | HP-02, HP-07, HP-08        | 4          |
| HP-10  | [Deliver mobile Spanish checkout pass and check-in](tasks/todo/issue-1-hashpass-commerce/10-deliver-mobile-spanish-checkout-pass-and-check-in.feature.md)                       | HP-07, HP-08               | 5          |
| HP-11  | [Deliver operator promoter and financial reporting views](tasks/todo/issue-1-hashpass-commerce/11-deliver-operator-promoter-and-financial-reporting-views.feature.md)           | HP-09, HP-10               | 5          |
| HP-12  | [Verify commerce invariants recovery and CI discovery](tasks/todo/issue-1-hashpass-commerce/12-verify-commerce-invariants-recovery-and-ci-discovery.test.md)                    | HP-09, HP-10, HP-11        | 6          |
| HP-13  | [Prepare operations and execute actual Celo Sepolia rehearsal](tasks/todo/issue-1-hashpass-commerce/13-prepare-operations-and-execute-actual-celo-sepolia-rehearsal.chore.md)   | HP-05, HP-12               | 6          |
| HP-14  | [Verify official wCOP event identity and mainnet authorization](tasks/todo/issue-1-hashpass-commerce/14-verify-official-wcop-event-identity-and-mainnet-authorization.chore.md) | HP-01, HP-13               | 6, 7       |
| HP-15  | [Run independent paid pilot and reconcile business results](tasks/todo/issue-1-hashpass-commerce/15-run-independent-paid-pilot-and-reconcile-business-results.docs.md)          | HP-01, HP-11, HP-12, HP-14 | 8          |
| HP-16  | [Freeze delivery evidence and prepare submission](tasks/todo/issue-1-hashpass-commerce/16-freeze-delivery-evidence-and-prepare-submission.docs.md)                              | HP-15                      | 9          |

## Delivery sequence

1. MVP-01 — internal simulation and adapter contracts; no external dependency.
2. PR 1: HP-02 — domain, policy and accounting built on the internal rail.
3. PR 2: HP-03–05 — direct wCOP contract, refund/attendance settlement and signer.
4. PR 3: HP-06–08 — persistence, API and durable reconciliation.
5. PR 4: HP-09 — bounded decisions and worker integration.
6. PR 5: HP-10–11 — buyer/pass/check-in and role/reporting views, using adapters.
7. PR 6: HP-12–16 — verification, optional external pilot, network/identity gates and submission.

Each PR must explain the concrete behavior, checks and remaining limitations. Internal simulation evidence is not external demand or payment evidence. External evidence gates cannot be completed by code alone. This planning change does not authorize broadcasting funds or outreach.

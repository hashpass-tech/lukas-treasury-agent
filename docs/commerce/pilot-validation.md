# Paid pilot validation — HP-01

Preparation started October 10, 2026. **Commercial evidence is pending.** No interviews, selected operator, agreed inventory, payments or completed trial are verified by this document. Planning target: October 10–12; proposed activity must be delivered before October 30, 2026. Dates are targets, not commitments.

As of October 10, the user confirmed there is no pilot operator, selected city, dated activity or manual paid-trial evidence. The user reports an existing product at hashpass.tech and [its repository](https://github.com/hashpass-tech/hashpass.tech/). Treat it as a reuse candidate; this is not independent pilot validation or verified API integration.

Source: [issue snapshot](../../.specs/ISSUE-1.md). Task: [HP-01](../../.specs/tasks/in-progress/issue-1-hashpass-commerce/01-validate-paid-pilot-and-record-scope-decision.docs.md).

## Collection workflow

1. Conduct at least five interviews using the [Spanish interview guide](operator-interview.md). Assign anonymous operator IDs before recording public summaries.
2. Compare recent unsold capacity, channels, acquisition costs, reconciliation work and willingness to pay. Select an independent operator with real dated paid inventory and a reachable permitted channel.
3. Capture written explicit agreement using the [commercial checklist](pilot-agreement-checklist.md), including a genuine promoter, prospective buyers and wallet/onboarding needs.
4. Run a small authorized manual paid-sales trial on the proposed offer and terms. The actual supported payment method must be explicit; a fiat trial does not establish wCOP readiness.
5. Reconcile payments and commercial results, document the comparison limitations, then record go, narrow or stop before expanding the build.

## Interview slots

| Stable ID | Interview state        | Paid activity / recent unsold seats | Channels / acquisition cost | Payment / refunds / reconciliation | Proposed value and willingness to pay | Evidence IDs |
| --------- | ---------------------- | ----------------------------------- | --------------------------- | ---------------------------------- | ------------------------------------- | ------------ |
| OP-01     | Pending; not conducted | Pending                             | Pending                     | Pending                            | Pending                               | Pending      |
| OP-02     | Pending; not conducted | Pending                             | Pending                     | Pending                            | Pending                               | Pending      |
| OP-03     | Pending; not conducted | Pending                             | Pending                     | Pending                            | Pending                               | Pending      |
| OP-04     | Pending; not conducted | Pending                             | Pending                     | Pending                            | Pending                               | Pending      |
| OP-05     | Pending; not conducted | Pending                             | Pending                     | Pending                            | Pending                               | Pending      |

Only anonymized findings belong here. Keep names, contacts, customer records, raw financial documents, wallet identity mappings, credentials, screenshots and recordings outside tracked files. Evidence references must be opaque IDs, not private storage URLs. Obtain permission separately before publishing any quote or public receipt.

## Evidence ledger

Each ID below is a requested evidence item, **not an existing evidence record**. On receipt, record its date, reviewer, anonymized finding and verification limits. Separate operator statements from verified records and observed outcomes.

| Evidence ID    | Required evidence                                                              | State   | Date / reviewer / scrubbed finding |
| -------------- | ------------------------------------------------------------------------------ | ------- | ---------------------------------- |
| EV-INT-01–05   | Five interviews, mapped respectively to OP-01–05                               | Missing | Pending                            |
| EV-SELECT-01   | Independent operator, city, dated paid activity, available allocated inventory | Missing | Pending                            |
| EV-AGREE-01    | Written inventory/economics/channel/attendance/refund agreement                | Missing | Pending                            |
| EV-CHANNEL-01  | Genuine promoter, prospective buyers, permitted reachable channel              | Missing | Pending                            |
| EV-BASE-01     | Comparable-session, preactivation or separated-group baseline                  | Missing | Pending                            |
| EV-ONBOARD-01  | Actual wallet, wCOP and gas acquisition/support assessment                     | Missing | Pending                            |
| EV-TRIAL-01    | Authorized trial records and reconciled actual payments                        | Missing | Pending                            |
| EV-DECISION-01 | Reviewed scope decision and supporting evidence IDs                            | Missing | Pending                            |

## Selected pilot and readiness

| Field                                                                            | Current evidence                    |
| -------------------------------------------------------------------------------- | ----------------------------------- |
| Operator ID / independence / activity / Colombian city / date and timezone       | Not selected; pending EV-SELECT-01  |
| Allocated seats / retail price floor / minimum merchant proceeds                 | Not agreed; pending EV-AGREE-01     |
| Promoter commission / HashPass success fee / prefunded budget / costs            | Not agreed; pending EV-AGREE-01     |
| Permitted channel / genuine promoter / reachable buyers                          | Not verified; pending EV-CHANNEL-01 |
| Attendance authority / cancellation / refund / no-show terms                     | Not agreed; pending EV-AGREE-01     |
| Trial payment method / payment recipient / funding authorization                 | Not agreed; pending EV-AGREE-01     |
| Existing Celo users versus newly onboarded users / team funding provenance       | Unknown; pending EV-ONBOARD-01      |
| Wallet, verified official wCOP acquisition and gas route / time and support cost | Not tested; pending EV-ONBOARD-01   |

The proposed production route is wCOP on Celo, principal forwarded to the operator and separate prefunding for earned commissions and fees. Buyer funds are not protective escrow. Token/deployment/identity/mainnet authorization remain later evidence gates; this preparation grants no authority to transact or contact anyone.

## Comparison method

Choose and record the method **before** the trial: a recent comparable session, measured sell-through before activation, or a separately defined offer group. Record activity, price, allocated capacity, observation window, sales sources and known differences such as seasonality or overlapping promotions. Count confirmed payments, completed attendance, cancellations and refunds separately.

Compute paid sell-through as confirmed paid bookings minus canceled/refunded bookings, divided by allocated capacity; disclose the numerator, allocated-capacity denominator and observation window. Report completed/attended sales separately from this paid-booking measure. Report attributed completed sales and acquisition cost (promoter fees, platform fees and agreed acquisition expenses per completed sale). Reconcile operator economic proceeds separately from buyer gross payments and prefunded budget. Recognized HashPass fees are revenue; GMV and deposited budget are not revenue. Report gas, ramp/payment costs, support time and refunds separately, then calculate contribution margin from actual allocated costs without double counting.

No baseline is available yet. If comparison quality is weak or sample sizes small, report attributed sales only; do not claim causal incrementality, product-market fit or statistically reliable lift. Three completed bookings is a later internal pilot target, not validation by itself.

## Actual manual paid-trial results

**Not started; payments and results unknown.** Missing evidence must not be represented as measured zero. Add anonymized rows only when observed; separate paid, attended, refunded and unresolved states.

| Trial ID | Activity / offer / policy reference | Booking / payment evidence IDs | Payment method / amount | Attendance / refund state | Commission / fee / costs / merchant proceeds |
| -------- | ----------------------------------- | ------------------------------ | ----------------------- | ------------------------- | -------------------------------------------- |
| TRIAL-01 | Pending selection                   | No records supplied            | Unknown                 | Unknown                   | Unknown                                      |

Trial totals, conversion/abandonment, onboarding/support time, completed sales, promoter payout, recognized fee and operator repeat-use feedback: **unknown, not yet measured**. Actual chain receipts are required for chain claims; an interview, mock or fiat receipt cannot prove the on-chain lifecycle.

## Scope decision

Current decision: **pending evidence; do not expand the full build**.

| Decision | Required basis                                                                                                                                                                                                                                           | Action                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Go       | Five interviews recorded; independent operator approves real dated paid inventory; economics, permitted reachable channel and attendance/refund terms agreed; concrete authorized paid-sales trial reconciled; onboarding and baseline limits documented | Record EV-DECISION-01, reviewer/date and evidence IDs; release HP-02 dependency                              |
| Narrow   | Evidence supports paid collection/reconciliation but not worthwhile agent-led acquisition, or onboarding makes the proposed flow impractical                                                                                                             | Document supported use case, commercial evidence and excluded scope; revise issue/spec before implementation |
| Stop     | No independent inventory/payment agreement, unreachable distribution, unacceptable economics, or infeasible delivery/participation                                                                                                                       | Record reasons and missing evidence; keep dependent implementation gated                                     |

Completion requires actual HP-01 acceptance evidence. Prepared guides and empty evidence slots do not satisfy the commercial gate.

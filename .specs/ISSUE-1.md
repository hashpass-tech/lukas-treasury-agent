# Issue #1 source snapshot

Source: https://github.com/hashpass-tech/lukas-treasury-agent/issues/1

Retrieved: October 10, 2026 (America/Bogota). State: OPEN. No issue comments at retrieval. Refresh the live issue before changing scope.

## Problem and intended outcome

The current product schedules LUKAS-denominated supplier payments, but it does not yet demonstrate a compelling reason for a merchant to adopt LUKAS or buy the application. The commercial focus of this MVP is changing to **HashPass as a bounded sales agent for paid experiences and recurring events in Colombia**.

**Merchant promise:** "Tell HashPass which seats you need to sell, your minimum price, and your maximum acquisition budget. The agent activates approved offers and promoter links, confirms paid bookings, issues passes, and settles commissions for completed sales."

The outcome to prove is **additional paid bookings with an acceptable acquisition cost and positive merchant proceeds**. Automated payments and a chatbot are implementation components, not sufficient proof of value.

This issue is the implementation epic for the new approach. Commercial demand remains a hypothesis until an independent operator accepts the terms and real customers pay. Do not describe attributed sales as causally incremental revenue without a comparison.

## Baseline and reuse

Planning baseline: `main` tree `5bad364740f529fe114e11a0382b016df6c6d60a`, reviewed on October 9, 2026.

- Reuse the authenticated Hono API, Next.js application, SQLite persistence, durable worker, transaction journals, recovery/reconciliation patterns, constrained signer, attribution utilities, identity tooling, and verified spend controls where appropriate.
- The documented baseline is local; the "Sepolia path" evidence is a local HTTPS emulator. Actual Celo Sepolia and mainnet evidence remain outstanding.
- Existing `packages/core/domain.ts`, policy, signer and `packages/contracts/Treasury.sol` are tied to LUKAS basket amounts, methodology hashes and oracle rounds. They cannot become fixed-wCOP commerce settlement through a UI rename.
- Existing treasury owner withdrawals and cancellations mean that contract is **not customer escrow or an irrevocable commission guarantee**.
- Reuse HashPass pass/check-in concepts through a narrow adapter; do not migrate the entire HashPass monorepo or authentication stack into this repository.
- Keep the repository and issued attribution configuration. Product naming can change without renaming the GitHub repository or creating a new event wallet.

## P0 scope

| Area             | MVP decision                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Customer         | One independent operator of a paid workshop or experience                                                   |
| Geography        | One Colombian city; prioritize an operator the team can reach now                                           |
| Inventory        | One activity with a real date, finite seats, and permission to sell them                                    |
| Currency         | Prices displayed in COP; payment and commission settlement in official wCOP on Celo                         |
| Distribution     | A small set of operator-approved promoters and their referral links                                         |
| Agent            | Observe sales/capacity/time, choose an authorized offer, and settle earned commissions within signed limits |
| Buyer experience | Mobile web link, clear price and terms, payment, booking confirmation, QR pass                              |
| Revenue          | An explicitly agreed success fee on completed attributed sales                                              |
| Custody          | Buyer principal forwarded to the operator; separately prefunded merchant commission budget                  |
| Refunds          | Operator-funded, explicitly initiated refund flow; no promise of automatic or guaranteed customer refunds   |
| Operations       | One persistent deployment with real backups, monitoring and an operator runbook                             |

Out of P0: LKS issuance/redemption, basket FX, multi-currency routing, general remittances/payroll, a full discovery marketplace, protected resale of third-party tickets, NFT passes, hardware nodes, scraping arbitrary inboxes, unrestricted outreach, paid advertising automation, and x402 added solely to score another track.

A deterministic decision engine is acceptable. An LLM may draft copy or explain decisions, but must not invent availability, change recipients, exceed budgets, authorize refunds, or directly access signing keys.

## End-to-end acceptance scenario

1. The operator creates an activity, allocates sellable capacity and configures signed pricing/commission limits.
2. The operator funds the commission budget and authorizes the approved promoters, settlement rules and execution window.
3. The agent evaluates actual remaining capacity, sales pace and time until the activity. It activates an eligible offer and records why.
4. A promoter shares the offer link through a channel they are authorized to use.
5. A buyer gets a short-lived reservation and a binding quote that identifies the activity, price, promoter, payment recipient, fees and cancellation terms.
6. The buyer pays wCOP. The payment is uniquely linked to the booking and reaches canonical confirmation before a valid pass is issued.
7. An authenticated operator records attendance using the pass. The check-in attestation is scoped to that booking and cannot be replayed.
8. The agent executes the earned promoter commission and HashPass fee exactly once from the allocated budget, and records the chain receipts.
9. The operator sees bookings, completed sales, pending/paid commissions, refunds, net proceeds and the platform fee in one activity report.
10. Cancellation, insufficient funds, an expired quote, repeated webhooks, duplicate check-in and worker restart do not cause overselling or double settlement.

## Step 0 — Validate the paid pilot before expanding the build

Target: October 10–12. This is a commercial gate, not a claim that validation already exists.

- [ ] Interview at least five operators who sell paid activities. Ask for recent examples of unsold capacity, current sales channels, referral commissions, payment friction, refunds and time spent reconciling.
- [ ] Select one operator with a real activity that can be sold and delivered before the October 30 freeze. A free conference or a hypothetical future activity is not enough.
- [ ] Obtain written agreement on allocated inventory, retail price floor, minimum merchant proceeds, promoter budget, HashPass fee, refund/no-show policy, permitted channels and who records attendance.
- [ ] Identify at least one genuine promoter and real prospective buyers. Record whether they already use Celo or will be onboarded for the first time.
- [ ] Run a small manual sales trial using the proposed offer and commission terms. Record actual payments, not only expressions of interest.
- [ ] Document current performance and the comparison method: previous comparable session, sell-through before agent activation, or a clearly separated offer group. If no sound baseline is available, report attributed sales without claiming incrementality.
- [ ] Record findings in `docs/commerce/pilot-validation.md`, keeping names, contact information and private financial evidence out of the public repo.
- [ ] Proceed with the full sales-agent scope only if an operator supplies actual inventory and accepts a real payment arrangement. If the evidence supports only collection/reconciliation, document a scope decision before changing this epic.

**Exit evidence:** an operator-approved activity, agreed economics, a reachable distribution channel, and a concrete paid-sales trial.

## Step 1 — Specify the commerce domain, policy and fund flows

Suggested files: new `packages/commerce/` modules and `docs/commerce/architecture.md`; extend existing shared infrastructure rather than replacing all core modules.

- [ ] Define Activity, CampaignPolicy, Promoter, Offer, Decision, Reservation, Booking, PaymentAttempt, Pass, AttendanceAttestation, CommissionAllocation, Refund and SettlementReceipt.
- [ ] Bind all records to operator/activity identifiers and the configured chain/token. Use database migrations and uniqueness constraints.
- [ ] Store token amounts as integer atomic units and rates as integer basis points. Read verified token decimals; never assume wCOP uses 18 decimals or use JavaScript floating point for settlement.
- [ ] Separate retail price floor from minimum merchant proceeds. Define rounding explicitly and assign any rounding remainder so the accounting balances.
- [ ] Policy must include approved recipients/promoters, price floor, minimum proceeds, promoter/HashPass fee caps, total campaign budget, per-payment/daily exposure, maximum capacity, quote lifetime, activity window, check-in window, commission release cutoff, pause/cancellation behavior and gas limits.
- [ ] Bind offers and bookings to an immutable policy version. Changing policy must not silently rewrite an accepted booking.
- [ ] Specify reservation expiry and transitions separately from payment confirmation and commission settlement. Keep paid bookings, provisional submissions and refunded/canceled bookings distinguishable.
- [ ] Choose first-valid-promoter attribution for P0. Display it before payment and freeze it on the accepted quote; retries must not change who gets paid.
- [ ] Reject self-referral by the buyer/operator using known account and wallet identities. Document the limits of this check; it is not complete Sybil resistance.
- [ ] Describe trust boundaries: operator-supplied availability and authenticated attendance are trusted business inputs. Check-in is evidence of attendance, not a guarantee of service quality.

**Illustrative economics, subject to operator agreement:** on a COP 100,000 completed booking, promoter 7%, HashPass 3%, operator economic proceeds COP 90,000 before separately disclosed costs. Never present these trial rates as validated pricing.

In the selected custody model, the buyer pays COP 100,000 worth of wCOP to the operator, and COP 10,000 is allocated from the operator's prefunded commission budget. After completion, COP 7,000 goes to the promoter and COP 3,000 to HashPass. The two transfers represent one sale; do not double-count the prefunding as revenue or additional GMV.

## Step 2 — Add direct wCOP payment and commission settlement

Implement a dedicated, reviewed commerce contract/module, for example `packages/contracts/CommerceSettlement.sol`. Do not route COP prices through the LUKAS index or use a fake oracle to satisfy the old intent type.

- [ ] Add a distinct direct-amount EIP-712 domain/intent schema and contract path. Bind chain, verifying contract, campaign/policy version, booking ID, payer, operator, promoter, fee recipient, amount, fee allocation, nonce and expiry.
- [ ] Use a binding quote and a booking-specific checkout call/event so concurrent equal-value payments are unambiguous. A screenshot, submitted transaction hash or arbitrary ERC-20 transfer is not sufficient booking evidence.
- [ ] Forward buyer principal to the configured operator and emit a payment event containing the booking identifier. Verify exact received amounts; reject unsupported transfer-fee/rebasing behavior.
- [ ] Require sufficient confirmed commission prefunding before accepting the booking. Allocate the commission amount atomically with the accepted payment; failure must revert the booking/payment operation.
- [ ] Track allocated versus unallocated campaign funds. Allow withdrawal of unallocated funds only; an owner/admin withdrawal must not drain commissions already committed to accepted bookings.
- [ ] Enforce the immutable fee calculation, authorized recipients, signed policy limits, booking uniqueness and replay protection on-chain where they control money.
- [ ] Require an operator or explicitly delegated check-in attestation before attendance-based commission settlement. Bind the attestation to the activity, booking and release window; restrict the delegate's authority.
- [ ] Settle promoter and platform allocations atomically or through independently idempotent components. Never mark the entire booking settled after only one recipient was paid.
- [ ] Define no-show, expiry, dispute/pause and unused-budget release rules before deployment. Specify what can remain locked and how it is resolved; do not add an admin bypass that confiscates committed allocations.
- [ ] Implement the operator-funded refund path: return the original principal to the original payer, bind it to the booking, emit refund evidence and release unearned allocations only after the refund is confirmed. If funds/authorization are absent, show `REFUND_PENDING` and retain a truthful outstanding liability.
- [ ] State clearly that buyer funds are not held in protective escrow. Post-settlement disputes/refunds need operator handling; an irreversible commission payment cannot be silently "rolled back."
- [ ] Extend the constrained signer for the specific commerce methods and typed messages. Preserve recipient, amount, chain, nonce, policy, gas and expiry restrictions; no arbitrary transaction signing.
- [ ] Adapt deployment/readiness tooling to this separate direct-wCOP mode. Index/oracle evidence is not required for a fixed wCOP amount; chain/token/contract/identity/authorization verification remains required. Keep existing LUKAS mode checks intact.

**Exit evidence:** tested direct-wCOP accounting, distinct intent/domain, allocation safety, replay protection, refund truthfulness and reviewed fund-flow documentation.

## Step 3 — Implement inventory, reservations and payment reconciliation

Suggested locations: new commerce repositories/services, `apps/api/server.ts`, `packages/core/storage.ts` shared utilities and worker adapters.

- [ ] Add authenticated operator endpoints to create/update the activity, allocate capacity, approve promoters, fund/inspect campaign budget and publish/pause offers.
- [ ] Require role/tenant checks for every operator, promoter and check-in operation. Public buyers may read offers and use their own reservations only.
- [ ] Reserve inventory transactionally with short expiries, idempotency keys and concurrent-request protection. Confirmed bookings plus active reservations must not exceed allocated capacity.
- [ ] Handle quotes expiring during submission and payments landing late. Contract acceptance must enforce the relevant expiry/capacity bound; never issue a pass for a rejected payment.
- [ ] On expiry, do not immediately resell a seat while an earlier submitted payment remains unresolved. Reconcile that attempt before releasing inventory; provide an explicit recovery path.
- [ ] Freeze activity/price/promoter/terms on the accepted quote. Use server-issued opaque booking IDs and never trust a client's price or fee calculation.
- [ ] Persist prepared requests and all payment/settlement attempts before broadcast. Reuse the existing nonce/journal/replacement patterns through commerce-specific adapters.
- [ ] Verify receipt success, canonical block/finality, token, exact amount, booking event, payer and recipient before confirming payment. Enforce unique consumption of each payment event.
- [ ] Reconcile restarts, duplicate callbacks, pending transactions, mined reverts and reorgs without creating another paid booking or another commission.
- [ ] Synchronize capacity with the operator's allocation; disclose that P0 does not integrate every external sales channel.
- [ ] Provide clear failure states and human recovery actions. Do not label a submitted or unresolved payment as "paid."

**Exit evidence:** a buyer can reserve and pay once; concurrency, retries and recovery preserve inventory and money invariants.

## Step 4 — Build the bounded sales agent

Suggested files: `packages/commerce/agent.ts`, `packages/commerce/policy.ts`, a decision journal and an adapter in `apps/worker/worker.ts`.

- [ ] Define trusted observations: available seats, active reservations, confirmed bookings, time remaining, current offer, observed sales pace, promoter performance, funded budget and policy version.
- [ ] Define the small allowed action set: maintain/pause an offer, activate a preapproved price/commission tier, publish an offer to an approved promoter portal, expire offers and execute eligible commission settlement.
- [ ] Implement a deterministic first policy. Example: if sell-through is below the agreed threshold and enough time remains, select an eligible tier whose merchant proceeds meet the floor and whose total commission is funded. Otherwise maintain or pause. Missing/stale evidence must block the action.
- [ ] Do not invent demand forecasts or optimize from insufficient sample sizes. Record when a choice uses a merchant-provided rule rather than a learned prediction.
- [ ] Record observation IDs, policy version, selected/rejected alternatives, reason codes, expected economics and the result for every decision.
- [ ] Execute within one-time campaign authority; routine allowed decisions must not require manual approval each time. Changes beyond the existing authority require new authorization.
- [ ] Publish authorized offers in the promoter portal. External WhatsApp/email messages are manual sharing or require explicit sender/recipient permission and supported integration; creating this issue does not authorize sending messages.
- [ ] Keep generated copy separate from the trusted transaction/policy layer. The engine validates every proposed action regardless of its origin.
- [ ] Demonstrate at least one real offer decision caused by changed sales/capacity/time observations and an autonomous settlement after valid attendance.

**Exit evidence:** the agent makes a commercially meaningful bounded decision, with an audit trail, rather than only forwarding a webhook to a payment function.

## Step 5 — Deliver the merchant, promoter and buyer interfaces

Use `apps/web` with a mobile-first Spanish product experience; keep developer documentation in English.

- [ ] Operator setup: activity/date/capacity, base price, minimum proceeds, acquisition budget, promoter approvals and concise cancellation/commission terms.
- [ ] Operator review: exact recipients/limits, current funding, offer preview, authorization, pause and unallocated-budget withdrawal.
- [ ] Promoter view: assigned link, approved offer, confirmed sales, attendance-based eligibility, pending commission and verified payout receipt.
- [ ] Buyer checkout: activity/provider/date, final COP price, referral attribution, cancellation terms, payment recipient, supported payment method, gas/fees and booking hold countdown.
- [ ] P0 must honestly display that payment is in wCOP on Celo. Do not imply that PSE, Nequi or card payment already exists.
- [ ] Document and test how the actual pilot buyer acquires wCOP and gas. Select a supported wallet/onboarding flow based on the pilot, without storing private keys in the web app or using public demo identities.
- [ ] Confirm the pass only after verified payment. Use an opaque signed QR token with no personal data in the QR, a booking status endpoint and authorized single-use check-in.
- [ ] Provide a narrow HashPass adapter for pass issuance/check-in if its existing API supports the flow. A standalone pass/check-in view in this application is an acceptable P0 fallback; do not claim an integration that is not implemented.
- [ ] Display pending payments, cancellation/refund status and payouts in plain language with retry/support actions.
- [ ] Keep sensitive attendee information off-chain and out of public evidence exports.
- [ ] Report gross sales, refunds, completed sales, merchant economic proceeds, accrued/paid promoter commission and recognized HashPass fees separately.

**Exit evidence:** operator, promoter and buyer can complete their tasks without reading a blockchain runbook; onboarding friction is observed and reported.

## Step 6 — Verify security, recovery and Celo readiness

Run the existing relevant checks and add meaningful commerce cases. Update script/CI test discovery: the current `pnpm test` enumerates specific files, so new test files will not automatically run.

- [ ] Unit/property tests: atomic-unit rounding, fee/proceeds conservation, policy versions, capacity/reservation transitions and allowed agent decisions.
- [ ] Contract tests: unauthorized quote/check-in/payout, expired or replayed signatures, wrong chain/token/recipients, insufficient prefunding, withdrawal of allocated funds, double payment/settlement, refund accounting and malicious/unsupported token behavior.
- [ ] Integration tests: concurrent last-seat purchases, duplicate event consumption, submission timeout, crash before/after broadcast, partial settlement handling, restart, nonce replacement, reorg and refund pending until confirmed.
- [ ] Browser tests: successful reservation/payment/pass/check-in/payout, insufficient funds, expired reservation, unavailable capacity, cancellation and operator pause.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:contracts`, `pnpm test:integration` and `pnpm test:e2e` with the new paths included.
- [ ] Run an actual Celo Sepolia flow with explicitly labeled test assets before using real funds. Emulator evidence must remain labeled as emulator evidence.
- [ ] Verify the official wCOP contract/source, chain code and proxy implementation if applicable, symbol/decimals, transfer behavior, acquisition route and actual funded balances. Use primary sponsor/token sources; never substitute SIMCOP/TESTCOP on mainnet.
- [ ] Provision protected operator/deployer/executor roles, HTTPS, persistent disks, scoped credentials, backups, restore procedure and monitoring for low funds, stuck payments, budget mismatch and worker failures.
- [ ] Complete the concrete contract/exposure review and approved deployment plan required by the adapted project readiness gates.
- [ ] Keep mainnet writes disabled until the plan has the actual chain/token/contracts, bounded policy, gas cap, wallet/identity bindings and operator authorization.
- [ ] Update `docs/mainnet-readiness.md`, `docs/security.md` and `docs/runbook.md` for the direct-wCOP route and its specific custody/trust boundaries.

## Step 7 — Preserve hackathon attribution and identity

These are project requirements, not permission to broadcast funds as part of writing this issue.

- [ ] Celo mainnet chain ID: **42220**.
- [ ] Issued tag: **`celo_41fbb6a88a82`**. Apply official ERC-8021 encoding before signing every application-originated external transaction: approvals, deployments/configuration, budget funding, buyer payment, refunds, withdrawals, settlement, replacements and identity registration.
- [ ] Keep the same permanent agent wallet: **`0x114d72D97Aa9C413A1ba3f0Cd37F439D668EA1aD`**. Merchant/buyer wallets have their own roles and do not replace the event agent wallet.
- [ ] Verify actual mainnet calldata contains attribution. Untagged transactions cannot be backfilled. Retried/replacement transactions must retain the suffix.
- [ ] Confirm authenticated event enrollment, repository association and wallet entry.
- [ ] Register ERC-8004 from the permanent wallet against the canonical registry; record and verify the real agent ID, metadata and receipt.
- [ ] If a team is joined, obtain the issued team tag before further transactions and keep a truthful attribution history.
- [ ] Record user provenance honestly. Team-created/initially team-funded wallets are not independent users under the stated scoring rule. Newly onboarded real users must be reported in the appropriate category.
- [ ] Do not pay ourselves through fabricated bookings or buy unrelated cheap API calls to inflate activity.
- [ ] Distinguish the pre-existing HashPass base from the code developed during this hackathon. Check current submission eligibility and disclose reuse.
- [ ] Target **Stable Agents: LATAM** first. x402/FX tracks are optional future scope, not prerequisites for this MVP.

## Step 8 — Run the paid pilot and prove the business result

Target: October 27–29, with onboarding and manual validation started earlier.

- [ ] Execute actual bookings for the selected activity, with the operator's inventory and genuine customer intent.
- [ ] Target at least three real completed bookings, one genuine promoter payout and a nonzero operator-agreed HashPass success fee. These are internal pilot targets, not an official scoring minimum or statistical validation.
- [ ] Demonstrate the full mainnet lifecycle with receipts: operator commission funding, booking payment, attendance evidence and agent-originated commission/fee settlement.
- [ ] Record acquired buyer count, checkout completion/abandonment, capacity sold, attributable sales, cancellations/refunds, time spent onboarding/supporting and any offer change.
- [ ] Calculate merchant proceeds and acquisition cost from actual records. Calculate HashPass recognized revenue and contribution margin after gas, ramp/payment expenses, support and refunds; do not report GMV as revenue.
- [ ] Obtain operator feedback on whether the sales justified the fee and whether they would use/pay for the next activity.
- [ ] Record what remains unproven, especially incrementality, repeat usage and non-crypto onboarding.
- [ ] Export scrubbed evidence with transaction hashes and publicly shareable activity facts; retain private consent/customer evidence outside GitHub.
- [ ] Do not declare product-market fit from a three-booking pilot. The next commercial milestone is a second paid activity with the same operator or a second independent operator.

## Step 9 — Package, freeze and submit

- [ ] Rewrite the README around the merchant problem and final behavior; retain truthful local/testnet/mainnet status labels.
- [ ] Add `docs/commerce/` architecture, policy/economics, validation, pilot results, operator setup and cancellation/refund guides.
- [ ] Update `docs/demo-script.md`, `docs/novelty.md` and `docs/submission.md`. Explain why this agent's decisions were useful and what real parties purchased.
- [ ] Record a short demo showing an operator policy, an observation-driven offer decision, buyer payment/pass, check-in, automatic payout and the merchant/revenue report.
- [ ] Include code/contract version, deployed addresses, verified token provenance, canonical ERC-8004 identity, attributed transaction hashes, policy limits and current limitations.
- [ ] **October 30:** functional MVP, completed pilot and delivery package ready.
- [ ] **October 31:** correction buffer.
- [ ] **From November 1:** submission and minor fixes only, around the founder's Bogotá trip.
- [ ] **November 7:** internal submission target.
- [ ] **November 9, 2026, 09:00 UTC / 04:00 America/Bogota:** official deadline. Verify the live event page before final submission.

## Suggested pull-request sequence and dependencies

| PR  | Deliverable                                                      | Dependency / completion evidence                             |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Pilot decision, scope, economics and commerce architecture       | Step 0 commercial agreement; explicit custody/policy choices |
| 2   | Direct-wCOP intent/contract/signer path and fund-flow tests      | PR 1; no fake LUKAS conversion; reviewed accounting          |
| 3   | Activity/promoter/reservation/payment persistence and API        | PRs 1–2; concurrency/idempotency/reconciliation cases        |
| 4   | Decision engine, observation log and worker adapter              | PRs 2–3; bounded offer decision and eligible settlement      |
| 5   | Operator/promoter/buyer views, pass and check-in adapter         | PRs 2–4; usable browser flow                                 |
| 6   | Readiness/deployment, paid pilot evidence and submission package | All above; actual network evidence and commercial results    |

Do not let this epic become a reason to build every future marketplace feature. Each PR should state the concrete behavior changed, the meaningful checks run, and the remaining limitation.

## Definition of done

- [ ] A real independent operator supplied actual paid inventory and agreed to pay for completed attributed sales.
- [ ] The buyer can reserve, pay wCOP, receive a valid pass and attend the selected activity.
- [ ] The agent makes at least one bounded observation-driven offer decision and settles earned commissions without per-action manual intervention.
- [ ] Payment, inventory, allocation, refund and retry accounting satisfy the stated invariants.
- [ ] Operator proceeds, promoter payout and HashPass revenue can be reconciled to actual chain evidence without double-counting.
- [ ] New commerce tests run in CI; existing relevant safeguards remain effective.
- [ ] The real mainnet flow uses verified official wCOP, the permanent wallet, the issued attribution tag and a verified ERC-8004 identity.
- [ ] Custody, attendance trust, refunds, onboarding friction and independent-user provenance are described honestly.
- [ ] The frozen product and evidence package are ready by October 30.

## References

- [Current architecture](https://github.com/hashpass-tech/lukas-treasury-agent/blob/main/docs/architecture.md)
- [Mainnet readiness](https://github.com/hashpass-tech/lukas-treasury-agent/blob/main/docs/mainnet-readiness.md)
- [Recorded registration requirements and deadlines](https://github.com/hashpass-tech/lukas-treasury-agent/blob/main/docs/hackathons/agents-on-open-rails.md)
- [Agents on Open Rails official event](https://www.loops.house/agents-on-open-rails)
- [Official attribution integration](https://github.com/celo-org/attribution-tags/blob/main/BUILDERS.md)
- [Celo ERC-8004 registration](https://docs.celo.org/build-on-celo/build-with-ai/8004)
- [Ripio: wFIAT on Celo and published token addresses](https://action.ripio.com/es/blog/las-stablecoins-wfiat-ya-estan-disponibles-en-celo)
- [Ticket Fairy referral marketing](https://www.ticketfairy.com/features/referral-marketing)
- [Mercado Pago split-payment overview](https://www.mercadopago.com.co/developers/es/docs/split-payments/split-1-1/overview)
- [Viator affiliate commission model](https://partnerresources.viator.com/)

The competitor references establish that referral rewards and payment splits already exist. They do not validate demand for this particular product; the paid pilot must establish whether our sales result is worth buying.

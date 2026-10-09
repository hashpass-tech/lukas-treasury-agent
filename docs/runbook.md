# Treasury runbook

## Local operation

Start in the repository root: `pnpm dev:local`, then `pnpm demo:run`. Stop cleanly with SIGINT. Restart with the same persistent `.local/chain`, SQLite database and journals. A fresh checkout is reproducible without external credentials. Source changes do not upgrade an existing deployed vault; use a separate fresh simulation directory to validate a new contract version without destroying old state.

The dashboard supports owner authentication, exact obligation review/signing and actual receipts. Owner controls prepare funding, pause/resume, withdrawal, cancellation, token caps, recipient changes, source-age policy and executor rotation; the wallet sends exact tagged transactions and the API verifies them. If an owner transaction is submitted but verification times out, resume its recorded hash. Never blindly repeat a withdrawal/funding action after an uncertain outcome.

Expired fixture: obligations block unpaid with PRICE_STALE. `pnpm demo:seed` refreshes synthetic prices and retries within the original authority/time window. Low signed cap or changed policy epoch: cancel the original onchain, then create a new obligation ID with reviewed terms/signature. No parser changes an already signed obligation.

## Remote processes

Follow [signer](signer.md) and [Sepolia](sepolia.md) first. Export safe public configuration and inject role credentials securely. Use separate network/database/manifest directories. Provision the chain deployments via the appropriate command, then run `pnpm dev:api` and `pnpm dev:worker` as separately supervised processes with persistent disks. Run the Next dashboard behind an HTTPS proxy; `PUBLIC_ORIGIN` must match the visible origin and mutation requests. The continuous worker gets only executor credentials. Keep operator owner/deployer/publisher credentials in separate processes.

Schedule the accepted publisher's source refresh before expiry: `pnpm oracle:sync` validates/publishes native or approved mirrored evidence and writes the current snapshot. Signed mirrors need a prevalidated source attestation; neither publication time nor a snapshot file can manufacture freshness. Pause rather than substitute a fixture if real data is unavailable.

`GET /health` reports process liveness. `/ready` checks chain/vault availability. Authenticated `/metrics` reports task counts, worker heartbeat age, pending attempts and oldest pending time. Alert on stale source, low token/gas balances, missed deadlines, growing retries, heartbeat loss and prolonged pending/uncertain transactions. Readiness is not a security audit or proof of economic backing.

## Failure response

RPC/signer outage: retain exact prepared requests, signed bytes, IDs and nonce state. Restore the endpoint and let reconciliation run first. Known pending transactions wait; bounded replacements preserve business terms and nonce. Unknown hashes with used nonces/paid markers require chain investigation. Never delete an uncertain attempt or issue a fresh payment ID merely to unblock the queue.

Mined revert: the worker records FAILED; inspect canonical chain evidence and the reason before any replacement authorization. Retryable pre-broadcast failures back off up to the configured maximum; terminal cap/epoch/cancellation/expiry failures require operator/owner action. Reorg: invalidate receipt evidence and converge using the original ID/journal; do not independently duplicate payment. Configured finality is one block locally and at least two remotely (five by default).

Emergency: owner pauses directly onchain, independently of API/agent. Withdraw/rotate through the owner wallet; keep old journals and reconcile pending transactions before unpausing. `MAINNET_WRITES=false` or expired authorization stops agent broadcasts/replacements/signing while receipt reads/reconciliation continue. An already broadcast payment cannot be undone by API cancellation.

## Backups and evidence

Stop services and back up the private SQLite database/WAL, deployment/snapshot configuration, signer nonce journal and protected recovery keys through secure storage with restrictive permissions. Local chain data must stay coherent with its database. SQLite online backup requires separately coordinated chain/signing state. Restore to the same chain/vault, validate bindings and RPC chain, then reconcile before enabling writes. Losing a journal key makes encrypted recovery impossible. A real-host restore drill remains an operator requirement.

`pnpm evidence:export` writes scrubbed receipts and audit checkpoints to ignored `.local/`. Store checkpoints separately to detect tampering; hash-linked SQLite alone is not immutable. Verify transaction suffixes with `pnpm attribution:verify <hash>`. Local/emulator evidence does not count for the event. Do not export supplier descriptions, merchant signatures, raw signed bytes, keys or credentials.

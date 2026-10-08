# Local runbook

Start in repository root: `pnpm dev:local`, then `pnpm demo:run`. Stop with SIGINT. Restart with the same commands; `.local/chain` and `.local/treasury.sqlite` must remain together. Worker reconciles journaled attempts before dispatch. An unknown submission is not a new obligation.

Oracle expired: obligations remain unpaid with PRICE_STALE. `pnpm demo:seed` refreshes fixture prices; the worker reevaluates. Cap too low: original signed obligation remains blocked; replacement terms require a fresh ID and signature, and the original should be canceled onchain by owner first.

Owner controls: invoke vault `pause`, `cancelIntent(id)`, `setExecutor`, `withdraw` from owner wallet, not API. Policy changes increment epoch and invalidate old signatures. Cancellation after submission cannot undo an already settled payment.

Backup: stop this stack cleanly, copy the entire private `.local` directory with mode 0700 to secure storage. Restore chain/database/journal as one coherent checkpoint; run stack and reconcile. Do not publish backups. SQLite `.backup` can capture a live database, but chain state must be coordinated too. Remote restore procedures are not validated.

RPC outage: retain attempts and retry identical signed bytes after restoration; never clear an uncertain attempt or issue a fresh payment ID. Lost executor: owner pauses and rotates; preserve journals and reconcile old transactions before reopening. Do not treat a receipt export as immutable audit storage or official independent-user evidence.

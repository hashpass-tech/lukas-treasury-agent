# Architecture

Next.js wallet UI → Hono authenticated local API → SQLite obligation/signature store → independent treasury worker → constrained local EOA signer → TreasuryVault → SIMCOP recipient.

Owner retains vault funding/withdrawal, policy, allowlist, cancellation, executor rotation and pause authority. Worker cannot expand authority. Publisher is separate from owner/executor. Fixture oracle supplies immutable numbered rounds. The contract validates signatures (EOA/ERC-1271 through SignatureChecker), freshness, methodology, epoch, caps and replay before SafeERC20 interaction; a non-exact recipient balance change reverts the payment.

SQLite stores versioned obligations, nonce/signed-byte attempts, sessions/challenges, idempotency keys, leases and hash-linked committed audit events. Single host WAL; exclusive renewable executor lease. Reconcile old attempts before creating new attempts. A crash before journaling is recoverable; after journaling the same signed bytes/hash are rebroadcast. Contract obligation ID is the final replay boundary. No LLM receives a signer or environment context. Natural-language parsing is deferred.

Local receipts verify canonical block hash, successful receipt, vault event, intent hash and settlement arithmetic. A local reorg invalidates the stored receipt and retries the same signed bytes; this is single-node local finality only; remote confirmation depths, replacement/drop policy and encrypted signer journal remain required.

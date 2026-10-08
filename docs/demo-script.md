# Reproducible walkthrough

1. Install frozen dependencies; start `pnpm dev:local`.
2. Show Simulation badge, funded onchain treasury and synthetic reference index.
3. Run `pnpm demo:run`: explain a 100 LUKAS bounded signed obligation and a one-atomic-unit over-cap example.
4. Observe settled receipt with actual local transaction hash, block, token, recipient, amount and immutable oracle round. The blocked obligation is visibly unpaid.
5. Stop/restart the stack; rerun demo and show recipient balance is unchanged for the same stable obligation ID.
6. Browser flow: connect local test owner wallet, enter amount/cap, review all signed terms, sign, wait 15 seconds. No new human action is needed at execution time.
7. Explain synthetic prices, local-only identities, missing ERC-8004 registration, untagged local transactions and separate protocol pilot gates.

Automated integration tests restart the signer after journal persistence and reconcile without duplicate transfers. No demo video or external pilot evidence has yet been produced.

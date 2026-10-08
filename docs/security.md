# Security boundaries and outstanding work

Local-only test identities, mock assets and fixture feeds are deliberate simulation inputs. Exported variables configure local runtime; remote modes and hosts fail closed. No unrestricted owner key is held by the worker. Local CLI seeding deliberately signs using the public test owner; browser asks a wallet to sign exact terms.

Vault independently enforces signed recipient/token/amount/ceiling/time/epoch, owner allowlists, per-payment and UTC daily caps, pause/cancel, executor authorization and obligation replay. Exact recipient balance changes reject fee-on-transfer behavior; SafeERC20/reentrancy guards protect interactions. Reference token zero is required in this fixture-only vault.

SQLite signed transactions and authorizations are private local mode-0600 data, not suitable production encrypted signer custody. Audit hash chains need external trustworthy checkpoints to make tampering detectable. Evidence contains no authorizations or signed transactions.

Wallet login challenge binds local origin, chain, wallet, nonce and expiry. Challenge consumption is transactional and one-use; session cookie HttpOnly/SameSite Strict. Mutations require JSON and allowed origin. Reads expose only local simulation data. Public hosting is unsupported until HTTPS/secure cookies, mandatory tenant read authorization, CSRF review, production rate limits and key management are added.

Known unimplemented financial failure boundaries: remote finality/reorg validation, dropped/replacement transactions, reviewed gas budgets, terminal/retry classification, independent signer journal protection, arbitrary ERC-1271 end-to-end testing, malicious/rebasing token fuzzing and all Foundry invariant suites. No security audit is claimed.

# Protected signer setup

The permanent event executor is `0x114d72D97Aa9C413A1ba3f0Cd37F439D668EA1aD`. The operator has no signing service yet and requested preparation. **No private signing key has been generated, imported, displayed or committed.** `pnpm signer:setup` creates private authentication/recovery files in ignored `.local/signer-setup`, with mode 0600, and a public setup record. Provision the matching executor key on a persistent isolated signing host using your secret manager. Do not enter it in chat, browser bundles, a committed env file or a general AI context.

`pnpm signer:start` runs the supplied HTTPS signer on loopback port 3443. Put it behind a trusted HTTPS reverse proxy or private service endpoint. It reads:

- `SIGNER_ROLE`: executor by default; run separate service instances for owner/deployer/publisher if needed.
- `SIGNER_PRIVATE_KEY_FILE`: mode-0600 file containing the matching key, on the signing host only.
- `SIGNER_AUTH_TOKEN_FILE`: mode-0600 Bearer credential; never display its contents.
- `SIGNER_TLS_CERT_FILE` and `SIGNER_TLS_KEY_FILE`: trusted certificate and restrictive key file.
- `SIGNER_DATABASE_PATH`: persistent private SQLite journal, separate from app DB.
- `JOURNAL_KEY_FILE`: persistent mode-0600 file with a 32-byte hex AES key; keep protected backups.
- `MODE`, `RPC_URL`, `DEPLOYMENT_MANIFEST`, `ORACLE_MODE`, `MAXIMUM_GAS_COST_NATIVE_ATOMIC`: matching reviewed public configuration and a positive operator-approved gas cap.

The service authenticates requests, binds the requested role/address to its one key, verifies chain ID, requires attribution, simulates exact bytes, and signs without broadcasting. Executor signing permits only zero-value `executePayment` calls to the configured vault. Its private journal prevents different business calls from sharing a nonce; fee replacement preserves destination/data/value. Journaled raw bytes are encrypted and authenticated against their hash. Returned signer bytes are separately checked by the client for signer, chain, nonce, destination, value, calldata, gas and fees.

Owner/deployer instances require `SIGNER_TRANSACTION_APPROVAL_FILE` with `approved: true`, a valid `expiresAt`, and exact entries `{chainId,to,dataHash,value}`. An owner instance can sign EIP-712 intents only with `OWNER_INTENT_APPROVAL_FILE` containing `approved: true`, an unexpired `expiresAt`, and exact `intentHashes`. It has no generic message signing endpoint. Merchant browser wallets remain the normal owner authorization path. The oracle publisher can publish only to its configured oracle; signed mirrors require separately validated source attestations.

The application uses `SIGNER_URL` for the executor endpoint and `SIGNER_AUTH_TOKEN` for its network credential. Configure separate `OWNER_SIGNER_URL`, `DEPLOYER_SIGNER_URL`, `PUBLISHER_SIGNER_URL` and corresponding role-prefixed `*_SIGNER_AUTH_TOKEN` credentials for operator-run deployment/demo tools. Restrict credentials per process: the continuous worker should receive only the executor credential. A secret manager or cloud proxy can provide the network credential to the exact signer host. No destination hostname has been invented in cloud secret settings.

Keep one active worker per executor, SQLite and the protected journal on persistent local disks, HTTPS authentication and backups. Never place SQLite across hosts. Losing the journal key makes recovery impossible; losing uncertain attempts is not permission to pay again. Validate restart recovery before funding an actual pilot. This is an MVP service for operator review, not an HSM or an independent security audit.

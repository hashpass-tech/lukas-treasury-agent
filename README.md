# LUKAS Treasury

Schedule LUKAS-denominated supplier obligations and settle inside owner-signed limits. This first implementation is a **local Simulation vertical slice**, with a JACK-inspired independently implemented runtime. It is not the complete blueprint release or an authorized mainnet pilot.

## Quickstart

Node >=22.13 (Node 24 tested), pnpm 9.15.9. No production keys, RPC services, Docker or paid accounts are needed.

```sh
pnpm install --frozen-lockfile
pnpm dev:local
# In another terminal, in the repository root:
pnpm demo:run
```

The native stack starts a persistent Ganache EVM (31337, localhost port 8545), Next.js dashboard (port 3000), Hono API (port 3001), and worker. Only loopback interfaces are used. Open port 3000 in your own local browser. The seed deposits an actual mock ERC-20 balance into a deployed vault, signs a bounded 100 LUKAS obligation and schedules a second deliberately over-cap obligation. The worker independently executes the first; the second remains blocked. Repeated demo calls reuse the same obligation IDs and do not pay twice.

The fixture values produce 38,075 SIMCOP for 100 LUKAS. This is synthetic arithmetic and a real local EVM transfer, not Ripio funding or mainnet evidence. Prices expire after five minutes; `pnpm demo:seed` republishes the fixture. Restarting the stack preserves the chain and SQLite database. Never delete only one of them.

For the browser signing flow, configure an EVM wallet with chain 31337 and local RPC port 8545, and import the **public, local-only** test mnemonic `test test test test test test test test test test test junk`. Account 0 owns the treasury. Never fund these public identities on any remote network. The interface authenticates wallet ownership, shows exact terms, requests EIP-712 authorization, and schedules execution 15 seconds later. CLI signing works without a browser wallet. Local identity generation rejects remote modes and RPC hosts.

## Commands and actual behavior

| Command                                         | Behavior                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm demo:seed`                                | Idempotently seeds two owner-signed local obligations and refreshes synthetic prices                                     |
| `pnpm demo:run`                                 | Seeds, ticks worker, requires a reconciled local payment and prints scrubbed receipts                                    |
| `pnpm build`                                    | Solidity compilation and Next production build                                                                           |
| `pnpm typecheck`                                | Strict TypeScript checking                                                                                               |
| `pnpm lint`                                     | Prettier formatting and strict TypeScript check                                                                          |
| `pnpm test`                                     | Integer/property, snapshot and storage tests                                                                             |
| `pnpm test:contracts` / `pnpm test:integration` | Isolated real-EVM contract/API/recovery suite (same suite)                                                               |
| `pnpm test:e2e`                                 | Browser signing happy path and blocked payment; uses `CHROMIUM_PATH`, system Chromium, or a Playwright-installed browser |
| `pnpm config:validate`                          | Validates local-only runtime configuration                                                                               |
| `pnpm deploy:sepolia` / `pnpm deploy:mainnet`   | Writes review plans only, exits 1 to signal deployment not implemented; never sends remote transactions                  |
| `pnpm identity:prepare`                         | Inactive metadata draft; does not register an identity                                                                   |
| `pnpm attribution:verify <hash>`                | Decodes local transaction with official SDK; requires configured code                                                    |
| `pnpm pilot:check`                              | Reports concrete unresolved gates; exits 1                                                                               |
| `pnpm evidence:export`                          | Scrubbed local receipts and audit checkpoints under ignored `.local/`                                                    |

Copying `.env.example` is optional. Native scripts use exported variables; they do not load `.env` automatically. SQLite uses WAL, busy timeout, transactional migrations and mode 0600. The signed-byte journal is private local storage; encrypted/remote signer recovery is required before remote use.

## Modes and acceptance

LOCAL is implemented and visibly labeled Simulation. CELO_SEPOLIA (11142220) and CELO_MAINNET_PILOT (42220) have preparation artifacts and explicit blockers only. The runtime cannot execute either remote mode. The issued event attribution code `celo_41fbb6a88a82` is configured on every application signing path. No official wFIAT addresses, canonical identity, token pilot or mainnet transactions are claimed. See [hackathon setup](docs/hackathon.md) for wallet, identity and Builder Pack requirements.

See [acceptance](docs/acceptance.md), [discovery](docs/discovery.md), [security](docs/security.md), [mainnet readiness](docs/mainnet-readiness.md) and [runbook](docs/runbook.md). On Node 24 Ganache may use its JavaScript fallback instead of a native µWS binary; this is a performance warning, and real contract tests still execute.

Optional Linux Docker workflow (not executed in this environment): `docker compose up --build`, then `docker compose exec treasury pnpm demo:run`. Host networking preserves localhost bindings; the named volume preserves simulation chain/database together. Native startup is the verified workflow.

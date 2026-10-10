# LUKAS Treasury

Schedule LUKAS-denominated supplier obligations and settle them in a configured local-currency token inside owner-signed limits. The MVP includes the wallet dashboard, authenticated API, independently implemented JACK-inspired financial runtime, durable worker, treasury vault, protected signer service, Celo deployment tools, native/signed-mirror oracle adapters, identity tooling, and tests.

**Local baseline verified.** The full Sepolia path is tested through a local HTTPS emulator; actual Sepolia and mainnet acceptance need provisioned signing services, gas and verified network evidence. See [acceptance](docs/acceptance.md). No LKS issuance or redemption promise is made.

## Run locally

Node **22.13+** (24.19.0 tested), pnpm **9.15.9**. No production key, paid account or remote RPC is required.

```sh
pnpm install --frozen-lockfile
pnpm dev:local
# In another terminal, from the repository root:
pnpm demo:run
```

Open http://127.0.0.1:3000. The native stack starts persistent Ganache chain **31337** on port 8545, the dashboard on 3000, API on 3001 and autonomous worker. `demo:run` funds a mock vault, signs a bounded 100-LUKAS obligation and a deliberately over-cap example, and requires the first payment to reconcile. Synthetic prices convert 100 LUKAS to **38,075 SIMCOP**. This is an actual local ERC-20 transfer using synthetic assets and prices. Repeating the demo preserves obligation IDs and cannot pay twice.

For browser signing, add the local network to an EVM wallet and import the public **local-only** mnemonic `test test test test test test test test test test test junk`; account 0 owns the treasury. Never use or fund these identities remotely. The UI authenticates ownership, reviews exact terms, requests EIP-712 authorization, and schedules payment 15 seconds later. It also prepares owner-reviewed funding, withdrawal, pause/resume, cancellation, recipient changes, token limits, source-age policy and executor rotation. The agent cannot change those controls.

Prices expire after five minutes; `pnpm demo:seed` refreshes them. Restart preserves chain and SQLite together. Do not delete only one. Existing deployments are not automatically upgraded when contract source changes; use a separate fresh simulation directory to deploy a new version while preserving old journals.

## Commands

| Command                                                            | Result                                                                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm demo:seed` / `pnpm demo:run`                                 | Idempotent local obligations; verified local settlement                                                                                  |
| `pnpm build` / `pnpm typecheck` / `pnpm lint`                      | Solidity + production web build; strict types; formatting                                                                                |
| `pnpm test`                                                        | Arithmetic, snapshot, policy, storage, attribution, signer, parser, configuration and identity tests                                     |
| `pnpm test:contracts`                                              | Native Foundry contract tests, including fuzz, malicious tokens and ERC-1271                                                             |
| `pnpm test:integration`                                            | Actual isolated EVM/API/recovery/reorg/replacement tests                                                                                 |
| `pnpm test:e2e`                                                    | Browser signing, blocked payment and owner controls                                                                                      |
| `pnpm test:sepolia-path`                                           | Full remote deployment/funding/payment/restart path on a labeled local HTTPS emulator                                                    |
| `pnpm signer:setup` / `pnpm signer:start`                          | Private auth/recovery setup without a signing key; isolated HTTPS signer                                                                 |
| `pnpm deploy:sepolia`                                              | Prepare testnet plan; `--broadcast` executes with provisioned operator signers                                                           |
| `pnpm demo:sepolia`                                                | Prepare exact intent; `--broadcast` authorizes and executes the approved testnet demo                                                    |
| `pnpm deploy:mainnet`                                              | Verify supplied token/source/identity evidence and prepare a hashed plan; guarded `--broadcast` requires explicit reviewed authorization |
| `pnpm identity:prepare` / `pnpm identity:verify <hash>`            | Prepare tagged canonical registration for wallet review; verify actual identity transaction and bindings                                 |
| `pnpm snapshot:sync` / `pnpm oracle:sync`                          | Validate native source data; publish accepted native/mirror rounds while preserving original timestamps                                  |
| `pnpm dev:api` / `pnpm dev:worker`                                 | Separate persistent processes for a configured deployment                                                                                |
| `pnpm config:validate` / `pnpm pilot:check`                        | Validate mode configuration; report required readiness evidence                                                                          |
| `pnpm attribution:verify <hash>`                                   | Decode actual transaction attribution through the official SDK                                                                           |
| `pnpm evidence:export` / `pnpm demo:capture`                       | Scrubbed private receipts/checkpoints; labeled local video/screenshots                                                                   |
| `pnpm release:patch` / `pnpm release:minor` / `pnpm release:major` | Guarded version bump, changelog/README sync, validation, commit, tag and push to `main`                                                  |

Native scripts use exported variables and **do not automatically load `.env`**. `.env.example` contains safe public defaults/placeholders. Replace or unset `RPC_URL` when changing modes. Keep separate chain/database/manifest paths per network. SQLite is single-host WAL with transactional migrations, nonce uniqueness, renewable leases and private mode-0600 files. Remote recovery requires an authenticated encrypted journal and HTTPS signer/RPC.

## Celo and the hackathon

Modes: LOCAL **31337**, CELO_SEPOLIA **11142220**, CELO_MAINNET_PILOT **42220**. Only mainnet activity counts for Agents on Open Rails / Stable Agents: LatAm | Ripio x Celo. All application transaction paths require official ERC-8021 encoding with **`celo_41fbb6a88a82`** before signing. The permanent event wallet is **`0x114d72D97Aa9C413A1ba3f0Cd37F439D668EA1aD`**. No private key was generated for that wallet.

Follow [signer setup](docs/signer.md), [Sepolia](docs/sepolia.md), [mainnet readiness](docs/mainnet-readiness.md), and [hackathon onboarding](docs/hackathon.md). Mainnet writes default off; actual official wFIAT, current accepted prices, canonical ERC-8004 identity, contract/cap review and bounded operator authorization are required. Registration tooling is verified against a clearly labeled test registry, not an existing canonical agent ID.

[Architecture](docs/architecture.md), [API](docs/api.md), [security](docs/security.md), [runbook](docs/runbook.md), [source discovery](docs/discovery.md), [submission draft](docs/submission.md) and [demo](docs/demo-script.md) explain operation and evidence. Ganache uses a JavaScript fallback on Node 24; tests still execute actual EVM contracts. Native setup is verified. Optional Linux `docker compose up --build` and the GitHub Actions workflow are provided; neither Docker nor remote CI was executed in this environment.

## Planned commerce pivot

Issue #1 is tracked in the [.specs execution plan](.specs/PLAN.md), with an internal simulation MVP first and stable adapter ports for future HashPass/allied integrations. The verified versioning task workflow is documented in [.specs/README.md](.specs/README.md). The commerce simulation is now delivered locally; external operator validation, remote deployment and real-money work remain later evidence gates, while the original treasury simulation remains separate.

## Static GitHub Pages demo

The main web interface is published as a read-only static demo at [hashpass-tech.github.io/lukas-treasury-agent](https://hashpass-tech.github.io/lukas-treasury-agent/). The Pages workflow builds the same Next.js app with deterministic local-demo data, so no API, wallet, private key or remote chain is used. Local development keeps the API-backed dashboard and wallet controls.

## 📋 Latest Changes (v0.1.4)

### Changed

- ✨ feat: show package version in web footer

For full version history, see [CHANGELOG.md](./CHANGELOG.md) and [GitHub releases](https://github.com/hashpass-tech/lukas-treasury-agent/releases)

---

<p align="center"><sub>Release <strong>v0.1.4</strong> · <a href="CHANGELOG.md">Changelog</a> · Updated 2026-10-10</sub></p>

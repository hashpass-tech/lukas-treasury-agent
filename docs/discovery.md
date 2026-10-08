# Discovery — 2026-10-08

The supplied application checkout had no files, commits or AGENTS.md. No user changes were overwritten. Existing checkout used; no worktree created.

Read-only Git queries and shallow source inspection confirmed:

| Source                       | Inspected HEAD                           | Findings                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| hashpass-tech/lukas-protocol | c5d944c9710aa461f477e77e8c258ffe9e4eef9a | SDK package 0.2.22; index raw-unit basket BRL4000/MXN3000/COP1500/CLP1000/ARS500 bps; getIndexUSD returns value and oldest timestamp; scale 1e8, WAD normalization x1e10 |
| jack-kernel/jack-k           | d140f44519a1c26b2667e43a69de1635759ea0fa | Root version 0.1.2, Node >=22, pnpm 9.15.9; ExecutorContext requires worktree/repo and Ticket has repository states; no license file located                             |

No drift from the uploaded document's commits. No JACK or protocol implementation source was copied. Financial runtime is independently written and JACK-inspired, pending upstream license permission and actual integration. OpenZeppelin 5.2.0 MIT primitives are imported as dependencies, compatible with local Shanghai EVM. Solidity 0.8.30 is pinned. Node's SQLite replaces a native better-sqlite3 dependency for this baseline (requires Node >=22.13).

Installed official @celo/attribution-tags 0.5.0 with viem 2.38.5: `withAttribution(code)`, `toDataSuffix`, `fromDataSuffix`, `verifyTx` exist. Ordinary local wallet calls optionally use the extension. Worker raw signed transaction calldata uses a separate single-suffix preparation boundary. Local untagged deployment paths are explicitly outside eligible attribution claims.

Not yet verified: current hackathon enrollment rules, official wFIAT addresses/code/decimals/acquisition, live canonical ERC-8004 registry/ABI, Celo protocol index deployments, current published SDK compatibility, organizer eligibility interpretation. These are unresolved gates, not presumed capabilities. No paid or sponsor service is necessary for LOCAL.

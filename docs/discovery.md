# Discovery — 2026-10-08

The supplied application checkout had no files, commits or AGENTS.md. No user changes were overwritten. Existing checkout used; no worktree created.

Read-only Git queries and shallow source inspection confirmed:

| Source                       | Inspected HEAD                           | Findings                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| hashpass-tech/lukas-protocol | c5d944c9710aa461f477e77e8c258ffe9e4eef9a | SDK package 0.2.22; index raw-unit basket BRL4000/MXN3000/COP1500/CLP1000/ARS500 bps; getIndexUSD returns value and oldest timestamp; scale 1e8, WAD normalization x1e10 |
| jack-kernel/jack-k           | d140f44519a1c26b2667e43a69de1635759ea0fa | Root version 0.1.2, Node >=22, pnpm 9.15.9; ExecutorContext requires worktree/repo and Ticket has repository states; no license file located                             |

No drift from the uploaded document's commits. No JACK or protocol implementation source was copied. Financial runtime is independently written and JACK-inspired, pending upstream license permission and actual integration. OpenZeppelin 5.2.0 MIT primitives are imported as dependencies, compatible with local Shanghai EVM. Solidity 0.8.30 is pinned. Node's SQLite replaces a native better-sqlite3 dependency for this baseline (requires Node >=22.13).

Installed official @celo/attribution-tags 0.5.0 with viem 2.38.5: `withAttribution(code)`, `toDataSuffix`, `fromDataSuffix`, `verifyTx`. All exposed application signing paths guard attribution. Ordinary writes/deployments use the official extension; durable raw signing uses a single-suffix preparation boundary, and replacements/recovery preserve exact attributed bytes. No untagged historical transaction is rewritten or credited retroactively.

The canonical ERC-8004 IdentityRegistry ABI was copied with provenance from erc-8004/erc-8004-contracts at b9e466c250744a7e06b13dff9d3c2844ed64f825; see config/erc8004/PROVENANCE.md. Upstream lists Celo mainnet 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 and testnet 0x8004A818BFB912233c491871b3d84c89A494BD9e. Actual chain code, proxy implementation and wallet registration require RPC verification; documentation provenance is not live deployment evidence. A clearly labeled local ERC-1967 test registry validates tooling against the pinned ABI.

Not yet verified: authenticated hackathon enrollment/latest sponsors/deadlines, official wFIAT code/decimals/acquisition, live canonical identity, live protocol index/feed deployments, current published SDK compatibility, organizer eligibility interpretation. No paid or sponsor service is needed for LOCAL. Loops skill fetch failed under current network rules; cloud-domain changes were saved as a draft requiring publication.

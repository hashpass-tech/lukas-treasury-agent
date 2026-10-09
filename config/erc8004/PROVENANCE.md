# Canonical ERC-8004 identity ABI

`IdentityRegistry.json` is copied verbatim from [erc-8004/erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts), commit `b9e466c250744a7e06b13dff9d3c2844ed64f825`, `abis/IdentityRegistry.json`, inspected 2026-10-08. The originating contract carries SPDX MIT; package.json declares ISC. No implementation source is incorporated.

The same commit's README lists Celo mainnet identity registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` and Celo Sepolia identity registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`. These are source-verified address references, **not evidence that deployed code was checked in this environment**. Tools require actual RPC code, an operator-reviewed proxy bytecode hash and implementation bytecode hash before preparing registration. The registration overload is `register(string agentURI)`. Registered agents initialize `agentWallet` to `msg.sender`; ownership transfers clear the binding.

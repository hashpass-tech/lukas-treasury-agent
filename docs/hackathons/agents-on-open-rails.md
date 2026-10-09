# Agents on Open Rails — registration and transaction requirements

Recorded: 2026-10-08, America/Bogota.
Source: registration screen supplied by Edward, “Step 2 of 2 · Before you start”.
Project repository: hashpass-tech/lukas-treasury-agent.

## Issued attribution tag

`celo_41fbb6a88a82`

This is the issued event tag supplied by the founder. Use this exact tag in every transaction before broadcast. Untagged transactions are never credited and cannot be backfilled.

Apply ERC-8021 attribution where the wallet client is constructed and verify every write path. A raw-signing path must include the suffix before signing and retain it on retries. An issued event tag is authoritative; do not replace it with a locally generated code or require it to equal a repository-derived code unless Loops explicitly documents that mapping for this entry.

## Celo mainnet

- Network: Celo mainnet.
- Chain ID: `42220`.
- Testnet activity does not count toward the event score.
- Gas requires CELO or a supported stablecoin fee path.
- Bridge guide: https://docs.celo.org/tooling/bridges/bridges

## Single agent wallet

- Agent wallet address: `0x114d72D97Aa9C413A1ba3f0Cd37F439D668EA1aD` (operator supplied).
- Use one transaction wallet and keep the same address for the entire event; the score is tied to it.
- Enter the address at submission or via the Celo button in the playground.
- Frontend merchant wallets are distinct from the event's agent execution wallet.
- Prepare executor-wallet configuration without inventing or generating an event wallet as part of this documentation task.

## ERC-8004

- Register the agent's ERC-8004 identity from that same agent wallet before the deadline.
- Identity registry, agent ID, and registration transaction: **pending**.
- Registration guide: https://docs.celo.org/build-on-celo/build-with-ai/8004

## Joining a team

If the participant joins a team, the attribution tag changes. Obtain the team's assigned tag and switch every transaction path before sending further transactions. Transactions sent with the previous personal tag are not credited to the team and cannot be retagged retrospectively.

Keep an attribution history with the effective time, wallet, old tag, new tag, and whether transactions belong to the individual or team entry.

## Recovering the tag

The tag remains on the event page, under the Celo button in the playground, and in `loops project get`.

## Public configuration for the implementation

```dotenv
CELO_CHAIN_ID=42220
CELO_ATTRIBUTION_CODE=celo_41fbb6a88a82
# AGENT_WALLET_ADDRESS: set to the chosen permanent event wallet before enabling writes.
```

These variable names are the project's proposed configuration schema, not a claim that implementation already exists. The tag and wallet address are public identifiers; do not commit wallet private keys.

## Before the first scored transaction

- [x] Issued event tag recorded from the registration screen.
- [ ] Confirm the final entry/repository association and whether the entry is individual or a team.
- [x] Record the permanent agent wallet address.
- [x] Configure the assigned tag on all sending/signing paths; verified locally.
- [ ] Verify mainnet chain ID and funding/gas configuration.
- [ ] Verify attribution in the actual transaction input before relying on activity scores.
- [ ] Register ERC-8004 from the same wallet and save the resulting identity evidence before the deadline.

Reference for implementation: https://github.com/celo-org/attribution-tags/blob/main/BUILDERS.md
Event: https://www.loops.house/agents-on-open-rails

Project targets remain: MVP and delivery package ready October 30; October 31 correction buffer; from November 1 only submission and minor fixes; internal submission November 7; official close November 9, 2026 at 04:00 America/Bogota (09:00 UTC).

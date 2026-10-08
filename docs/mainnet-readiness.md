# Mainnet gates — all remote writes disabled

| Gate                                                            | Status                        | Owner / needed evidence                                              |
| --------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| Public event registration and final repository mapping          | Unverified                    | Operator / organizer registration                                    |
| Issued ERC-8021 code                                            | Configured: celo_41fbb6a88a82 | Operator supplied; mainnet transaction verification pending          |
| Canonical ERC-8004 registration and wallet binding              | Missing                       | Operator; registry ABI/code provenance, metadata resolution, ownerOf |
| Official Ripio wFIAT allowlist and funding path                 | Unverified                    | Sponsor/operator; chain code, decimals, behavior and acquisition     |
| Accepted source-price provenance                                | Fixture only                  | Protocol/operator; native or approved signed mirror adapter          |
| Contract and cap review                                         | Pending                       | Independent reviewer/operator; bounded economic exposure             |
| Protected signer, persistent host, backups, reorg/drop recovery | Pending                       | Implementation/operator                                              |
| Full Sepolia deployment/funding/payment                         | Not implemented               | Implementation; actual testnet receipts                              |
| Meaningful real supplier payment                                | None                          | Operator; explicit bounded pilot authorization                       |
| LKS issuance/reserve/redemption release                         | Separate protocol decision    | Protocol owner                                                       |

Do not reduce these gates to meet a calendar. `pilot:check` exits nonzero. Deployment commands prepare bytecode/ABI review plans and exit nonzero, never broadcast. Fixture oracle is explicitly unsuitable mainnet economics.

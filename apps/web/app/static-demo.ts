export const staticDemoConfig = {
  mode: "STATIC DEMO",
  chainId: 31337,
  mainnetWrites: false,
};

export const staticDemoData = {
  balanceAtomic: "1250000000000000000000",
  recipientBalanceAtomic: "380750000000000000000",
  config: {
    chainId: 31337,
    decimals: 18,
    symbol: "SIMCOP",
    token: "0x0000000000000000000000000000000000000002",
    vault: "0x0000000000000000000000000000000000000003",
    recipient: "0x0000000000000000000000000000000000000001",
    executor: "0x0000000000000000000000000000000000000004",
  },
  snapshot: {
    indexUsdWad: "380750000000000000",
    trustMode: "SYNTHETIC DEMO",
    oldestComponentUpdatedAt: 1791633600,
  },
  policy: {
    paused: false,
    policyEpoch: 7,
    maximumOracleAgeSeconds: 315360000,
    tokenPolicy: [
      "0x0000000000000000000000000000000000000002",
      18,
      "500000000000000000000",
      "5000000000000000000",
    ],
  },
  obligations: [
    {
      id: "static-demo-obligation-001",
      state: "RECONCILED",
      intent: {
        amountLukasWad: "100000000000000000000",
        maxSettlementAtomic: "500000000000000000000",
      },
      receipt: {
        actualSettlementAtomic: "380750000000000000000",
        decimals: 18,
        symbol: "SIMCOP",
        transactionHash:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        blockNumber: "142",
        recipient: "0x0000000000000000000000000000000000000001",
        oracleRound: "static-demo-round-001",
        chainId: 31337,
      },
    },
  ],
  pendingOwnerActions: [],
  agent: {
    attributionCode: "celo_static_demo",
    identity: "demo-only · not registered",
  },
};

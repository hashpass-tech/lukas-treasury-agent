import { it, expect } from "vitest";
import { runtimeConfig } from "../packages/core/config.js";
import { hackathon } from "../packages/core/hackathon.js";
it("mainnet read-only recovery remains available while write authorization fails closed", () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      MODE: "CELO_MAINNET_PILOT",
      CHAIN_ID: "42220",
      RPC_URL: "https://rpc.example.test",
      SIGNER_URL: "https://signer.example.test",
      JOURNAL_KEY_FILE: "/unprovisioned/key",
      AGENT_WALLET_ADDRESS: hackathon.agentWallet,
      ATTRIBUTION_CODE: hackathon.attributionCode,
      MAINNET_WRITES: "true",
    });
    delete process.env.MAINNET_AUTHORIZATION_FILE;
    expect(() => runtimeConfig()).toThrow("MAINNET_WRITES_DISABLED");
    expect(runtimeConfig({ readOnly: true }).chainId).toBe(42220);
    process.env.MAINNET_WRITES = "false";
    expect(runtimeConfig({ readOnly: true }).mode).toBe("CELO_MAINNET_PILOT");
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { env: { MODE: "LOCAL", CHAIN_ID: "31337", MAINNET_WRITES: "false" } },
});

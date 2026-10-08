import { installSafeErrors } from "./safe-errors.js";
if (process.argv[1]?.endsWith("/local.ts")) installSafeErrors();
import fs from "node:fs";
import ganache from "ganache";
import { spawn } from "node:child_process";
import { assertLocal, localMnemonic, setup } from "../packages/core/chain.js";
import { Store } from "../packages/core/storage.js";
import { tick } from "../apps/worker/worker.js";
import { startApi } from "../apps/api/server.js";
assertLocal();
fs.mkdirSync(".local/chain", { recursive: true, mode: 0o700 });
const chain = ganache.server({
  wallet: { mnemonic: localMnemonic, totalAccounts: 5 },
  chain: { chainId: 31337, hardfork: "shanghai" },
  miner: { blockTime: 1 },
  database: { dbPath: ".local/chain" },
  logging: { quiet: true },
});
await chain.listen(8545, "127.0.0.1");
await setup();
const store = new Store();
const api = startApi(store);
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await tick(store);
  } catch (e) {
    console.error(
      JSON.stringify({ event: "worker-error", errorClass: (e as Error).name }),
    );
  } finally {
    busy = false;
  }
}, 1000);
const web = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
);
console.log(
  "Simulation running: chain 31337; web port 3000; API port 3001. Use pnpm demo:run in another terminal.",
);
async function shutdown() {
  clearInterval(timer);
  web.kill("SIGTERM");
  await new Promise<void>((resolve) => api.close(() => resolve()));
  while (busy) await new Promise((resolve) => setTimeout(resolve, 50));
  await chain.close();
  store.close();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

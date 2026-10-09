import { installSafeErrors } from "./safe-errors.js";
import { Store } from "../packages/core/storage.js";
import { tick } from "../apps/worker/worker.js";
import { runtimeConfig } from "../packages/core/config.js";
installSafeErrors();
runtimeConfig({ readOnly: true });
const store = new Store();
let running = true;
process.once("SIGINT", () => {
  running = false;
});
process.once("SIGTERM", () => {
  running = false;
});
while (running) {
  try {
    await tick(store);
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "WORKER_FAILURE",
        errorClass: (e as Error).name,
        at: new Date().toISOString(),
      }),
    );
  }
  await new Promise((r) => setTimeout(r, 1000));
}
store.close();

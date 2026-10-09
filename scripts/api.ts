import { installSafeErrors } from "./safe-errors.js";
import { Store } from "../packages/core/storage.js";
import { startApi } from "../apps/api/server.js";
installSafeErrors();
const store = new Store(),
  server = startApi(store);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );

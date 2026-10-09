import fs from "node:fs";
import { NativeMarketAdapter } from "../packages/core/market.js";
import { runtimeConfig } from "../packages/core/config.js";
import { stringify } from "../packages/core/domain.js";
import { installSafeErrors } from "./safe-errors.js";
installSafeErrors();
const config = runtimeConfig();
if (!process.env.NATIVE_SOURCE_CONFIG)
  throw new Error("NATIVE_SOURCE_CONFIG_REQUIRED");
const source = JSON.parse(
  fs.readFileSync(process.env.NATIVE_SOURCE_CONFIG, "utf8"),
);
if (source.chainId !== config.chainId) throw new Error("NATIVE_CHAIN_MISMATCH");
const snapshot = await new NativeMarketAdapter(source).snapshot();
fs.writeFileSync(config.snapshotPath, stringify(snapshot));
console.log(
  JSON.stringify({
    snapshotId: snapshot.snapshotId,
    trustMode: snapshot.trustMode,
    oldestSource: snapshot.oldestComponentUpdatedAt,
  }),
);

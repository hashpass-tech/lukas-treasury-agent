import {
  hackathon,
  resolveAttributionCode,
} from "../packages/core/hackathon.js";
import { installSafeErrors } from "./safe-errors.js";
if (process.argv[1]?.endsWith("/ops.ts")) installSafeErrors();
import fs from "node:fs";
import { runtimeConfig } from "../packages/core/config.js";
import { Store } from "../packages/core/storage.js";
import { assertLocal, clients, manifest } from "../packages/core/chain.js";
import { verifyTx } from "../packages/core/attribution.js";
const command = process.argv[2];
if (command === "validate") {
  const config = runtimeConfig();
  if (config.mode === "LOCAL") assertLocal();
  console.log(
    JSON.stringify({
      valid: true,
      mode: config.mode,
      chainId: config.chainId,
      attributionCode: config.attributionCode,
      mainnetWrites: process.env.MAINNET_WRITES === "true",
    }),
  );
} else if (command === "evidence") {
  const store = new Store();
  const receipts = store
    .list()
    .filter((o) => o.state === "RECONCILED")
    .map((o) => ({ obligationId: o.id, ...JSON.parse(o.receipt!) }));
  fs.mkdirSync(".local", { recursive: true });
  fs.writeFileSync(
    ".local/evidence.json",
    JSON.stringify(
      {
        mode: manifest().mode,
        eligibleMainnetEvidence: false,
        event: hackathon,
        receipts,
      },
      null,
      2,
    ),
  );
  const audit = store.db
    .prepare("SELECT seq,previousHash,hash FROM audit ORDER BY seq")
    .all();
  fs.writeFileSync(
    ".local/audit-checkpoints.jsonl",
    audit.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  store.close();
  console.log(
    `Exported ${receipts.length} ${manifest().mode} receipts, without signatures, raw transactions or supplier descriptions.`,
  );
} else if (command === "attribution") {
  const hash = process.argv[3];
  if (!hash?.match(/^0x[0-9a-fA-F]{64}$/))
    throw new Error("Supply transaction hash: pnpm attribution:verify <hash>");
  const result = await verifyTx({
    client: clients().publicClient,
    hash: hash as `0x${string}`,
  });
  console.log(JSON.stringify({ mode: manifest().mode, result }));
  if (!result?.codes.includes(resolveAttributionCode())) process.exitCode = 1;
} else throw new Error("Unknown operation");

import fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { installSafeErrors } from "./safe-errors.js";
installSafeErrors();
const root = ".local/tools";
fs.mkdirSync(root, { recursive: true });
const file = `${root}/solc-0.8.30`;
if (!fs.existsSync(file)) {
  const base =
    "https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/linux-amd64/";
  const list = (await (await fetch(base + "list.json")).json()) as any;
  const path = list.releases["0.8.30"],
    build = list.builds.find((b: any) => b.path === path);
  if (!build || !build.sha256) throw new Error("SOLC_CHECKSUM_MISSING");
  const response = await fetch(base + path);
  if (!response.ok) throw new Error("SOLC_DOWNLOAD_FAILED");
  const bytes = Buffer.from(await response.arrayBuffer());
  if ("0x" + createHash("sha256").update(bytes).digest("hex") !== build.sha256)
    throw new Error("SOLC_CHECKSUM_MISMATCH");
  fs.writeFileSync(file, bytes, { mode: 0o700 });
}
// The npm shim does not propagate child exit codes; invoke the native binary.
const require = createRequire(
  path.resolve("node_modules/@foundry-rs/forge/package.json"),
);
const arch = process.arch === "x64" ? "amd64" : process.arch;
const platform = process.platform === "win32" ? "win32" : process.platform;
const binary = require.resolve(
  `@foundry-rs/forge-${platform}-${arch}/bin/forge${process.platform === "win32" ? ".exe" : ""}`,
);
const result = spawnSync(
  binary,
  ["test", "--use", file, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;

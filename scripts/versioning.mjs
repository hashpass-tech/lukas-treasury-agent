import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const specsCwd = path.join(root, ".specs");
const cli = path.join(
  root,
  "node_modules",
  "@edcalderon",
  "versioning",
  "dist",
  "cli.js",
);

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: specsCwd,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(
    `Unable to run @edcalderon/versioning: ${result.error.message}`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const versioningCli = path.join(root, "scripts", "versioning.mjs");
const releaseType = process.argv[2] ?? "patch";
const supportedTypes = new Set(["patch", "minor", "major"]);

const fail = (message) => {
  console.error(`Release failed: ${message}`);
  process.exit(1);
};

const output = (command, args, cwd = root) => {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    fail(`${command} ${args.join(" ")} failed: ${detail}`);
  }
};

const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, CI: "1" },
    stdio: "inherit",
  });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed`);
};

if (!supportedTypes.has(releaseType))
  fail(
    `release type must be patch, minor, or major (received '${releaseType}')`,
  );

const branch = output("git", ["branch", "--show-current"]);
if (branch !== "main")
  fail(`releases must run from main (currently '${branch}')`);

if (output("git", ["status", "--porcelain"]))
  fail("working tree must be clean before starting a release");

run("git", ["fetch", "origin", "main", "--quiet"]);
const head = output("git", ["rev-parse", "HEAD"]);
const remoteHead = output("git", ["rev-parse", "origin/main"]);
if (head !== remoteHead)
  fail(
    "main is not synchronized with origin/main; pull or push before releasing",
  );

const previousTag = output("git", [
  "describe",
  "--tags",
  "--abbrev=0",
  "--match",
  "v[0-9]*",
]);
const commits = output("git", ["log", "--format=%s", `${previousTag}..HEAD`])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
if (commits.length === 0)
  fail(
    `no commits exist after ${previousTag}; release a change, not an empty version bump`,
  );

console.log(`Running release checks before ${releaseType} release…`);
run("pnpm", ["lint"]);
run("pnpm", ["test"]);
run("pnpm", ["build"]);
run("pnpm", ["specs:validate"]);

run(process.execPath, [
  versioningCli,
  "bump",
  releaseType,
  "--no-commit",
  "--no-tag",
  "--config",
  "versioning.config.json",
]);

const packagePath = path.join(root, "package.json");
const version = JSON.parse(fs.readFileSync(packagePath, "utf8")).version;
const date = new Date().toISOString().slice(0, 10);
const changelogPath = path.join(root, "CHANGELOG.md");
const changelog = fs.readFileSync(changelogPath, "utf8");
const escapedVersion = version.replaceAll(".", "\\.");
const heading = new RegExp(
  `^## (?:${escapedVersion}|\\[${escapedVersion}\\](?:\\([^\\n]+\\))?) \\([^\\n]+\\)\\n(?:\\n)*`,
  "m",
);
if (!heading.test(changelog))
  fail(`versioning did not create a changelog entry for ${version}`);

const bulletLines = (commits.length > 0 ? commits : [`Release ${version}`])
  .map((message) => `- ${message.replace(/^[-*]\s*/, "")}`)
  .join("\n");
const entry = `## ${version} (${date})\n\n### Changed\n\n${bulletLines}\n\n`;
fs.writeFileSync(changelogPath, changelog.replace(heading, entry));

run("pnpm", [
  "exec",
  "versioning",
  "update-readme",
  "--readme",
  "README.md",
  "--changelog",
  "CHANGELOG.md",
  "--pkg",
  "package.json",
]);
run("pnpm", ["exec", "versioning", "check-changelog", "--version", version]);
run("pnpm", ["release:metadata:check"]);

run("git", ["add", "-A"]);
run("pnpm", ["exec", "versioning", "check-secrets"]);
run("git", ["commit", "-m", `🔖 chore(release): v${version}`]);
run("git", ["tag", "-a", `v${version}`, "-m", `Release v${version}`]);
run("git", ["push", "origin", "main", `v${version}`]);

console.log(`Released v${version} on main from ${previousTag}.`);

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const version = JSON.parse(read("package.json")).version;
const changelog = read("CHANGELOG.md");
const readme = read("README.md");

const escapedVersion = version.replaceAll(".", "\\.");
const changelogHeading = new RegExp(
  `^## (?:\\[${escapedVersion}\\](?:\\([^\\n]+\\))?|${escapedVersion})(?:\\s|$)`,
  "m",
);
const latestChangesHeading = `## 📋 Latest Changes (v${version})`;
const releaseFooter = `Release <strong>v${version}</strong>`;

const errors = [];
if (!changelogHeading.test(changelog))
  errors.push(`CHANGELOG.md has no entry for ${version}`);
if (!readme.includes(latestChangesHeading))
  errors.push(`README.md is missing '${latestChangesHeading}'`);
if (!readme.includes(releaseFooter))
  errors.push(`README.md footer is missing '${releaseFooter}'`);

if (errors.length > 0) {
  console.error("Release metadata guard failed:");
  for (const error of errors) console.error(`- ${error}`);
  console.error(
    "Run: pnpm exec versioning update-readme --readme README.md --changelog CHANGELOG.md --pkg package.json",
  );
  process.exit(1);
}

console.log(`Release metadata is synchronized for v${version}`);

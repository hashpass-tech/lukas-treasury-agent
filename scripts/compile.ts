import { installSafeErrors } from "./safe-errors.js";
if (process.argv[1]?.endsWith("/compile.ts")) installSafeErrors();
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const solc = require("solc");
export function compile() {
  const source = fs.readFileSync("packages/contracts/Treasury.sol", "utf8");
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "Treasury.sol": { content: source } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "shanghai",
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
      {
        import: (name: string) => {
          try {
            return {
              contents: fs.readFileSync(
                path.join("node_modules", name),
                "utf8",
              ),
            };
          } catch {
            return { error: `Missing ${name}` };
          }
        },
      },
    ),
  );
  const errors = (output.errors ?? []).filter(
    (e: any) => e.severity === "error",
  );
  if (errors.length)
    throw new Error(errors.map((e: any) => e.formattedMessage).join("\n"));
  fs.mkdirSync(".local", { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    ".local/contracts.json",
    JSON.stringify(output.contracts["Treasury.sol"]),
  );
  return output.contracts["Treasury.sol"];
}
if (process.argv[1]?.endsWith("compile.ts")) {
  compile();
  console.log(
    "Compiled treasury, fixture oracle and simulation token (Solidity 0.8.30).",
  );
}

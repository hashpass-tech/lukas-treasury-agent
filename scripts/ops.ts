import {
  hackathon,
  resolveAttributionCode,
} from "../packages/core/hackathon.js";
import { installSafeErrors } from "./safe-errors.js";
if (process.argv[1]?.endsWith("/ops.ts")) installSafeErrors();
import fs from "node:fs";
import { Store } from "../packages/core/storage.js";
import {
  assertLocal,
  clients,
  manifest,
  artifacts,
} from "../packages/core/chain.js";
import { verifyTx } from "../packages/core/attribution.js";
import { stringify } from "../packages/core/domain.js";
const command = process.argv[2];
if (command === "validate") {
  assertLocal();
  console.log(
    "LOCAL configuration valid. Remote modes are blocked in this release.",
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
      { mode: "Simulation", eligibleMainnetEvidence: false, receipts },
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
    `Exported ${receipts.length} local receipts, without signatures, raw transactions or supplier descriptions.`,
  );
} else if (command === "identity") {
  fs.mkdirSync(".local", { recursive: true });
  fs.writeFileSync(
    ".local/agent-registration.draft.json",
    JSON.stringify(
      {
        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        name: "LUKAS Treasury",
        description:
          "Local simulation; JACK-inspired treasury runtime. No canonical agent registration yet.",
        image: "",
        services: [],
        active: false,
        x402Support: false,
        registrations: [],
      },
      null,
      2,
    ),
  );
  console.log(
    "Inactive metadata draft prepared. No agent ID or registry address invented. Registration and standards validation remain pending.",
  );
} else if (command === "attribution") {
  const hash = process.argv[3];
  if (!hash?.match(/^0x[0-9a-fA-F]{64}$/))
    throw new Error("Supply transaction hash: pnpm attribution:verify <hash>");
  const result = await verifyTx({
    client: clients().publicClient,
    hash: hash as `0x${string}`,
  });
  console.log(JSON.stringify({ mode: "Simulation", result }));
  if (!result?.codes.includes(resolveAttributionCode())) process.exitCode = 1;
} else if (command === "sepolia" || command === "mainnet") {
  fs.mkdirSync(".local", { recursive: true });
  const contracts = artifacts();
  const plan = {
    status: "PREPARATION_ONLY",
    chainId: command === "sepolia" ? 11142220 : 42220,
    mode: command === "sepolia" ? "CELO_SEPOLIA" : "CELO_MAINNET_PILOT",
    writesEnabled: false,
    event: hackathon,
    contracts: Object.entries(contracts).map(([name, a]: [string, any]) => ({
      name,
      abi: a.abi,
      bytecode: `0x${a.evm.bytecode.object}`,
    })),
    blockers:
      command === "mainnet"
        ? [
            "FixtureOracle cannot be deployed as a mainnet price source",
            "Verified wFIAT allowlist and accepted price provenance",
            "Canonical ERC-8004 identity registered from the permanent agent wallet",
            "Reviewed contract/configuration and exposure limits",
            "Explicit operator authorization",
          ]
        : [
            "Reviewed remote deployer/signer and testnet gas",
            "RPC chain verification",
            "Remote deployment, funding, worker and reconciliation adapter not implemented",
          ],
  };
  fs.writeFileSync(`.local/${command}-plan.json`, stringify(plan));
  console.log(
    `Prepared ${command} review artifact; no transactions sent. Remote execution is not implemented.`,
  );
  process.exitCode = 1;
} else if (command === "pilot") {
  console.log(
    JSON.stringify(
      {
        ready: false,
        mainnetWrites: false,
        event: hackathon,
        gates: {
          localDemo: "implemented",
          testnet: "pending",
          officialWfiat: "unverified",
          oracle: "fixture-only",
          identity: "unregistered",
          issuedAttribution:
            resolveAttributionCode() === hackathon.attributionCode
              ? "configured"
              : "simulation-override",
          agentWallet: hackathon.agentWallet ?? "unassigned",
          operatorAuthorization: "missing",
          securityReview: "pending",
          protocolIssuance: "separate-release",
        },
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else throw new Error("Unknown operation");

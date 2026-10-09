import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { hackathon } from "../packages/core/hackathon.js";
const dir = process.env.SIGNER_SETUP_DIR ?? ".local/signer-setup";
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
for (const [name, length] of [
  ["journal-key", 32],
  ["auth-token", 48],
] as const) {
  const file = `${dir}/${name}`;
  if (!fs.existsSync(file))
    fs.writeFileSync(file, randomBytes(length).toString("hex"), {
      mode: 0o600,
    });
}
fs.writeFileSync(
  `${dir}/public-setup.json`,
  JSON.stringify(
    {
      agentWallet: hackathon.agentWallet,
      role: "executor",
      privateKey:
        "Provision the matching key through a secret manager; no wallet or signing key was generated",
      tls: "Configure trusted TLS certificate/key and an authenticated HTTPS reverse proxy",
      journalKeyFile: `${dir}/journal-key`,
      authTokenFile: `${dir}/auth-token`,
      mainnetWrites: false,
    },
    null,
    2,
  ),
);
console.log(
  `Prepared public setup and private recovery/authentication files under ${dir}. No signing key generated or displayed.`,
);

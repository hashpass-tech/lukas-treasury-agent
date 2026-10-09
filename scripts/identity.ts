import fs from "node:fs";
import { installSafeErrors } from "./safe-errors.js";
import { clients } from "../packages/core/chain.js";
import { publicAddress, runtimeConfig } from "../packages/core/config.js";
import {
  registrationMetadata,
  prepareIdentity,
  verifyIdentity,
} from "../packages/core/identity.js";
import { Store } from "../packages/core/storage.js";
import { type Hex } from "viem";
installSafeErrors();
fs.mkdirSync(".local", { recursive: true });
const command = process.argv[2];
if (command === "prepare") {
  fs.writeFileSync(
    ".local/agent-registration.draft.json",
    JSON.stringify(registrationMetadata(process.env.PUBLIC_ORIGIN), null, 2),
  );
  if ((process.env.MODE ?? "LOCAL") === "LOCAL")
    console.log(
      "Inactive metadata draft prepared. No canonical registration claimed.",
    );
  else {
    const config = runtimeConfig(),
      transaction = await prepareIdentity(
        clients().publicClient,
        config.chainId,
        publicAddress("AGENT_WALLET_ADDRESS"),
        process.env.REGISTRATION_URI ?? "",
      );
    fs.writeFileSync(
      ".local/identity-transaction.json",
      JSON.stringify(transaction, null, 2),
    );
    console.log(JSON.stringify(transaction));
  }
} else if (command === "verify") {
  const hash = process.argv[3];
  if (!hash?.match(/^0x[0-9a-fA-F]{64}$/))
    throw new Error("IDENTITY_TRANSACTION_HASH_REQUIRED");
  const config = runtimeConfig(),
    store = new Store();
  try {
    console.log(
      JSON.stringify(
        await verifyIdentity(
          store,
          clients().publicClient,
          config.chainId,
          publicAddress("AGENT_WALLET_ADDRESS"),
          hash as Hex,
        ),
      ),
    );
  } finally {
    store.close();
  }
} else throw new Error("IDENTITY_COMMAND_REQUIRED");

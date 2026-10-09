import fs from "node:fs";
import { encodeFunctionData } from "viem";
import { installSafeErrors } from "./safe-errors.js";
import { NativeMarketAdapter } from "../packages/core/market.js";
import { runtimeConfig } from "../packages/core/config.js";
import { clients, artifacts, manifest } from "../packages/core/chain.js";
import { Store } from "../packages/core/storage.js";
import { durableDispatch } from "../packages/core/dispatch.js";
import {
  stringify,
  validateSnapshot,
  weights,
  type Snapshot,
} from "../packages/core/domain.js";
import { prepareAttributedTransaction } from "../packages/core/attribution.js";
installSafeErrors();
const config = runtimeConfig(),
  m = manifest(),
  c = clients(),
  a = artifacts(),
  store = new Store();
try {
  let snapshot: Snapshot, name: string, args: unknown[], fn: string;
  if (process.env.ORACLE_MODE === "native") {
    if (!process.env.NATIVE_SOURCE_CONFIG)
      throw new Error("NATIVE_SOURCE_CONFIG_REQUIRED");
    const source = JSON.parse(
      fs.readFileSync(process.env.NATIVE_SOURCE_CONFIG, "utf8"),
    );
    if (source.chainId !== config.chainId)
      throw new Error("SOURCE_CHAIN_MISMATCH");
    snapshot = await new NativeMarketAdapter(source).snapshot();
    name = "NativeIndexOracle";
    fn = "capture";
    args = [];
  } else if (process.env.ORACLE_MODE === "signed-mirror") {
    if (!process.env.MIRROR_ATTESTATION_FILE)
      throw new Error("MIRROR_ATTESTATION_REQUIRED");
    const input = JSON.parse(
      fs.readFileSync(process.env.MIRROR_ATTESTATION_FILE, "utf8"),
    );
    snapshot = input.snapshot;
    validateSnapshot(
      snapshot,
      Math.floor(Date.now() / 1000),
      300,
      config.chainId,
      Number(process.env.SOURCE_CHAIN_ID),
    );
    name = "SignedMirrorOracle";
    fn = "publish";
    args = [
      Object.keys(weights).map((k) =>
        BigInt(snapshot.components.find((c) => c.currency === k)!.usdWad),
      ),
      Object.keys(weights).map((k) =>
        BigInt(snapshot.components.find((c) => c.currency === k)!.updatedAt),
      ),
      BigInt(input.tokenPriceUsdWad),
      BigInt(input.tokenPriceSourceTime),
      snapshot.sourceBlockHash,
      input.signature,
    ];
  } else throw new Error("REVIEWED_ORACLE_MODE_REQUIRED");
  const receipt = await durableDispatch(
    store,
    `oracle:${snapshot.snapshotId}`,
    c,
    c.publisher,
    {
      to: m.oracle,
      data: prepareAttributedTransaction(
        encodeFunctionData({ abi: a[name].abi, functionName: fn, args }),
        config.attributionCode,
      ),
    },
  );
  fs.writeFileSync(config.snapshotPath, stringify(snapshot));
  console.log(
    stringify({
      transactionHash: receipt.transactionHash,
      snapshotId: snapshot.snapshotId,
      trustMode: snapshot.trustMode,
    }),
  );
} finally {
  store.close();
}

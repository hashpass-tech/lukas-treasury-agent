import fs from "node:fs";
import { encodeDeployData, encodeFunctionData, type Address } from "viem";
import { installSafeErrors } from "./safe-errors.js";
import { runtimeConfig } from "../packages/core/config.js";
import {
  clients,
  artifacts,
  manifest,
  publishFixture,
  idFromKey,
  type Manifest,
} from "../packages/core/chain.js";
import { Store } from "../packages/core/storage.js";
import { durableDispatch } from "../packages/core/dispatch.js";
import { prepareAttributedTransaction } from "../packages/core/attribution.js";
import {
  domain,
  intentTypes,
  methodologyHash,
  stringify,
  WAD,
} from "../packages/core/domain.js";
import { tick } from "../apps/worker/worker.js";
installSafeErrors();
const config = runtimeConfig();
if (config.mode !== "CELO_SEPOLIA") throw new Error("SEPOLIA_MODE_REQUIRED");
const c = clients(),
  a = artifacts(),
  store = new Store();
if ((await c.publicClient.getChainId()) !== 11142220)
  throw new Error("CHAIN_MISMATCH");
const command = process.argv[2];
const tagged = (data: `0x${string}`) =>
  prepareAttributedTransaction(data, config.attributionCode);
if (command === "deploy") {
  if (!process.argv.includes("--broadcast")) {
    fs.mkdirSync(".local", { recursive: true });
    fs.writeFileSync(
      ".local/sepolia-plan.json",
      stringify({
        chainId: config.chainId,
        writesEnabled: false,
        owner: c.owner.account.address,
        agent: c.executor.account.address,
        publisher: c.publisher.account.address,
        contracts: ["SepoliaTestToken", "FixtureOracle", "TreasuryVault"],
        assets: "TESTCOP synthetic test asset; not Ripio wFIAT",
      }),
    );
    console.log(
      "Prepared Sepolia deployment plan; add --broadcast to use the configured funded testnet signer.",
    );
  } else {
    const deploy = async (name: string, args: unknown[]) => {
      const receipt = await durableDispatch(
        store,
        `deploy:${name}`,
        c,
        c.deployer,
        {
          data: tagged(
            encodeDeployData({
              abi: a[name].abi,
              bytecode: `0x${a[name].evm.bytecode.object}`,
              args,
            }),
          ),
        },
      );
      if (!receipt.contractAddress) throw new Error("DEPLOY_FAILED");
      return receipt.contractAddress as Address;
    };
    const token = await deploy("SepoliaTestToken", [6]),
      oracle = await deploy("FixtureOracle", [c.publisher.account.address]),
      vault = await deploy("TreasuryVault", [
        c.owner.account.address,
        c.executor.account.address,
        oracle,
        methodologyHash,
      ]);
    const write = (
      key: string,
      address: Address,
      name: string,
      fn: string,
      args: unknown[],
    ) =>
      durableDispatch(store, key, c, c.owner, {
        to: address,
        data: tagged(
          encodeFunctionData({ abi: a[name].abi, functionName: fn, args }),
        ),
      });
    await write("token-policy", vault, "TreasuryVault", "setToken", [
      token,
      6,
      true,
      100000000000n,
      500000000000n,
    ]);
    await write("recipient-policy", vault, "TreasuryVault", "setRecipient", [
      c.recipient,
      true,
    ]);
    await durableDispatch(store, "fund-vault", c, c.deployer, {
      to: token,
      data: tagged(
        encodeFunctionData({
          abi: a.SepoliaTestToken.abi,
          functionName: "transfer",
          args: [vault, 1000000000000n],
        }),
      ),
    });
    const m: Manifest = {
      chainId: 11142220,
      mode: "Celo Sepolia",
      symbol: "TESTCOP",
      vault,
      token,
      oracle,
      owner: c.owner.account.address,
      executor: c.executor.account.address,
      recipient: c.recipient,
      publisher: c.publisher.account.address,
      decimals: 6,
      methodologyHash,
      deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync(config.manifestPath, stringify(m));
    await publishFixture(m);
    console.log(
      stringify({
        status: "DEPLOYED_AND_FUNDED",
        chainId: m.chainId,
        manifest: m,
      }),
    );
  }
} else if (command === "demo") {
  const m = manifest();
  await publishFixture(m);
  const block = await c.publicClient.getBlock(),
    id = idFromKey(`sepolia-supplier:${m.vault}`);
  if (!store.get(id)) {
    const epoch = await c.publicClient.readContract({
      address: m.vault,
      abi: a.TreasuryVault.abi,
      functionName: "policyEpoch",
      args: [],
    });
    const intent = {
      obligationId: id,
      vault: m.vault,
      referenceToken: "0x0000000000000000000000000000000000000000" as Address,
      settlementToken: m.token,
      recipient: m.recipient,
      amountLukasWad: 100n * WAD,
      maxSettlementAtomic: 100000000000n,
      validAfter: block.timestamp + 15n,
      deadline: block.timestamp + 3600n,
      policyEpoch: BigInt(String(epoch)),
      methodologyHash,
      salt: id,
    };
    store.create(id, intent);
    store.authorize(
      id,
      await c.owner.signTypedData({
        domain: domain(m.chainId, m.vault),
        types: intentTypes,
        primaryType: "Intent",
        message: intent,
      }),
    );
  }
  for (let n = 0; n < 120; n++) {
    await tick(store);
    if (store.get(id)?.state === "RECONCILED") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const o = store.get(id)!;
  if (
    o.state === "RECONCILED" &&
    !["localhost", "127.0.0.1"].includes(new URL(config.rpc).hostname)
  )
    fs.writeFileSync(".local/sepolia-receipt.json", o.receipt!);
  console.log(
    stringify({
      id,
      state: o.state,
      reason: o.reason,
      receipt: o.receipt ? JSON.parse(o.receipt) : null,
    }),
  );
  if (o.state !== "RECONCILED") process.exitCode = 1;
} else throw new Error("SEPOLIA_COMMAND_REQUIRED");
store.close();

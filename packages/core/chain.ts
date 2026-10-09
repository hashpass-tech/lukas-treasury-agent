import { resolveAttributionCode } from "./hackathon.js";
import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  http,
  defineChain,
  keccak256,
  stringToHex,
  zeroAddress,
  type Address,
  type Abi,
  type Hex,
  type LocalAccount,
} from "viem";
import { runtimeConfig, publicAddress } from "./config.js";
import { Store } from "./storage.js";
import { durableDispatch } from "./dispatch.js";
import { prepareAttributedTransaction } from "./attribution.js";
import { encodeFunctionData } from "viem";
import { remoteAccount } from "./signer.js";
import { mnemonicToAccount } from "viem/accounts";
import { withAttribution, assertAttributedCalldata } from "./attribution.js";
import { compile } from "../../scripts/compile.js";
import {
  methodologyHash,
  weights,
  type Snapshot,
  stringify,
} from "./domain.js";
export const localChain = defineChain({
  id: 31337,
  name: "Local Simulation",
  nativeCurrency: { name: "Simulation Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});
export const localMnemonic =
  "test test test test test test test test test test test junk";
export function assertLocal() {
  resolveAttributionCode();
  if (process.env.ORACLE_MODE && process.env.ORACLE_MODE !== "fixture")
    throw new Error("FIXTURE_ONLY");
  if (
    (process.env.MODE ?? "LOCAL") !== "LOCAL" ||
    (process.env.CHAIN_ID ?? "31337") !== "31337" ||
    process.env.MAINNET_WRITES === "true"
  )
    throw new Error("LOCAL_ONLY_MAINNET_DISABLED");
  const u = new URL(process.env.RPC_URL ?? "http://127.0.0.1:8545");
  if (!["127.0.0.1", "localhost"].includes(u.hostname))
    throw new Error("LOCAL_RPC_REQUIRED");
}
export function clients() {
  // Public reads remain available after pilot authorization expires. Each remote
  // signing operation independently enforces its role's write authorization.
  const config = runtimeConfig({ readOnly: true });
  if (config.mode === "LOCAL") assertLocal();
  const chain =
    config.mode === "LOCAL"
      ? localChain
      : defineChain({
          id: config.chainId,
          name: config.mode,
          nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
          rpcUrls: { default: { http: [config.rpc] } },
        });
  const transport = http(config.rpc);
  const wallet = (account: LocalAccount) => {
    const guarded = {
      ...account,
      signTransaction: async (
        ...args: Parameters<typeof account.signTransaction>
      ) => {
        assertAttributedCalldata(
          args[0].data ?? "0x",
          resolveAttributionCode(),
        );
        return account.signTransaction(...args);
      },
    } as LocalAccount;
    const client = createWalletClient({
      chain,
      transport,
      account: guarded,
    });
    const code = resolveAttributionCode();
    const tagged = client.extend(withAttribution(code));
    // Expose only implemented write paths: no unwrapped batch/Sync actions.
    return {
      account: client.account,
      chain: client.chain,
      signMessage: client.signMessage,
      signTypedData: client.signTypedData,
      prepareTransactionRequest: client.prepareTransactionRequest,
      writeContract: tagged.writeContract,
      sendTransaction: tagged.sendTransaction,
      signTransaction: (
        request: Parameters<typeof client.signTransaction>[0],
      ) => {
        assertAttributedCalldata(request.data ?? "0x", code);
        return client.signTransaction(request);
      },
      deployContract: (request: {
        abi: Abi;
        bytecode: Hex;
        args?: readonly unknown[];
      }) => {
        const { abi, bytecode, args, ...transaction } = request;
        // Official extension tags the final constructor calldata before signing.
        return tagged.sendTransaction({
          ...transaction,
          data: encodeDeployData({ abi, bytecode, args }),
        });
      },
    };
  };
  const accounts =
    config.mode === "LOCAL"
      ? [0, 1, 2, 3].map((addressIndex) =>
          mnemonicToAccount(localMnemonic, { addressIndex }),
        )
      : [
          remoteAccount(publicAddress("MERCHANT_WALLET_ADDRESS"), "owner"),
          remoteAccount(publicAddress("AGENT_WALLET_ADDRESS"), "executor"),
          { address: publicAddress("RECIPIENT_ADDRESS") } as LocalAccount,
          remoteAccount(publicAddress("PUBLISHER_WALLET_ADDRESS"), "publisher"),
        ];
  return {
    publicClient: createPublicClient({ chain, transport }),
    owner: wallet(accounts[0]),
    deployer:
      config.mode === "LOCAL"
        ? wallet(accounts[0])
        : wallet(
            remoteAccount(publicAddress("DEPLOYER_WALLET_ADDRESS"), "deployer"),
          ),
    executor: wallet(accounts[1]),
    publisher: wallet(accounts[3]),
    recipient: accounts[2].address,
  };
}
export type Manifest = {
  chainId: number;
  mode: "Simulation" | "Celo Sepolia" | "Celo Mainnet Pilot";
  symbol?: string;
  vault: Address;
  token: Address;
  oracle: Address;
  owner: Address;
  executor: Address;
  recipient: Address;
  publisher: Address;
  decimals: number;
  methodologyHash: Hex;
  deployedAt: string;
};
export const artifacts = () =>
  fs.existsSync(".local/contracts.json")
    ? JSON.parse(fs.readFileSync(".local/contracts.json", "utf8"))
    : compile();
export const manifest = (): Manifest =>
  JSON.parse(
    fs.readFileSync(runtimeConfig({ readOnly: true }).manifestPath, "utf8"),
  );
export async function setup() {
  assertLocal();
  fs.mkdirSync(".local", { recursive: true, mode: 0o700 });
  const lock = ".local/deployment.lock";
  let handle: number | undefined;
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      handle = fs.openSync(lock, "wx", 0o600);
      fs.writeFileSync(handle, process.pid.toString());
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let content: string;
      try {
        content = fs.readFileSync(lock, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (!content) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      const pid = Number(content);
      if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error("INVALID_DEPLOYMENT_LOCK");
      try {
        process.kill(pid, 0);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ESRCH") {
          try {
            fs.unlinkSync(lock);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          continue;
        }
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (handle === undefined) throw new Error("DEPLOYMENT_IN_PROGRESS");
  try {
    return await setupUnlocked();
  } finally {
    fs.closeSync(handle);
    fs.unlinkSync(lock);
  }
}
async function setupUnlocked() {
  const c = clients();
  if ((await c.publicClient.getChainId()) !== 31337)
    throw new Error("CHAIN_MISMATCH");
  if (fs.existsSync(".local/deployment.json")) {
    const m = manifest();
    if (await c.publicClient.getCode({ address: m.vault })) return m;
    throw new Error(
      "DEPLOYMENT_CHAIN_RESET: restore chain/database together; do not reset one alone",
    );
  }
  const a = artifacts();
  async function deploy(name: string, args: any[]) {
    const hash = await c.owner.deployContract({
      abi: a[name].abi,
      bytecode: `0x${a[name].evm.bytecode.object}`,
      args,
    });
    const receipt = await c.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success" || !receipt.contractAddress)
      throw new Error("DEPLOY_FAILED");
    return receipt.contractAddress;
  }
  const token = await deploy("SimulationToken", [6]);
  const oracle = await deploy("FixtureOracle", [c.publisher.account.address]);
  const vault = await deploy("TreasuryVault", [
    c.owner.account.address,
    c.executor.account.address,
    oracle,
    methodologyHash,
  ]);
  async function write(
    address: Address,
    name: string,
    fn: string,
    args: any[],
  ) {
    const hash = await c.owner.writeContract({
      address,
      abi: a[name].abi,
      functionName: fn,
      args,
    });
    await c.publicClient.waitForTransactionReceipt({ hash });
  }
  await write(vault, "TreasuryVault", "setToken", [
    token,
    6,
    true,
    100000000000n,
    500000000000n,
  ]);
  await write(vault, "TreasuryVault", "setRecipient", [c.recipient, true]);
  await write(token, "SimulationToken", "transfer", [vault, 1000000000000n]);
  const m: Manifest = {
    chainId: 31337,
    mode: "Simulation",
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
  await publishFixture(m);
  fs.writeFileSync(".local/deployment.json", stringify(m));
  return m;
}
export async function publishFixture(m = manifest(), stale = false) {
  if (m.chainId === 42220) throw new Error("NO_MAINNET_FIXTURE");
  const c = clients(),
    a = artifacts();
  const block = await c.publicClient.getBlock();
  const timestamp = Number(block.timestamp) - (stale ? 600 : 0);
  const prices = {
    BRL: 200000000000000000n,
    MXN: 50000000000000000n,
    COP: 250000000000000n,
    CLP: 1000000000000000n,
    ARS: 1000000000000000n,
  };
  const index =
    Object.entries(weights).reduce(
      (sum, [k, w]) => sum + prices[k as keyof typeof prices] * BigInt(w),
      0n,
    ) / 10000n;
  let hash: Hex;
  const request = {
    address: m.oracle,
    abi: a.FixtureOracle.abi,
    functionName: "publish",
    args: [index, prices.COP, BigInt(timestamp), methodologyHash],
  };
  if (m.chainId === 31337) {
    hash = await c.publisher.writeContract(request);
    await c.publicClient.waitForTransactionReceipt({ hash });
  } else {
    const store = new Store();
    try {
      const receipt = await durableDispatch(
        store,
        `fixture:${timestamp}`,
        c,
        c.publisher,
        {
          to: m.oracle,
          data: prepareAttributedTransaction(
            encodeFunctionData(request),
            resolveAttributionCode(),
          ),
        },
      );
      hash = receipt.transactionHash;
    } finally {
      store.close();
    }
  }
  const s: Snapshot = {
    snapshotId: hash,
    methodologyHash,
    sourceChainId: m.chainId,
    sourceContract: m.oracle,
    sourceBlockNumber: block.number.toString(),
    sourceBlockHash: block.hash,
    observedAt: timestamp,
    oldestComponentUpdatedAt: timestamp,
    indexUsdWad: index.toString(),
    components: Object.entries(weights).map(([currency, weightBps]) => ({
      currency: currency as keyof typeof weights,
      weightBps,
      usdWad: prices[currency as keyof typeof prices].toString(),
      updatedAt: timestamp,
    })),
    trustMode: m.chainId === 31337 ? "fixture" : "testnet-fixture",
    provenance: "Synthetic raw-unit prices; not market or official Ripio data",
  };
  fs.writeFileSync(runtimeConfig().snapshotPath, stringify(s));
  return s;
}
export async function balance(address: Address) {
  const c = clients(),
    m = manifest();
  return c.publicClient.readContract({
    address: m.token,
    abi: artifacts().SimulationToken.abi,
    functionName: "balanceOf",
    args: [address],
  }) as Promise<bigint>;
}
export const idFromKey = (key: string) => keccak256(stringToHex(key));
export { zeroAddress };

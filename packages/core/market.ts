import fs from "node:fs";
import {
  createPublicClient,
  http,
  parseAbi,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { type LukasMarketAdapter } from "./adapters.js";
import {
  weights,
  methodologyHash,
  validateSnapshot,
  type Snapshot,
} from "./domain.js";
import { runtimeConfig } from "./config.js";
export class FileMarketAdapter implements LukasMarketAdapter {
  async snapshot() {
    const config = runtimeConfig(),
      snapshot = JSON.parse(
        fs.readFileSync(config.snapshotPath, "utf8"),
      ) as Snapshot;
    validateSnapshot(
      snapshot,
      Math.floor(Date.now() / 1000),
      300,
      config.chainId,
    );
    return snapshot;
  }
}
const indexAbi = parseAbi([
  "function getIndexUSD() view returns (uint256 value,uint256 updatedAt)",
]);
const feedAbi = parseAbi([
  "function decimals() view returns(uint8)",
  "function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)",
]);
export class NativeMarketAdapter implements LukasMarketAdapter {
  constructor(
    private config: {
      rpc: string;
      chainId: number;
      source: Address;
      sourceCodeHash: Hex;
      components: Record<
        keyof typeof weights,
        { address: Address; codeHash: Hex }
      >;
    },
  ) {}
  async snapshot(): Promise<Snapshot> {
    const pc = createPublicClient({ transport: http(this.config.rpc) }),
      block = await pc.getBlock();
    if ((await pc.getChainId()) !== this.config.chainId)
      throw new Error("SOURCE_CHAIN_MISMATCH");
    const code = await pc.getCode({ address: this.config.source });
    if (!code || keccak256(code) !== this.config.sourceCodeHash)
      throw new Error("SOURCE_CODE_UNVERIFIED");
    const [value, sourceTime] = await pc.readContract({
      address: this.config.source,
      abi: indexAbi,
      functionName: "getIndexUSD",
      blockNumber: block.number,
    });
    const components = await Promise.all(
      Object.entries(weights).map(async ([currency, weightBps]) => {
        const feed = this.config.components[currency as keyof typeof weights];
        if (!feed) throw new Error("MISSING_COMPONENT");
        const code = await pc.getCode({ address: feed.address });
        if (!code || keccak256(code) !== feed.codeHash)
          throw new Error("FEED_CODE_UNVERIFIED");
        const [d, data] = await Promise.all([
          pc.readContract({
            address: feed.address,
            abi: feedAbi,
            functionName: "decimals",
            blockNumber: block.number,
          }),
          pc.readContract({
            address: feed.address,
            abi: feedAbi,
            functionName: "latestRoundData",
            blockNumber: block.number,
          }),
        ]);
        if (d > 18 || data[1] <= 0n || data[4] < data[0])
          throw new Error("INVALID_COMPONENT");
        return {
          currency: currency as keyof typeof weights,
          weightBps,
          usdWad: (data[1] * 10n ** BigInt(18 - d)).toString(),
          updatedAt: Number(data[3]),
        };
      }),
    );
    const snapshot: Snapshot = {
      snapshotId: `${this.config.chainId}:${block.hash}`,
      methodologyHash,
      sourceChainId: this.config.chainId,
      sourceContract: this.config.source,
      sourceBlockNumber: block.number.toString(),
      sourceBlockHash: block.hash,
      observedAt: Number(block.timestamp),
      oldestComponentUpdatedAt: Math.min(...components.map((c) => c.updatedAt)),
      indexUsdWad: (value * 10n ** 10n).toString(),
      components,
      trustMode: "native",
      provenance:
        "Pinned native getIndexUSD and operator-reviewed feed code at one block; upstream scale 1e8 normalized to WAD",
    };
    if (Number(sourceTime) !== snapshot.oldestComponentUpdatedAt)
      throw new Error("SOURCE_TIME_MISMATCH");
    validateSnapshot(
      snapshot,
      Number(block.timestamp),
      300,
      this.config.chainId,
    );
    return snapshot;
  }
}

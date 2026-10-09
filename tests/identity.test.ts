import { it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import ganache from "ganache";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  keccak256,
  pad,
  encodeDeployData,
  type Hex,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { localMnemonic } from "../packages/core/chain.js";
import { Store } from "../packages/core/storage.js";
import {
  prepareIdentity,
  verifyIdentity,
  registrationMetadata,
} from "../packages/core/identity.js";
import {
  prepareAttributedTransaction,
  fromDataSuffix,
} from "../packages/core/attribution.js";
import { hackathon } from "../packages/core/hackathon.js";

// A deliberately minimal test registry behind an actual ERC-1967 proxy. This
// checks tooling against the canonical ABI; it is not a deployed ERC-8004 identity.
it("prepares and verifies tagged identity registration against a clearly labeled local test registry, rejecting unverified code and a different wallet", async () => {
  const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
contract TestIdentityRegistry {
 uint256 public next=1; mapping(uint256=>address) public ownerOf;mapping(uint256=>address) public getAgentWallet;mapping(uint256=>string) public tokenURI;
 event Registered(uint256 indexed agentId,string agentURI,address indexed owner);
 function register(string calldata uri) external returns(uint256 id){id=++next;ownerOf[id]=msg.sender;getAgentWallet[id]=msg.sender;tokenURI[id]=uri;emit Registered(id,uri,msg.sender);}
}`;
  const solc = createRequire(import.meta.url)("solc");
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "IdentityFixture.sol": { content: source } },
        settings: {
          evmVersion: "shanghai",
          outputSelection: {
            "*": {
              "*": [
                "abi",
                "evm.bytecode.object",
                "evm.deployedBytecode.object",
              ],
            },
          },
        },
      }),
      {
        import: (name: string) => ({
          contents: fs.readFileSync(`node_modules/${name}`, "utf8"),
        }),
      },
    ),
  );
  expect(
    (output.errors ?? []).filter((e: any) => e.severity === "error"),
  ).toEqual([]);
  const implementation =
      output.contracts["IdentityFixture.sol"].TestIdentityRegistry,
    proxy =
      output.contracts["@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol"]
        .ERC1967Proxy;
  const provider = ganache.provider({
    wallet: { mnemonic: localMnemonic },
    chain: { chainId: 11142220, hardfork: "shanghai" },
    logging: { quiet: true },
  });
  const chain = defineChain({
      id: 11142220,
      name: "Local identity test emulator",
      nativeCurrency: { name: "Test", symbol: "TEST", decimals: 18 },
      rpcUrls: { default: { http: ["http://unused.local"] } },
    }),
    account = mnemonicToAccount(localMnemonic),
    pc = createPublicClient({ chain, transport: custom(provider as any) }),
    wallet = createWalletClient({
      chain,
      transport: custom(provider as any),
      account,
    }),
    store = new Store(":memory:");
  const savedCode = process.env.REGISTRY_CODE_HASH,
    savedImpl = process.env.REGISTRY_IMPLEMENTATION_CODE_HASH;
  const registry = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const,
    uri = "https://metadata.example.test/local-test-agent.json";
  const originalFetch = globalThis.fetch;
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input, init) =>
      String(input) === uri
        ? Promise.resolve(Response.json(registrationMetadata()))
        : originalFetch(input, init),
    );
  try {
    const hash = await wallet.sendTransaction({
        data: prepareAttributedTransaction(
          encodeDeployData({
            abi: implementation.abi,
            bytecode: `0x${implementation.evm.bytecode.object}`,
            args: [],
          }),
          hackathon.attributionCode,
        ),
      }),
      receipt = await pc.waitForTransactionReceipt({ hash }),
      implAddress = receipt.contractAddress!;
    await provider.request({
      method: "evm_setAccountCode",
      params: [registry, `0x${proxy.evm.deployedBytecode.object}`],
    });
    await provider.request({
      method: "evm_setAccountStorageAt",
      params: [
        registry,
        "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
        pad(implAddress, { size: 32 }),
      ],
    });
    process.env.REGISTRY_CODE_HASH = keccak256(
      (await pc.getCode({ address: registry }))!,
    );
    process.env.REGISTRY_IMPLEMENTATION_CODE_HASH = keccak256(
      (await pc.getCode({ address: implAddress }))!,
    );
    const prepared = await prepareIdentity(
      pc as any,
      11142220,
      account.address,
      uri,
    );
    expect(fromDataSuffix(prepared.data)?.codes).toEqual([
      hackathon.attributionCode,
    ]);
    const registrationHash = await wallet.sendTransaction({
      to: registry,
      data: prepared.data,
      value: 0n,
    });
    await pc.waitForTransactionReceipt({ hash: registrationHash });
    const verified = await verifyIdentity(
      store,
      pc as any,
      11142220,
      account.address,
      registrationHash,
    );
    expect(verified.metadataUri).toBe(uri);
    expect(
      store.db.prepare("SELECT COUNT(*) AS n FROM agent_registrations").get()
        ?.n,
    ).toBe(1);
    await expect(
      verifyIdentity(
        store,
        pc as any,
        11142220,
        mnemonicToAccount(localMnemonic, { addressIndex: 1 }).address,
        registrationHash,
      ),
    ).rejects.toThrow("IDENTITY_TRANSACTION_MISMATCH");
    process.env.REGISTRY_CODE_HASH = ("0x" + "00".repeat(32)) as Hex;
    await expect(
      prepareIdentity(pc as any, 11142220, account.address, uri),
    ).rejects.toThrow("REGISTRY_CODE_UNVERIFIED");
  } finally {
    fetchMock.mockRestore();
    store.close();
    await provider.disconnect();
    if (savedCode === undefined) delete process.env.REGISTRY_CODE_HASH;
    else process.env.REGISTRY_CODE_HASH = savedCode;
    if (savedImpl === undefined)
      delete process.env.REGISTRY_IMPLEMENTATION_CODE_HASH;
    else process.env.REGISTRY_IMPLEMENTATION_CODE_HASH = savedImpl;
  }
}, 30000);

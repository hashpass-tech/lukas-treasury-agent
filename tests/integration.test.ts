import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, it, expect } from "vitest";
import ganache from "ganache";
import { zeroAddress, type Hex } from "viem";
import {
  clients,
  localMnemonic,
  setup,
  artifacts,
  manifest,
  publishFixture,
  balance,
  idFromKey,
} from "../packages/core/chain.js";
import { Store } from "../packages/core/storage.js";
import {
  domain,
  intentTypes,
  parseIntent,
  quote,
  WAD,
} from "../packages/core/domain.js";
import { compile } from "../scripts/compile.js";
import { seed } from "../scripts/demo.js";
import { tick } from "../apps/worker/worker.js";
import { createApi } from "../apps/api/server.js";
const original = process.cwd();
let server: any, store: Store, temp: string;
beforeAll(async () => {
  const a = compile();
  temp = fs.mkdtempSync(path.join(original, ".local/integration-"));
  process.chdir(temp);
  fs.mkdirSync(".local");
  fs.writeFileSync(".local/contracts.json", JSON.stringify(a));
  process.env.MODE = "LOCAL";
  process.env.CHAIN_ID = "31337";
  process.env.MAINNET_WRITES = "false";
  process.env.RPC_URL = "http://127.0.0.1:18545";
  server = ganache.server({
    wallet: { mnemonic: localMnemonic },
    chain: { chainId: 31337, hardfork: "shanghai" },
    logging: { quiet: true },
  });
  await server.listen(18545, "127.0.0.1");
  store = new Store();
  const deployments = await Promise.all([setup(), setup()]);
  expect(deployments[0].vault).toBe(deployments[1].vault);
}, 60000);
afterAll(async () => {
  store?.close();
  await server?.close();
  process.chdir(original);
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
  delete process.env.RPC_URL;
});
async function execute(i: any, signature: Hex, round?: bigint) {
  const c = clients(),
    m = manifest();
  const r =
    round ??
    ((await c.publicClient.readContract({
      address: m.oracle,
      abi: artifacts().FixtureOracle.abi,
      functionName: "latest",
      args: [],
    })) as bigint);
  const sim = await c.publicClient.simulateContract({
    account: c.executor.account,
    address: m.vault,
    abi: artifacts().TreasuryVault.abi,
    functionName: "executePayment",
    args: [i, signature, r],
  });
  const hash = await c.executor.writeContract(sim.request);
  return c.publicClient.waitForTransactionReceipt({ hash });
}
async function newIntent(label: string) {
  const id = await seed(store, label);
  const row = store.get(id)!;
  return {
    id,
    i: parseIntent(JSON.parse(row.intent)),
    signature: row.signature as Hex,
  };
}
it("journals before broadcast and recovers exactly once after signer restart", async () => {
  const before = await balance(manifest().recipient);
  const { id } = await newIntent("recover");
  await tick(store, true);
  expect(store.get(id)?.state).toBe("PREPARED");
  expect(await balance(manifest().recipient)).toBe(before);
  const raw = store.attempts()[0];
  store.close();
  store = new Store();
  await tick(store);
  await tick(store);
  expect(store.get(id)?.state).toBe("RECONCILED");
  const receipt = JSON.parse(store.get(id)!.receipt!);
  expect(receipt.transactionHash).toBe(raw.hash);
  const after = await balance(manifest().recipient);
  expect(after - before).toBe(BigInt(receipt.actualSettlementAtomic));
  await tick(store);
  expect(await balance(manifest().recipient)).toBe(after);
}, 30000);
it("blocks cap excess visibly without a transfer", async () => {
  const id = await seed(store, "too-expensive", 1n);
  const before = await balance(manifest().recipient);
  await tick(store);
  expect(store.get(id)?.state).toBe("BLOCKED");
  expect(store.get(id)?.reason).toBe("MAX_SETTLEMENT_EXCEEDED");
  expect(await balance(manifest().recipient)).toBe(before);
});
it("stale source prices block the worker and vault even when published now", async () => {
  const { id, i, signature } = await newIntent("stale");
  await publishFixture(manifest(), true);
  await tick(store);
  expect(store.get(id)?.reason).toBe("PRICE_STALE");
  await expect(execute(i, signature)).rejects.toThrow();
  await publishFixture();
});
it("contract math matches exact bigint over small and maximum quantities", async () => {
  const { i } = await newIntent("math");
  const c = clients(),
    m = manifest();
  const round = (await c.publicClient.readContract({
    address: m.oracle,
    abi: artifacts().FixtureOracle.abi,
    functionName: "latest",
    args: [],
  })) as bigint;
  const r = (await c.publicClient.readContract({
    address: m.oracle,
    abi: artifacts().FixtureOracle.abi,
    functionName: "rounds",
    args: [round],
  })) as any;
  for (const amount of [1n, WAD, 100n * WAD, 10n ** 30n]) {
    const actual = await c.publicClient.readContract({
      address: m.vault,
      abi: artifacts().TreasuryVault.abi,
      functionName: "previewPayment",
      args: [{ ...i, amountLukasWad: amount }, round],
    });
    expect(actual).toBe(quote(amount, r[0], r[1], 6));
  }
});
it("rejects changed terms, wrong owner, wrong chain, replay, pause, epoch and cancellation", async () => {
  const c = clients(),
    m = manifest(),
    a = artifacts();
  const { i, signature } = await newIntent("security");
  await expect(
    execute({ ...i, recipient: zeroAddress }, signature),
  ).rejects.toThrow();
  await expect(execute({ ...i, vault: m.token }, signature)).rejects.toThrow();
  const wrong = await c.executor.signTypedData({
    domain: domain(31337, m.vault),
    types: intentTypes,
    primaryType: "Intent",
    message: i,
  });
  await expect(execute(i, wrong)).rejects.toThrow();
  const wrongChain = await c.owner.signTypedData({
    domain: domain(42220, m.vault),
    types: intentTypes,
    primaryType: "Intent",
    message: i,
  });
  await expect(execute(i, wrongChain)).rejects.toThrow();
  const write = async (fn: string, args: any[] = []) => {
    const h = await c.owner.writeContract({
      address: m.vault,
      abi: a.TreasuryVault.abi,
      functionName: fn,
      args,
    });
    await c.publicClient.waitForTransactionReceipt({ hash: h });
  };
  await write("pause");
  await expect(execute(i, signature)).rejects.toThrow();
  await write("unpause");
  await write("cancelIntent", [i.obligationId]);
  await expect(execute(i, signature)).rejects.toThrow();
  const replay = await newIntent("replay");
  expect((await execute(replay.i, replay.signature)).status).toBe("success");
  await expect(execute(replay.i, replay.signature)).rejects.toThrow();
  await write("configurePolicy", [300n]);
  await expect(execute(i, signature)).rejects.toThrow();
  await expect(
    c.publicClient.simulateContract({
      account: c.executor.account,
      address: m.vault,
      abi: a.TreasuryVault.abi,
      functionName: "withdraw",
      args: [m.token, m.recipient, 1n],
    }),
  ).rejects.toThrow();
}, 30000);
it("owner authentication is one-use; unauthorized and idempotency-conflicting writes fail", async () => {
  const api = createApi(store),
    c = clients(),
    m = manifest();
  const req = (route: string, body: any, cookie?: string, key?: string) =>
    api.request(route, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
      body: JSON.stringify(body),
    });
  const challenge = await (
    await req("/auth/challenge", { wallet: m.owner })
  ).json();
  const sig = await c.owner.signMessage({ message: challenge.message });
  const verified = await req("/auth/verify", {
    id: challenge.id,
    signature: sig,
  });
  expect(verified.status).toBe(200);
  expect(
    (await req("/auth/verify", { id: challenge.id, signature: sig })).status,
  ).toBe(400);
  const cookie = verified.headers.get("set-cookie")!.split(";")[0];
  const body = {
    recipient: m.recipient,
    amountLukasWad: WAD.toString(),
    maxSettlementAtomic: "1000000000",
    dueAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 3600000).toISOString(),
  };
  expect((await req("/v1/obligations", body, undefined, "unauth")).status).toBe(
    400,
  );
  expect((await req("/v1/obligations", body, cookie, "api-test")).status).toBe(
    201,
  );
  expect(
    (
      await req(
        "/v1/obligations",
        { ...body, amountLukasWad: (2n * WAD).toString() },
        cookie,
        "api-test",
      )
    ).status,
  ).toBe(400);
  expect((await api.request("/ready")).status).toBe(200);
});

it("accepted transaction with missing persistence reconciles the same hash", async () => {
  await publishFixture();
  const { id } = await newIntent("accepted-but-timeout");
  await tick(store, true);
  const attempt = store.attempts().find((a) => a.obligation === id)!;
  await clients().publicClient.sendRawTransaction({
    serializedTransaction: attempt.raw as Hex,
  });
  await tick(store);
  expect(store.get(id)?.state).toBe("RECONCILED");
  expect(JSON.parse(store.get(id)!.receipt!).transactionHash).toBe(
    attempt.hash,
  );
});
it("reorg invalidates a local receipt and replays identical bytes without a second independent payment", async () => {
  await publishFixture();
  const { id } = await newIntent("reorg");
  const before = await balance(manifest().recipient);
  const snapshot = (await clients().publicClient.request({
    method: "evm_snapshot" as any,
  })) as any;
  await tick(store);
  await tick(store);
  expect(store.get(id)?.state).toBe("RECONCILED");
  const attempt = store.attempts().find((a) => a.obligation === id)!;
  const amount = BigInt(
    JSON.parse(store.get(id)!.receipt!).actualSettlementAtomic,
  );
  await clients().publicClient.request({
    method: "evm_revert" as any,
    params: [snapshot] as any,
  });
  expect(await balance(manifest().recipient)).toBe(before);
  await tick(store);
  await tick(store);
  expect(store.get(id)?.state).toBe("RECONCILED");
  expect(JSON.parse(store.get(id)!.receipt!).transactionHash).toBe(
    attempt.hash,
  );
  expect(await balance(manifest().recipient)).toBe(before + amount);
}, 30000);

it("official attribution covers owner, publisher and raw worker signing/recovery on real local targets", async () => {
  process.env.ATTRIBUTION_CODE = "local_simulation";
  try {
    const { verifyTx } = await import("../packages/core/attribution.js");
    const c = clients(),
      m = manifest();
    const ownerHash = await c.owner.writeContract({
      address: m.vault,
      abi: artifacts().TreasuryVault.abi,
      functionName: "configurePolicy",
      args: [300n],
    });
    await c.publicClient.waitForTransactionReceipt({ hash: ownerHash });
    expect(
      (await verifyTx({ client: c.publicClient, hash: ownerHash }))?.codes,
    ).toContain("local_simulation");
    const snapshot = await publishFixture();
    expect(
      (
        await verifyTx({
          client: c.publicClient,
          hash: snapshot.snapshotId as Hex,
        })
      )?.codes,
    ).toContain("local_simulation");
    const { id } = await newIntent("tagged");
    await tick(store, true);
    const attempt = store.attempts().find((a) => a.obligation === id)!;
    await tick(store);
    await tick(store);
    const receipt = JSON.parse(store.get(id)!.receipt!);
    expect(receipt.transactionHash).toBe(attempt.hash);
    expect(receipt.attribution.codes).toContain("local_simulation");
  } finally {
    delete process.env.ATTRIBUTION_CODE;
  }
}, 30000);

it("contract precision agrees with bigint for 6, 8 and 18 decimal tokens", async () => {
  const c = clients(),
    m = manifest(),
    a = artifacts();
  const { i: base } = await newIntent("precision");
  const round = (await c.publicClient.readContract({
    address: m.oracle,
    abi: a.FixtureOracle.abi,
    functionName: "latest",
    args: [],
  })) as bigint;
  const r = (await c.publicClient.readContract({
    address: m.oracle,
    abi: a.FixtureOracle.abi,
    functionName: "rounds",
    args: [round],
  })) as any;
  for (const d of [6, 8, 18]) {
    const h = await c.owner.deployContract({
      abi: a.SimulationToken.abi,
      bytecode: `0x${a.SimulationToken.evm.bytecode.object}`,
      args: [d],
    });
    const token = (await c.publicClient.waitForTransactionReceipt({ hash: h }))
      .contractAddress!;
    const config = await c.owner.writeContract({
      address: m.vault,
      abi: a.TreasuryVault.abi,
      functionName: "setToken",
      args: [token, d, true, 10n ** 30n, 10n ** 31n],
    });
    await c.publicClient.waitForTransactionReceipt({ hash: config });
    for (const amount of [1n, WAD, 10n ** 30n]) {
      const actual = await c.publicClient.readContract({
        address: m.vault,
        abi: a.TreasuryVault.abi,
        functionName: "previewPayment",
        args: [
          { ...base, settlementToken: token, amountLukasWad: amount },
          round,
        ],
      });
      expect(actual).toBe(quote(amount, r[0], r[1], d));
    }
  }
}, 30000);

it("valid owner signatures still cannot bypass future, expired, token or signed-cap boundaries", async () => {
  const c = clients(),
    m = manifest();
  await publishFixture();
  const { i: base } = await newIntent("boundaries");
  for (const changes of [
    { validAfter: base.validAfter + 3600n },
    { deadline: base.validAfter - 1n },
    { settlementToken: m.oracle },
    { maxSettlementAtomic: 1n },
  ]) {
    const i = { ...base, ...changes };
    const signature = await c.owner.signTypedData({
      domain: domain(31337, m.vault),
      types: intentTypes,
      primaryType: "Intent",
      message: i,
    });
    await expect(execute(i, signature)).rejects.toThrow();
    expect(
      await c.publicClient.readContract({
        address: m.vault,
        abi: artifacts().TreasuryVault.abi,
        functionName: "isPaid",
        args: [i.obligationId],
      }),
    ).toBe(false);
  }
});

it("insufficient token balance reverts paid markers and daily counters atomically", async () => {
  const c = clients(),
    m = manifest(),
    a = artifacts();
  const tokenHash = await c.owner.deployContract({
    abi: a.SimulationToken.abi,
    bytecode: `0x${a.SimulationToken.evm.bytecode.object}`,
    args: [6],
  });
  const token = (
    await c.publicClient.waitForTransactionReceipt({ hash: tokenHash })
  ).contractAddress!;
  const config = await c.owner.writeContract({
    address: m.vault,
    abi: a.TreasuryVault.abi,
    functionName: "setToken",
    args: [token, 6, true, 100000000000n, 500000000000n],
  });
  await c.publicClient.waitForTransactionReceipt({ hash: config });
  const { i: base } = await newIntent("no-balance");
  const i = { ...base, settlementToken: token };
  const signature = await c.owner.signTypedData({
    domain: domain(31337, m.vault),
    types: intentTypes,
    primaryType: "Intent",
    message: i,
  });
  await expect(execute(i, signature)).rejects.toThrow();
  expect(
    await c.publicClient.readContract({
      address: m.vault,
      abi: a.TreasuryVault.abi,
      functionName: "isPaid",
      args: [i.obligationId],
    }),
  ).toBe(false);
  const block = await c.publicClient.getBlock();
  expect(
    await c.publicClient.readContract({
      address: m.vault,
      abi: a.TreasuryVault.abi,
      functionName: "dailySpent",
      args: [token, block.timestamp / 86400n],
    }),
  ).toBe(0n);
});

it("does not rebroadcast a known pending transaction while mining is delayed", async () => {
  const c = clients();
  await publishFixture();
  const { id } = await newIntent("delayed-mining");
  await c.publicClient.request({ method: "miner_stop" as any });
  try {
    await tick(store);
    const attempt = store.attempts().find((a) => a.obligation === id)!;
    for (let i = 0; i < 3; i++) await tick(store);
    expect(store.get(id)?.state).toBe("SUBMITTED");
    await c.publicClient.request({ method: "evm_mine" as any });
    await tick(store);
    expect(store.get(id)?.state).toBe("RECONCILED");
    expect(JSON.parse(store.get(id)!.receipt!).transactionHash).toBe(
      attempt.hash,
    );
  } finally {
    await c.publicClient.request({
      method: "miner_start" as any,
      params: [0] as any,
    });
  }
}, 30000);

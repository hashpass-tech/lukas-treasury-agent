import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { it, expect } from "vitest";
import ganache from "ganache";
import { mnemonicToAccount } from "viem/accounts";
import { fromDataSuffix } from "../packages/core/attribution.js";
import { compile } from "../scripts/compile.js";
import { localMnemonic } from "../packages/core/chain.js";
import { DatabaseSync } from "node:sqlite";

it("runs the Sepolia deployment, funding, scheduled payment and restart-safe journal through HTTPS RPC and a constrained signer on an isolated emulator", async () => {
  const root = process.cwd(),
    temp = fs.mkdtempSync(path.join(root, ".local/sepolia-path-"));
  fs.mkdirSync(path.join(temp, ".local"));
  fs.writeFileSync(
    path.join(temp, ".local/contracts.json"),
    JSON.stringify(compile()),
  );
  const cert = path.join(temp, "cert.pem"),
    key = path.join(temp, "tls-key.pem");
  expect(
    spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
      ],
      { stdio: "ignore" },
    ).status,
  ).toBe(0);
  const accounts = {
    owner: mnemonicToAccount(localMnemonic),
    executor: mnemonicToAccount(localMnemonic, { addressIndex: 1 }),
    publisher: mnemonicToAccount(localMnemonic, { addressIndex: 3 }),
    deployer: mnemonicToAccount(localMnemonic, { addressIndex: 4 }),
  };
  const provider = ganache.provider({
    wallet: { mnemonic: localMnemonic },
    chain: { chainId: 11142220, hardfork: "shanghai" },
    miner: { blockTime: 0.1 },
    logging: { quiet: true },
  });
  const sent: string[] = [];
  let signerRequests = 0;
  const server = https.createServer(
    { cert: fs.readFileSync(cert), key: fs.readFileSync(key) },
    async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        let result: any;
        if (req.url === "/sign") {
          signerRequests++;
          const account = accounts[body.role as keyof typeof accounts];
          if (
            !account ||
            account.address.toLowerCase() !== body.address.toLowerCase()
          )
            throw new Error("ROLE");
          const p = body.payload;
          if (body.method === "signTypedData")
            result = { signature: await account.signTypedData(p) };
          else if (body.method === "signTransaction") {
            for (const field of [
              "gas",
              "value",
              "gasPrice",
              "maxFeePerGas",
              "maxPriorityFeePerGas",
            ])
              if (p[field] !== undefined) p[field] = BigInt(p[field]);
            result = { rawTransaction: await account.signTransaction(p) };
          } else throw new Error("METHOD");
        } else {
          if (body.method === "eth_sendRawTransaction")
            sent.push(body.params[0]);
          result = await provider.request({
            method: body.method,
            params: body.params,
          });
          result = { jsonrpc: "2.0", id: body.id, result };
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(result));
      } catch {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: "EMULATOR_REQUEST_FAILED" }));
      }
    },
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  const journal = path.join(temp, "journal-key");
  fs.writeFileSync(journal, "22".repeat(32), { mode: 0o600 });
  const env = {
    ...process.env,
    MODE: "CELO_SEPOLIA",
    CHAIN_ID: "11142220",
    RPC_URL: `https://127.0.0.1:${port}`,
    SIGNER_URL: `https://127.0.0.1:${port}/sign`,
    NODE_EXTRA_CA_CERTS: cert,
    NODE_USE_ENV_PROXY: "0",
    MAINNET_WRITES: "false",
    JOURNAL_KEY_FILE: journal,
    CONFIRMATIONS: "2",
    MAXIMUM_GAS_COST_NATIVE_ATOMIC: "1000000000000000000",
    MERCHANT_WALLET_ADDRESS: accounts.owner.address,
    AGENT_WALLET_ADDRESS: accounts.executor.address,
    PUBLISHER_WALLET_ADDRESS: accounts.publisher.address,
    DEPLOYER_WALLET_ADDRESS: accounts.deployer.address,
    RECIPIENT_ADDRESS: mnemonicToAccount(localMnemonic, { addressIndex: 2 })
      .address,
    ORACLE_MODE: "fixture",
  };
  const run = (args: string[]) =>
    new Promise<{ status: number | null; output: string }>(
      (resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            "--import",
            path.join(root, "node_modules/tsx/dist/loader.mjs"),
            path.join(root, "scripts/sepolia.ts"),
            ...args,
          ],
          { cwd: temp, env, stdio: ["ignore", "pipe", "pipe"] },
        );
        let output = "";
        child.stdout.on("data", (b) => {
          output += b;
        });
        child.stderr.on("data", (b) => {
          output += b;
        });
        child.on("error", reject);
        child.on("exit", (status) => resolve({ status, output }));
      },
    );
  try {
    const deployed = await run(["deploy", "--broadcast"]);
    expect(deployed.status, deployed.output).toBe(0);
    const before = sent.length;
    const restarted = await run(["deploy", "--broadcast"]);
    expect(restarted.status, restarted.output).toBe(0);
    expect(sent.length - before).toBeLessThanOrEqual(1); // Only a new fixture publication may occur.
    const demo = await run(["demo"]);
    expect(demo.status, demo.output).toBe(0);
    expect(demo.output).toContain('"state":"RECONCILED"');
    const db = new DatabaseSync(path.join(temp, ".local/treasury.sqlite"));
    const attempts = db
      .prepare("SELECT raw,nonce FROM attempts")
      .all() as any[];
    expect(attempts).toHaveLength(1);
    expect(attempts[0].raw).toMatch(/^enc1:/);
    db.close();
    const { parseTransaction } = await import("viem");
    for (const raw of sent)
      expect(
        fromDataSuffix(parseTransaction(raw as `0x${string}`).data!)?.codes,
      ).toContain("celo_41fbb6a88a82");
    expect(signerRequests).toBeGreaterThan(5);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await provider.disconnect();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}, 120000);

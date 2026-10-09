import fs from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  http,
  decodeFunctionData,
  hashTypedData,
  keccak256,
  type Hex,
} from "viem";
import { Journal } from "../../packages/core/journal.js";
import { assertAttributedCalldata } from "../../packages/core/attribution.js";
import {
  resolveAttributionCode,
  hackathon,
} from "../../packages/core/hackathon.js";
import { stringify, intentTypes, domain } from "../../packages/core/domain.js";

export function privateFile(file: string) {
  if ((fs.statSync(file).mode & 0o077) !== 0)
    throw new Error("SIGNER_SECRET_PERMISSIONS");
  return fs.readFileSync(file, "utf8").trim();
}
export function createSignerService() {
  const role = process.env.SIGNER_ROLE ?? "executor";
  if (!["executor", "owner", "publisher", "deployer"].includes(role))
    throw new Error("SIGNER_ROLE_INVALID");
  const key = privateFile(process.env.SIGNER_PRIVATE_KEY_FILE ?? "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new Error("SIGNER_PRIVATE_KEY_INVALID");
  const account = privateKeyToAccount(key as Hex),
    token = privateFile(process.env.SIGNER_AUTH_TOKEN_FILE ?? "");
  if (token.length < 32) throw new Error("SIGNER_AUTH_TOKEN_INVALID");
  const mode = process.env.MODE ?? "LOCAL",
    chainId =
      mode === "LOCAL"
        ? 31337
        : mode === "CELO_SEPOLIA"
          ? 11142220
          : mode === "CELO_MAINNET_PILOT"
            ? 42220
            : 0;
  if (!chainId) throw new Error("SIGNER_MODE_INVALID");
  if (
    role === "executor" &&
    mode === "CELO_MAINNET_PILOT" &&
    account.address.toLowerCase() !== hackathon.agentWallet.toLowerCase()
  )
    throw new Error("AGENT_WALLET_PROJECT_MISMATCH");
  const rpc = process.env.RPC_URL;
  if (!rpc || (mode !== "LOCAL" && new URL(rpc).protocol !== "https:"))
    throw new Error("SIGNER_RPC_INVALID");
  const pc = createPublicClient({ transport: http(rpc) }),
    file = process.env.SIGNER_DATABASE_PATH ?? ".local/signer.sqlite";
  fs.mkdirSync(file.substring(0, file.lastIndexOf("/")) || ".", {
    recursive: true,
    mode: 0o700,
  });
  const db = new DatabaseSync(file);
  fs.chmodSync(file, 0o600);
  db.exec(
    "PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS nonces(chainId INTEGER,nonce INTEGER,businessHash TEXT NOT NULL,PRIMARY KEY(chainId,nonce));CREATE TABLE IF NOT EXISTS signatures(requestHash TEXT PRIMARY KEY,transactionHash TEXT NOT NULL,protectedRaw TEXT NOT NULL)",
  );
  const journal = new Journal();
  function authenticate(input: string | undefined) {
    const actual = createHash("sha256")
        .update(input ?? "")
        .digest(),
      expected = createHash("sha256").update(`Bearer ${token}`).digest();
    if (!timingSafeEqual(actual, expected))
      throw new Error("SIGNER_AUTH_REQUIRED");
  }
  async function sign(body: any) {
    if (
      body.role !== role ||
      body.address?.toLowerCase() !== account.address.toLowerCase()
    )
      throw new Error("SIGNER_ROLE_FORBIDDEN");
    if ((await pc.getChainId()) !== chainId) throw new Error("CHAIN_MISMATCH");
    if (body.method === "signTypedData") {
      if (role !== "owner" || !process.env.OWNER_INTENT_APPROVAL_FILE)
        throw new Error("OWNER_INTENT_APPROVAL_REQUIRED");
      const m = JSON.parse(
          fs.readFileSync(
            process.env.DEPLOYMENT_MANIFEST ?? ".local/deployment.json",
            "utf8",
          ),
        ),
        p = body.payload;
      if (
        stringify(p.domain) !== stringify(domain(chainId, m.vault)) ||
        p.primaryType !== "Intent" ||
        stringify(p.types) !== stringify(intentTypes)
      )
        throw new Error("SIGNER_TYPED_DATA_SCOPE");
      const hash = hashTypedData(p),
        approval = JSON.parse(
          fs.readFileSync(process.env.OWNER_INTENT_APPROVAL_FILE, "utf8"),
        );
      if (
        approval.approved !== true ||
        !approval.intentHashes?.includes(hash) ||
        !Number.isFinite(Date.parse(approval.expiresAt)) ||
        Date.parse(approval.expiresAt) <= Date.now()
      )
        throw new Error("OWNER_INTENT_NOT_APPROVED");
      return { signature: await account.signTypedData(p) };
    }
    if (body.method !== "signTransaction")
      throw new Error("SIGNER_METHOD_FORBIDDEN");
    const p = body.payload;
    if (p.chainId !== chainId || !Number.isSafeInteger(p.nonce) || p.nonce < 0)
      throw new Error("SIGNER_TRANSACTION_SCOPE");
    for (const field of [
      "gas",
      "gasPrice",
      "maxFeePerGas",
      "maxPriorityFeePerGas",
      "value",
    ])
      if (p[field] !== undefined) p[field] = BigInt(p[field]);
    assertAttributedCalldata(p.data ?? "0x", resolveAttributionCode());
    const cap = BigInt(process.env.MAXIMUM_GAS_COST_NATIVE_ATOMIC ?? "0");
    if (
      cap <= 0n ||
      !p.gas ||
      p.gas * (p.maxFeePerGas ?? p.gasPrice ?? 0n) > cap
    )
      throw new Error("GAS_CAP");
    if (role === "executor" || role === "publisher") {
      const m = JSON.parse(
        fs.readFileSync(
          process.env.DEPLOYMENT_MANIFEST ?? ".local/deployment.json",
          "utf8",
        ),
      );
      if (
        (p.value ?? 0n) !== 0n ||
        p.to?.toLowerCase() !==
          (role === "executor" ? m.vault : m.oracle).toLowerCase()
      )
        throw new Error("SIGNER_DESTINATION_FORBIDDEN");
      if (role === "executor") {
        const abi = JSON.parse(fs.readFileSync(".local/contracts.json", "utf8"))
            .TreasuryVault.abi,
          call = decodeFunctionData({ abi, data: p.data });
        if (call.functionName !== "executePayment")
          throw new Error("EXECUTOR_SCOPE");
      } else {
        const artifacts = JSON.parse(
            fs.readFileSync(".local/contracts.json", "utf8"),
          ),
          name =
            mode === "CELO_MAINNET_PILOT"
              ? process.env.ORACLE_MODE === "native"
                ? "NativeIndexOracle"
                : "SignedMirrorOracle"
              : "FixtureOracle";
        const call = decodeFunctionData({
          abi: artifacts[name].abi,
          data: p.data,
        });
        if (!["capture", "publish"].includes(call.functionName))
          throw new Error("PUBLISHER_SCOPE");
      }
    } else {
      const approved = JSON.parse(
        fs.readFileSync(
          process.env.SIGNER_TRANSACTION_APPROVAL_FILE ?? "",
          "utf8",
        ),
      );
      if (
        approved.approved !== true ||
        !Number.isFinite(Date.parse(approved.expiresAt)) ||
        Date.parse(approved.expiresAt) <= Date.now() ||
        !approved.transactions?.some(
          (a: any) =>
            a.chainId === chainId &&
            (a.to ?? "").toLowerCase() === (p.to ?? "").toLowerCase() &&
            a.dataHash === keccak256(p.data) &&
            BigInt(a.value ?? "0") === (p.value ?? 0n),
        )
      )
        throw new Error("OWNER_TRANSACTION_NOT_APPROVED");
    }
    const cachedRequestHash = keccak256(new TextEncoder().encode(stringify(p))),
      cached = db
        .prepare("SELECT * FROM signatures WHERE requestHash=?")
        .get(cachedRequestHash) as any;
    if (cached)
      return {
        rawTransaction: journal.recover(
          cached.protectedRaw,
          cached.transactionHash,
        ),
      };
    // Simulate exact attributed bytes. The signer never submits transactions.
    await pc.call({
      account: account.address,
      to: p.to,
      data: p.data,
      value: p.value ?? 0n,
    });
    const businessHash = keccak256(
        new TextEncoder().encode(
          stringify({ to: p.to, value: p.value ?? 0n, data: p.data }),
        ),
      ),
      requestHash = keccak256(new TextEncoder().encode(stringify(p)));
    db.exec("BEGIN IMMEDIATE");
    try {
      const nonce = db
        .prepare("SELECT businessHash FROM nonces WHERE chainId=? AND nonce=?")
        .get(chainId, p.nonce) as any;
      if (nonce && nonce.businessHash !== businessHash)
        throw new Error("SIGNER_NONCE_CONFLICT");
      const previous = db
        .prepare("SELECT * FROM signatures WHERE requestHash=?")
        .get(requestHash) as any;
      if (previous) {
        db.exec("COMMIT");
        return {
          rawTransaction: journal.recover(
            previous.protectedRaw,
            previous.transactionHash,
          ),
        };
      }
      const raw = await account.signTransaction(p),
        hash = keccak256(raw);
      db.prepare("INSERT OR IGNORE INTO nonces VALUES(?,?,?)").run(
        chainId,
        p.nonce,
        businessHash,
      );
      db.prepare("INSERT INTO signatures VALUES(?,?,?)").run(
        requestHash,
        hash,
        journal.protect(raw, hash),
      );
      db.exec("COMMIT");
      return { rawTransaction: raw };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  let active = false;
  return {
    authenticate,
    async sign(body: any) {
      if (active) throw new Error("SIGNER_BUSY");
      active = true;
      try {
        return await sign(body);
      } finally {
        active = false;
      }
    },
    close: () => db.close(),
    address: account.address,
    role,
  };
}

import { parseDraft } from "../../packages/core/parser.js";
import { bodyLimit } from "hono/body-limit";
import {
  runtimeConfig,
  assertMainnetAuthorization,
} from "../../packages/core/config.js";
import {
  prepareOwnerAction,
  verifyOwnerAction,
  ownerActions,
} from "../../packages/core/owner-actions.js";
import { resolveAttributionCode } from "../../packages/core/hackathon.js";
import fs from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  verifyMessage,
  verifyTypedData,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";
import { Store } from "../../packages/core/storage.js";
import {
  clients,
  manifest,
  balance,
  artifacts,
  idFromKey,
  zeroAddress,
} from "../../packages/core/chain.js";
import {
  domain,
  intentTypes,
  methodologyHash,
  parseIntent,
  stringify,
  quote,
  validateSnapshot,
} from "../../packages/core/domain.js";
const address = z.string().refine(isAddress);
const uint = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .max(40);
const timestamp = z.string().datetime({ offset: true });
export function createApi(store: Store) {
  const app = new Hono();
  const config = runtimeConfig({ readOnly: true });
  store.bind(config.chainId, manifest().vault);
  const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000";
  if (config.mode !== "LOCAL" && new URL(origin).protocol !== "https:")
    throw new Error("PUBLIC_HTTPS_REQUIRED");
  app.use(
    "*",
    bodyLimit({
      maxSize: 32768,
      onError: (c) => c.json({ error: "BODY_TOO_LARGE" }, 413),
    }),
  );
  const rate = new Map<string, { at: number; count: number }>();
  app.use("*", async (c, next) => {
    const key = "local";
    const entry = rate.get(key);
    if (!entry || Date.now() - entry.at > 60000)
      rate.set(key, { at: Date.now(), count: 1 });
    else if (++entry.count > 300) return c.json({ error: "RATE_LIMIT" }, 429);
    if (["POST", "PUT", "DELETE"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      if (config.mode !== "LOCAL" && !origin)
        return c.json(
          {
            error: "ORIGIN_REQUIRED",
            code: "ORIGIN_REQUIRED",
            retryable: false,
            correlationId: randomUUID(),
          },
          403,
        );
      if (
        origin &&
        !(
          config.mode === "LOCAL"
            ? [
                process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000",
                "http://localhost:3000",
                "http://127.0.0.1:3001",
              ]
            : [process.env.PUBLIC_ORIGIN!]
        ).includes(origin)
      )
        return c.json({ error: "ORIGIN" }, 403);
      if (c.req.header("content-type")?.split(";")[0] !== "application/json")
        return c.json({ error: "JSON_REQUIRED" }, 415);
    }
    await next();
  });
  app.onError((e, c) => {
    const code =
      e instanceof z.ZodError
        ? "INVALID_INPUT"
        : (e.message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/)?.[1] ??
          "INTERNAL_ERROR");
    return c.json(
      {
        error: code,
        code,
        message: code.replaceAll("_", " "),
        retryable: ["RPC_UNCERTAIN", "INTERNAL_ERROR"].includes(code),
        correlationId: randomUUID(),
      },
      code === "AUTH_REQUIRED"
        ? 401
        : code === "NOT_TREASURY_OWNER"
          ? 403
          : code === "NOT_FOUND"
            ? 404
            : code === "IDEMPOTENCY_CONFLICT"
              ? 409
              : code === "INTERNAL_ERROR"
                ? 503
                : 400,
    );
  });
  async function wallet(c: any) {
    const token = getCookie(c, "treasury_session");
    const s = token
      ? (store.db
          .prepare("SELECT * FROM sessions WHERE id=? AND expires>?")
          .get(token, Date.now()) as any)
      : null;
    if (!s) throw new Error("AUTH_REQUIRED");
    if (s.wallet.toLowerCase() !== manifest().owner.toLowerCase())
      throw new Error("NOT_TREASURY_OWNER");
    const current = await clients().publicClient.readContract({
      address: manifest().vault,
      abi: artifacts().TreasuryVault.abi,
      functionName: "owner",
      args: [],
    });
    if (String(current).toLowerCase() !== s.wallet.toLowerCase())
      throw new Error("NOT_TREASURY_OWNER");
    return s.wallet;
  }
  app.get("/health", (c) => c.json({ status: "ok", mode: manifest().mode }));
  app.get("/ready", async (c) => {
    const chain = await clients().publicClient.getChainId();
    const ok =
      chain === config.chainId &&
      !!(await clients().publicClient.getCode({ address: manifest().vault }));
    return c.json({ ready: ok, chainId: chain }, ok ? 200 : 503);
  });
  app.get("/metrics", async (c) => {
    if (config.mode !== "LOCAL") await wallet(c);
    const counts = store.db
      .prepare(
        "SELECT state, COUNT(*) AS count FROM obligations GROUP BY state",
      )
      .all();
    const beat = store.db
      .prepare("SELECT value FROM metadata WHERE key='workerHeartbeat'")
      .get() as { value: string } | undefined;
    const attempts = store
      .attempts()
      .filter(
        (a) =>
          a.active &&
          !["RECONCILED", "FAILED"].includes(store.get(a.obligation)!.state),
      );
    return c.json({
      mode: manifest().mode,
      counts,
      workerHeartbeatAgeMs: beat ? Date.now() - Number(beat.value) : null,
      pendingTransactions: attempts.length,
      oldestPendingAt: attempts.length
        ? store.db
            .prepare(
              "SELECT MIN(created) AS at FROM attempts WHERE obligation IN (SELECT id FROM obligations WHERE state IN ('PREPARED','SUBMITTED'))",
            )
            .get()
        : null,
    });
  });
  app.get("/v1/config", (c) =>
    c.json({
      ...manifest(),
      identity:
        store.db
          .prepare(
            "SELECT chainId,registry,agentId,wallet,transactionHash,metadataUri FROM agent_registrations WHERE chainId=?",
          )
          .get(config.chainId) ?? null,
      attribution: {
        code: resolveAttributionCode(),
        eligibleMainnetEvidence: false,
      },
      mainnetWrites: (() => {
        if (config.mode !== "CELO_MAINNET_PILOT") return false;
        try {
          assertMainnetAuthorization();
          return true;
        } catch {
          return false;
        }
      })(),
    }),
  );
  app.post("/auth/challenge", async (c) => {
    const { wallet: w } = z
      .object({ wallet: address })
      .parse(await c.req.json());
    const id = randomUUID();
    const message = `LUKAS Treasury wallet login\nOrigin: ${origin}\nURI: ${origin}/auth/verify\nIssuedAt: ${new Date().toISOString()}\nChain: ${config.chainId}\nWallet: ${w.toLowerCase()}\nNonce: ${randomBytes(24).toString("hex")}\nExpires: ${new Date(Date.now() + 300000).toISOString()}`;
    store.db
      .prepare("INSERT INTO challenges VALUES(?,?,?,?)")
      .run(id, w.toLowerCase(), message, Date.now() + 300000);
    return c.json({ id, message });
  });
  app.post("/auth/verify", async (c) => {
    const { id, signature } = z
      .object({
        id: z.string().uuid(),
        signature: z
          .string()
          .regex(/^0x[0-9a-fA-F]+$/)
          .max(300),
      })
      .parse(await c.req.json());
    const row = store.db
      .prepare("SELECT * FROM challenges WHERE id=? AND expires>?")
      .get(id, Date.now()) as any;
    if (
      !row ||
      !(await clients().publicClient.verifyMessage({
        address: row.wallet,
        message: row.message,
        signature: signature as Hex,
      }))
    )
      throw new Error("INVALID_CHALLENGE");
    const token = randomBytes(32).toString("hex");
    store.tx(() => {
      const consumed = store.db
        .prepare("DELETE FROM challenges WHERE id=?")
        .run(id);
      if (consumed.changes !== 1) throw new Error("CHALLENGE_REPLAY");
      store.db
        .prepare("INSERT OR IGNORE INTO wallet_accounts VALUES(?,?)")
        .run(row.wallet, Date.now());
      store.db
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run(token, row.wallet, Date.now() + 3600000);
    });
    setCookie(c, "treasury_session", token, {
      httpOnly: true,
      secure: new URL(origin).protocol === "https:",
      sameSite: "Strict",
      path: "/",
      maxAge: 3600,
    });
    return c.json({ wallet: row.wallet });
  });
  app.post("/auth/logout", (c) => {
    const token = getCookie(c, "treasury_session");
    if (token) store.db.prepare("DELETE FROM sessions WHERE id=?").run(token);
    deleteCookie(c, "treasury_session");
    return c.json({ ok: true });
  });
  // These read routes are a localhost-only simulation dashboard, never production merchant data.
  app.get("/v1/treasury", async (c) => {
    if (config.mode !== "LOCAL") await wallet(c);
    const m = manifest();
    const snapshot = JSON.parse(fs.readFileSync(config.snapshotPath, "utf8"));
    return c.json({
      config: m,
      balanceAtomic: (await balance(m.vault)).toString(),
      recipientBalanceAtomic: (await balance(m.recipient)).toString(),
      snapshot,
      agent: { identity: null, attributionCode: resolveAttributionCode() },
      policy: await chainPolicy(),
      pendingOwnerActions: store.db
        .prepare(
          "SELECT id,transactionHash,payload,status FROM prepared_actions WHERE status='SUBMITTED'",
        )
        .all()
        .map((r: any) => ({
          ...JSON.parse(r.payload),
          transactionHash: r.transactionHash,
          status: r.status,
        })),
      obligations: store.list().map((o) => ({
        id: o.id,
        state: o.state,
        reason: o.reason,
        intent: JSON.parse(o.intent),
        receipt: o.receipt ? JSON.parse(o.receipt) : null,
      })),
    });
  });
  app.post("/v1/intents/parse", async (c) => {
    await wallet(c);
    const { text } = z
      .object({ text: z.string().min(1).max(500) })
      .strict()
      .parse(await c.req.json());
    return c.json(
      parseDraft(text, manifest().symbol ?? "SIMCOP", manifest().decimals),
    );
  });
  app.post("/v1/obligations", async (c) => {
    const actor = await wallet(c);
    const body = z
      .object({
        description: z.string().max(160).optional(),
        recipient: address,
        amountLukasWad: uint,
        maxSettlementAtomic: uint,
        dueAt: timestamp,
        deadline: timestamp,
      })
      .strict()
      .parse(await c.req.json());
    const key = c.req.header("idempotency-key");
    if (!key || key.length > 100) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    const m = manifest();
    if (
      !(await clients().publicClient.readContract({
        address: m.vault,
        abi: artifacts().TreasuryVault.abi,
        functionName: "recipients",
        args: [body.recipient],
      }))
    )
      throw new Error("RECIPIENT_NOT_ALLOWED");
    const validAfter = BigInt(Math.floor(Date.parse(body.dueAt) / 1000)),
      deadline = BigInt(Math.floor(Date.parse(body.deadline) / 1000));
    if (
      deadline <= validAfter ||
      deadline - validAfter > 86400n ||
      BigInt(body.amountLukasWad) > 10n ** 30n
    )
      throw new Error("INVALID_BOUNDS");
    const epoch = (await clients().publicClient.readContract({
      address: m.vault,
      abi: artifacts().TreasuryVault.abi,
      functionName: "policyEpoch",
      args: [],
    })) as bigint;
    const id = idFromKey(`${m.vault}:${key}`);
    const intent = {
      obligationId: id,
      vault: m.vault,
      referenceToken: zeroAddress,
      settlementToken: m.token,
      recipient: body.recipient,
      amountLukasWad: BigInt(body.amountLukasWad),
      maxSettlementAtomic: BigInt(body.maxSettlementAtomic),
      validAfter,
      deadline,
      policyEpoch: epoch,
      methodologyHash,
      salt: idFromKey(key),
    };
    const snapshot = JSON.parse(fs.readFileSync(config.snapshotPath, "utf8"));
    const pc = clients().publicClient,
      now = Number((await pc.getBlock()).timestamp);
    validateSnapshot(
      snapshot,
      now,
      300,
      m.chainId,
      Number(process.env.SOURCE_CHAIN_ID || m.chainId),
    );
    const round = await pc.readContract({
      address: m.oracle,
      abi: artifacts().FixtureOracle.abi,
      functionName: "latest",
      args: [],
    });
    const roundValues = (await pc.readContract({
      address: m.oracle,
      abi: artifacts().FixtureOracle.abi,
      functionName: "rounds",
      args: [round],
    })) as [bigint, bigint, bigint, Hex];
    if (roundValues[2] > BigInt(now) || BigInt(now) - roundValues[2] > 300n)
      throw new Error("PRICE_STALE");
    if (
      roundValues[0] !== BigInt(snapshot.indexUsdWad) ||
      roundValues[3] !== snapshot.methodologyHash
    )
      throw new Error("SNAPSHOT_CHAIN_MISMATCH");
    const quoteAtomic = quote(
      intent.amountLukasWad,
      roundValues[0],
      roundValues[1],
      m.decimals,
    );
    const o = store.create(id, intent, `${actor.toLowerCase()}:create:${key}`, {
      chainId: m.chainId,
      merchantWallet: actor,
      description: body.description ?? "",
    });
    const expiresAt = Math.min(now + 300, Number(roundValues[2]) + 300);
    const quoteId = store.recordQuote(
      id,
      {
        quoteAtomic,
        round,
        snapshotId: snapshot.snapshotId,
        tokenPriceUsdWad: roundValues[1],
        expiresAt,
        rounding: "ceiling-single-rational",
      },
      snapshot,
    );
    return c.json(
      JSON.parse(
        stringify({
          id: o.id,
          domain: domain(m.chainId, m.vault),
          types: intentTypes,
          primaryType: "Intent",
          message: intent,
          quoteAtomic,
          quoteId,
          quoteExpiresAt: expiresAt,
          sourceUpdatedAt: snapshot.oldestComponentUpdatedAt,
        }),
      ),
      201,
    );
  });
  app.post("/v1/obligations/:id/authorize", async (c) => {
    const actor = await wallet(c);
    const { signature } = z
      .object({
        signature: z
          .string()
          .regex(/^0x[0-9a-fA-F]+$/)
          .max(300),
      })
      .parse(await c.req.json());
    const o = store.get(c.req.param("id"));
    if (!o) throw new Error("NOT_FOUND");
    const i = parseIntent(JSON.parse(o.intent));
    if (
      !(await clients().publicClient.verifyTypedData({
        address: manifest().owner,
        domain: domain(manifest().chainId, i.vault),
        types: intentTypes,
        primaryType: "Intent",
        message: i,
        signature: signature as Hex,
      }))
    )
      throw new Error("INVALID_OWNER_SIGNATURE");
    const key = c.req.header("idempotency-key");
    if (!key || key.length > 100) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    store.authorize(o.id, signature, `${actor.toLowerCase()}:${key}`);
    return c.json({ state: "SCHEDULED" });
  });
  app.get("/v1/obligations/:id/receipt", async (c) => {
    if (config.mode !== "LOCAL") await wallet(c);
    const o = store.get(c.req.param("id"));
    return o?.receipt
      ? c.json(JSON.parse(o.receipt))
      : c.json({ error: "UNPAID" }, 404);
  });
  async function chainPolicy() {
    const m = manifest(),
      pc = clients().publicClient,
      abi = artifacts().TreasuryVault.abi;
    const [epoch, paused, age, executor, token] = await Promise.all(
      ["policyEpoch", "paused", "maximumOracleAge", "executor", "tokens"].map(
        (functionName) =>
          pc.readContract({
            address: m.vault,
            abi,
            functionName,
            args: functionName === "tokens" ? [m.token] : [],
          }),
      ),
    );
    return {
      policyEpoch: String(epoch),
      paused,
      maximumOracleAgeSeconds: Number(age),
      executor,
      tokenPolicy: JSON.parse(stringify(token)),
      maximumGasCostNativeAtomic: config.gasCap.toString(),
      authority: "EXECUTE_AUTHORIZED",
    };
  }
  app.get("/v1/treasuries", async (c) => {
    await wallet(c);
    return c.json({ treasuries: [manifest()] });
  });
  app.post("/v1/treasuries", async (c) => {
    const actor = await wallet(c),
      m = manifest();
    const body = z
      .object({ vault: address })
      .strict()
      .parse(await c.req.json());
    if (body.vault.toLowerCase() !== m.vault.toLowerCase())
      throw new Error("CONFIGURED_VAULT_REQUIRED");
    store.db
      .prepare("INSERT OR IGNORE INTO treasuries VALUES(?,?,?,?,?)")
      .run(
        m.vault.toLowerCase(),
        m.chainId,
        m.vault.toLowerCase(),
        actor.toLowerCase(),
        stringify(m),
      );
    return c.json(m, 201);
  });
  app.get("/v1/treasuries/:id", async (c) => {
    await wallet(c);
    if (c.req.param("id").toLowerCase() !== manifest().vault.toLowerCase())
      throw new Error("NOT_FOUND");
    return c.json(manifest());
  });
  app.get("/v1/treasuries/:id/policy", async (c) => {
    await wallet(c);
    if (c.req.param("id").toLowerCase() !== manifest().vault.toLowerCase())
      throw new Error("NOT_FOUND");
    return c.json(await chainPolicy());
  });
  app.post("/v1/treasuries/:id/policy/prepare", async (c) => {
    const actor = await wallet(c);
    if (c.req.param("id").toLowerCase() !== manifest().vault.toLowerCase())
      throw new Error("NOT_FOUND");
    const { action, args } = z
      .object({
        action: z.enum(ownerActions),
        args: z
          .array(
            z.union([
              z.string().max(100),
              z.boolean(),
              z.number().int().min(0).max(18),
            ]),
          )
          .max(5),
      })
      .strict()
      .parse(await c.req.json());
    return c.json(prepareOwnerAction(store, actor, action, args));
  });
  app.post("/v1/actions/:id/submitted", async (c) => {
    const actor = await wallet(c),
      { hash } = z
        .object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) })
        .strict()
        .parse(await c.req.json());
    const row = store.db
      .prepare(
        "SELECT transactionHash FROM prepared_actions WHERE id=? AND wallet=?",
      )
      .get(c.req.param("id"), actor.toLowerCase()) as any;
    if (!row) throw new Error("NOT_FOUND");
    if (row.transactionHash && row.transactionHash !== hash)
      throw new Error("OWNER_ACTION_ALREADY_SUBMITTED");
    store.db
      .prepare(
        "UPDATE prepared_actions SET transactionHash=?,status='SUBMITTED' WHERE id=? AND status='PREPARED'",
      )
      .run(hash, c.req.param("id"));
    return c.json({ transactionHash: hash, status: "SUBMITTED" });
  });
  app.get("/v1/actions/:id", async (c) => {
    const actor = await wallet(c),
      row = store.db
        .prepare("SELECT * FROM prepared_actions WHERE id=? AND wallet=?")
        .get(c.req.param("id"), actor.toLowerCase()) as any;
    if (!row) throw new Error("NOT_FOUND");
    return c.json({
      ...JSON.parse(row.payload),
      transactionHash: row.transactionHash,
      status: row.status,
    });
  });
  app.post("/v1/actions/:id/verify", async (c) => {
    const actor = await wallet(c);
    const { hash } = z
      .object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) })
      .strict()
      .parse(await c.req.json());
    return c.json(
      await verifyOwnerAction(store, c.req.param("id"), actor, hash as Hex),
    );
  });
  app.get("/v1/obligations/:id", async (c) => {
    await wallet(c);
    const o = store.get(c.req.param("id"));
    if (!o) throw new Error("NOT_FOUND");
    return c.json({
      ...o,
      signature: undefined,
      intent: JSON.parse(o.intent),
      receipt: o.receipt ? JSON.parse(o.receipt) : null,
    });
  });
  app.post("/v1/obligations/:id/quote", async (c) => {
    await wallet(c);
    const o = store.get(c.req.param("id"));
    if (!o) throw new Error("NOT_FOUND");
    const snapshot = JSON.parse(fs.readFileSync(config.snapshotPath, "utf8"));
    const pc = clients().publicClient,
      now = Number((await pc.getBlock()).timestamp);
    validateSnapshot(
      snapshot,
      now,
      300,
      config.chainId,
      Number(process.env.SOURCE_CHAIN_ID || config.chainId),
    );
    const m = manifest(),
      a = artifacts(),
      round = await pc.readContract({
        address: m.oracle,
        abi: a.FixtureOracle.abi,
        functionName: "latest",
        args: [],
      });
    const values = (await pc.readContract({
      address: m.oracle,
      abi: a.FixtureOracle.abi,
      functionName: "rounds",
      args: [round],
    })) as [bigint, bigint, bigint, Hex];
    const i = parseIntent(JSON.parse(o.intent));
    if (values[2] > BigInt(now) || BigInt(now) - values[2] > 300n)
      throw new Error("PRICE_STALE");
    if (
      values[0] !== BigInt(snapshot.indexUsdWad) ||
      values[3] !== snapshot.methodologyHash
    )
      throw new Error("SNAPSHOT_CHAIN_MISMATCH");
    const payload = {
      amountAtomic: quote(
        i.amountLukasWad,
        values[0],
        values[1],
        m.decimals,
      ).toString(),
      snapshotId: snapshot.snapshotId,
      tokenPriceUsdWad: values[1].toString(),
      round: String(round),
      expiresAt: Math.min(now + 300, Number(values[2]) + 300),
      rounding: "ceiling-single-rational",
    };
    const quoteId = store.recordQuote(o.id, payload, snapshot);
    return c.json({ quoteId, ...payload });
  });
  app.post("/v1/obligations/:id/cancel/prepare", async (c) => {
    const actor = await wallet(c),
      id = c.req.param("id");
    if (!store.get(id)) throw new Error("NOT_FOUND");
    return c.json(prepareOwnerAction(store, actor, "cancelIntent", [id]));
  });
  app.get("/v1/audit", async (c) => {
    await wallet(c);
    return c.json({
      events: store.db
        .prepare(
          "SELECT seq,previousHash,hash FROM audit ORDER BY seq DESC LIMIT 100",
        )
        .all(),
    });
  });
  app.get("/v1/agent/identity", (c) =>
    c.json({
      status: "UNREGISTERED",
      registrations: store.db
        .prepare(
          "SELECT chainId,registry,agentId,wallet,transactionHash,metadataUri FROM agent_registrations",
        )
        .all(),
    }),
  );
  app.get("/.well-known/agent-registration.json", (c) =>
    c.json({
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: "LUKAS Treasury",
      description: "Owner-authorized treasury runtime",
      active: false,
      x402Support: false,
      services: [],
      registrations: [],
    }),
  );
  for (const method of ["GET", "POST"] as const)
    app.on(method, "/v1/treasuries/:id/obligations", async (c) => {
      await wallet(c);
      if (c.req.param("id").toLowerCase() !== manifest().vault.toLowerCase())
        throw new Error("NOT_FOUND");
      if (method === "GET")
        return c.json({
          obligations: store.list().map((o) => ({
            id: o.id,
            state: o.state,
            reason: o.reason,
            intent: JSON.parse(o.intent),
          })),
        });
      const url = new URL(c.req.url);
      url.pathname = "/v1/obligations";
      return app.request(
        new Request(url, {
          method: "POST",
          headers: c.req.raw.headers,
          body: await c.req.text(),
        }),
      );
    });
  return app;
}
export function startApi(store: Store) {
  return serve({
    fetch: createApi(store).fetch,
    hostname: "127.0.0.1",
    port: 3001,
  });
}

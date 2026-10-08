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
} from "../../packages/core/domain.js";
const address = z.string().refine(isAddress);
const uint = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .max(40);
const timestamp = z.string().datetime({ offset: true });
export function createApi(store: Store) {
  const app = new Hono();
  const rate = new Map<string, { at: number; count: number }>();
  app.use("*", async (c, next) => {
    const key = "local";
    const entry = rate.get(key);
    if (!entry || Date.now() - entry.at > 60000)
      rate.set(key, { at: Date.now(), count: 1 });
    else if (++entry.count > 300) return c.json({ error: "RATE_LIMIT" }, 429);
    if (["POST", "PUT", "DELETE"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      if (
        origin &&
        ![
          "http://127.0.0.1:3000",
          "http://localhost:3000",
          "http://127.0.0.1:3001",
        ].includes(origin)
      )
        return c.json({ error: "ORIGIN" }, 403);
      if (c.req.header("content-type")?.split(";")[0] !== "application/json")
        return c.json({ error: "JSON_REQUIRED" }, 415);
    }
    await next();
  });
  app.onError((e, c) =>
    c.json(
      {
        error:
          e instanceof z.ZodError ? "INVALID_INPUT" : e.message.slice(0, 200),
      },
      400,
    ),
  );
  function wallet(c: any) {
    const token = getCookie(c, "treasury_session");
    const s = token
      ? (store.db
          .prepare("SELECT * FROM sessions WHERE id=? AND expires>?")
          .get(token, Date.now()) as any)
      : null;
    if (!s) throw new Error("AUTH_REQUIRED");
    if (s.wallet.toLowerCase() !== manifest().owner.toLowerCase())
      throw new Error("NOT_TREASURY_OWNER");
    return s.wallet;
  }
  app.get("/health", (c) => c.json({ status: "ok", mode: "Simulation" }));
  app.get("/ready", async (c) => {
    const chain = await clients().publicClient.getChainId();
    const ok =
      chain === 31337 &&
      !!(await clients().publicClient.getCode({ address: manifest().vault }));
    return c.json({ ready: ok, chainId: chain }, ok ? 200 : 503);
  });
  app.get("/metrics", async (c) => {
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
          !["RECONCILED", "FAILED"].includes(store.get(a.obligation)!.state),
      );
    return c.json({
      mode: "Simulation",
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
      identity: null,
      attribution: {
        code: resolveAttributionCode(),
        eligibleMainnetEvidence: false,
      },
      mainnetWrites: false,
    }),
  );
  app.post("/auth/challenge", async (c) => {
    const { wallet: w } = z
      .object({ wallet: address })
      .parse(await c.req.json());
    const id = randomUUID();
    const message = `LUKAS Treasury wallet login\nOrigin: http://127.0.0.1:3000\nChain: 31337\nWallet: ${w.toLowerCase()}\nNonce: ${randomBytes(24).toString("hex")}\nExpires: ${new Date(Date.now() + 300000).toISOString()}`;
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
      !(await verifyMessage({
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
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run(token, row.wallet, Date.now() + 3600000);
    });
    setCookie(c, "treasury_session", token, {
      httpOnly: true,
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
    const m = manifest();
    const snapshot = JSON.parse(
      fs.readFileSync(".local/snapshot.json", "utf8"),
    );
    return c.json({
      config: m,
      balanceAtomic: (await balance(m.vault)).toString(),
      recipientBalanceAtomic: (await balance(m.recipient)).toString(),
      snapshot,
      obligations: store.list().map((o) => ({
        id: o.id,
        state: o.state,
        reason: o.reason,
        intent: JSON.parse(o.intent),
        receipt: o.receipt ? JSON.parse(o.receipt) : null,
      })),
    });
  });
  app.post("/v1/obligations", async (c) => {
    wallet(c);
    const body = z
      .object({
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
    if (body.recipient.toLowerCase() !== m.recipient.toLowerCase())
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
    const o = store.create(id, intent, key);
    const snapshot = JSON.parse(
      fs.readFileSync(".local/snapshot.json", "utf8"),
    );
    return c.json(
      JSON.parse(
        stringify({
          id: o.id,
          domain: domain(31337, m.vault),
          types: intentTypes,
          primaryType: "Intent",
          message: intent,
          quoteAtomic: quote(
            intent.amountLukasWad,
            BigInt(snapshot.indexUsdWad),
            250000000000000n,
            m.decimals,
          ),
        }),
      ),
      201,
    );
  });
  app.post("/v1/obligations/:id/authorize", async (c) => {
    wallet(c);
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
      !(await verifyTypedData({
        address: manifest().owner,
        domain: domain(31337, i.vault),
        types: intentTypes,
        primaryType: "Intent",
        message: i,
        signature: signature as Hex,
      }))
    )
      throw new Error("INVALID_OWNER_SIGNATURE");
    store.authorize(o.id, signature);
    return c.json({ state: "SCHEDULED" });
  });
  app.get("/v1/obligations/:id/receipt", (c) => {
    const o = store.get(c.req.param("id"));
    return o?.receipt
      ? c.json(JSON.parse(o.receipt))
      : c.json({ error: "UNPAID" }, 404);
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

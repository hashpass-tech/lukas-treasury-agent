import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { checkTransition, stringify } from "./domain.js";
import { Journal } from "./journal.js";
export type Obligation = {
  id: string;
  state: string;
  intent: string;
  signature: string | null;
  reason: string | null;
  version: number;
  receipt: string | null;
  retryAt: number | null;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
};
export class Store {
  db: DatabaseSync;
  private transactionDepth = 0;
  journal = new Journal();
  constructor(file = process.env.DATABASE_PATH ?? ".local/treasury.sqlite") {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    if (file !== ":memory:") fs.chmodSync(file, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
 BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
 INSERT OR IGNORE INTO migrations VALUES(1);
 CREATE TABLE IF NOT EXISTS obligations(id TEXT PRIMARY KEY,state TEXT NOT NULL,intent TEXT NOT NULL,signature TEXT,reason TEXT,version INTEGER NOT NULL DEFAULT 0,receipt TEXT);
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,obligation TEXT UNIQUE REFERENCES obligations(id),hash TEXT UNIQUE NOT NULL,raw TEXT NOT NULL,nonce INTEGER NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,event TEXT NOT NULL,previousHash TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS leases(name TEXT PRIMARY KEY,owner TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,message TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS idempotency(key TEXT PRIMARY KEY,payload TEXT NOT NULL,obligation TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 COMMIT;`);
    const version = this.db
      .prepare("SELECT MAX(version) AS version FROM migrations")
      .get() as { version: number };
    if (version.version < 2)
      this.tx(() => {
        this.db.exec(`
      ALTER TABLE obligations ADD COLUMN retryAt INTEGER;
      ALTER TABLE obligations ADD COLUMN retryCount INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE obligations ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE obligations ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE attempts RENAME TO attempts_v1;
      CREATE TABLE attempts(id TEXT PRIMARY KEY,obligation TEXT NOT NULL REFERENCES obligations(id),hash TEXT UNIQUE NOT NULL,raw TEXT NOT NULL,nonce INTEGER NOT NULL,created INTEGER NOT NULL,signer TEXT NOT NULL DEFAULT 'local',active INTEGER NOT NULL DEFAULT 1,replacementOf TEXT,quoteId TEXT,submissionState TEXT NOT NULL DEFAULT 'PREPARED',receiptStatus TEXT,blockNumber TEXT,blockHash TEXT,gasUsed TEXT,effectiveGasPrice TEXT,actualSettlementAtomic TEXT);
      INSERT INTO attempts(id,obligation,hash,raw,nonce,created) SELECT id,obligation,hash,raw,nonce,created FROM attempts_v1;
      DROP TABLE attempts_v1;
      UPDATE attempts SET active=0 WHERE obligation IN (SELECT id FROM obligations WHERE state IN ('RECONCILED','FAILED'));
      CREATE UNIQUE INDEX active_obligation ON attempts(obligation) WHERE active=1;
      CREATE UNIQUE INDEX active_signer_nonce ON attempts(signer,nonce) WHERE active=1;
      CREATE TABLE wallet_accounts(wallet TEXT PRIMARY KEY,createdAt INTEGER NOT NULL);
      CREATE TABLE treasuries(id TEXT PRIMARY KEY,chainId INTEGER NOT NULL,vault TEXT NOT NULL,owner TEXT NOT NULL,config TEXT NOT NULL,UNIQUE(chainId,vault));
      CREATE TABLE recipient_allowlist(treasury TEXT NOT NULL,recipient TEXT NOT NULL,allowed INTEGER NOT NULL,transactionHash TEXT,PRIMARY KEY(treasury,recipient));
      CREATE TABLE token_allowlist(treasury TEXT NOT NULL,token TEXT NOT NULL,decimals INTEGER NOT NULL,enabled INTEGER NOT NULL,provenance TEXT NOT NULL,transactionHash TEXT,PRIMARY KEY(treasury,token));
      CREATE TABLE policies(id TEXT PRIMARY KEY,treasury TEXT NOT NULL,epoch TEXT NOT NULL,payload TEXT NOT NULL,transactionHash TEXT,UNIQUE(treasury,epoch));
      CREATE TABLE authorizations(id TEXT PRIMARY KEY,obligation TEXT NOT NULL,signature TEXT NOT NULL,createdAt INTEGER NOT NULL);
      CREATE TABLE quotes(id TEXT PRIMARY KEY,obligation TEXT NOT NULL,payload TEXT NOT NULL,createdAt INTEGER NOT NULL);
      CREATE TABLE oracle_snapshots(id TEXT PRIMARY KEY,payload TEXT NOT NULL,createdAt INTEGER NOT NULL);
      CREATE TABLE agent_registrations(chainId INTEGER NOT NULL,registry TEXT NOT NULL,agentId TEXT NOT NULL,wallet TEXT NOT NULL,transactionHash TEXT NOT NULL,metadataUri TEXT NOT NULL,PRIMARY KEY(chainId,registry,agentId));
      CREATE TABLE reservations(obligation TEXT PRIMARY KEY,token TEXT NOT NULL,day INTEGER NOT NULL,amount TEXT NOT NULL);
      CREATE TABLE prepared_actions(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,payload TEXT NOT NULL,transactionHash TEXT,createdAt INTEGER NOT NULL);
      INSERT INTO migrations VALUES(2);`);
      });
    if (version.version < 3)
      this.tx(() =>
        this.db.exec(`ALTER TABLE obligations ADD COLUMN chainId INTEGER;
      ALTER TABLE obligations ADD COLUMN vaultAddress TEXT;
      ALTER TABLE obligations ADD COLUMN merchantWallet TEXT;
      ALTER TABLE obligations ADD COLUMN description TEXT NOT NULL DEFAULT '';
      CREATE UNIQUE INDEX chain_vault_obligation ON obligations(chainId,vaultAddress,id);
      INSERT INTO migrations VALUES(3);`),
      );
    if (version.version < 4)
      this.tx(() =>
        this.db.exec(
          "ALTER TABLE prepared_actions ADD COLUMN status TEXT NOT NULL DEFAULT 'PREPARED'; INSERT INTO migrations VALUES(4);",
        ),
      );
    if (version.version < 5)
      this.tx(() =>
        this.db.exec(
          "CREATE TABLE IF NOT EXISTS prepared_requests(obligation TEXT PRIMARY KEY REFERENCES obligations(id),requestHash TEXT NOT NULL,protectedRequest TEXT NOT NULL,quoteId TEXT NOT NULL); INSERT INTO migrations VALUES(5);",
        ),
      );
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    this.transactionDepth++;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this.transactionDepth--;
    }
  }
  audit(event: unknown): void {
    if (this.transactionDepth === 0) {
      this.tx(() => this.audit(event));
      return;
    }
    const previous =
      (
        this.db
          .prepare("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1")
          .get() as any
      )?.hash ?? "0".repeat(64);
    const body = stringify({ at: new Date().toISOString(), event });
    const hash = createHash("sha256")
      .update(previous + body)
      .digest("hex");
    this.db
      .prepare("INSERT INTO audit(event,previousHash,hash) VALUES(?,?,?)")
      .run(body, previous, hash);
  }
  create(
    id: string,
    intent: unknown,
    key = id,
    metadata?: {
      chainId: number;
      merchantWallet: string;
      description?: string;
    },
  ) {
    return this.tx(() => {
      const payload = stringify(intent);
      const requestPayload = metadata
        ? stringify({ intent, metadata })
        : payload;
      const prior = this.db
        .prepare("SELECT * FROM idempotency WHERE key=?")
        .get(key) as any;
      if (prior) {
        if (prior.payload !== requestPayload)
          throw new Error("IDEMPOTENCY_CONFLICT");
        return this.get(prior.obligation)!;
      }
      this.db
        .prepare(
          "INSERT INTO obligations(id,state,intent,createdAt,updatedAt) VALUES(?,'DRAFT',?,?,?)",
        )
        .run(id, payload, Date.now(), Date.now());
      if (metadata)
        this.db
          .prepare(
            "UPDATE obligations SET chainId=?,vaultAddress=?,merchantWallet=?,description=? WHERE id=?",
          )
          .run(
            metadata.chainId,
            (intent as any).vault.toLowerCase(),
            metadata.merchantWallet.toLowerCase(),
            metadata.description ?? "",
            id,
          );
      this.db
        .prepare("INSERT INTO idempotency VALUES(?,?,?)")
        .run(key, requestPayload, id);
      this.audit({ id, state: "DRAFT" });
      this.db
        .prepare(
          "UPDATE obligations SET state='QUOTED',version=version+1 WHERE id=?",
        )
        .run(id);
      this.audit({ id, from: "DRAFT", to: "QUOTED" });
      this.db
        .prepare(
          "UPDATE obligations SET state='AWAITING_AUTHORIZATION',version=version+1 WHERE id=?",
        )
        .run(id);
      this.audit({ id, from: "QUOTED", to: "AWAITING_AUTHORIZATION" });
      return this.get(id)!;
    });
  }
  get(id: string) {
    return this.db.prepare("SELECT * FROM obligations WHERE id=?").get(id) as
      | Obligation
      | undefined;
  }
  list() {
    return this.db
      .prepare("SELECT * FROM obligations ORDER BY rowid DESC")
      .all() as Obligation[];
  }
  transition(
    id: string,
    from: string,
    to: string,
    reason: string | null = null,
  ) {
    checkTransition(from, to);
    return this.tx(() => {
      const result = this.db
        .prepare(
          "UPDATE obligations SET state=?,reason=?,version=version+1,updatedAt=? WHERE id=? AND state=?",
        )
        .run(to, reason, Date.now(), id, from);
      if (result.changes !== 1) throw new Error("CONCURRENT_TRANSITION");
      this.audit({ id, from, to, reason });
      if (["EXPIRED", "CANCELED", "FAILED"].includes(to))
        this.db.prepare("DELETE FROM reservations WHERE obligation=?").run(id);
    });
  }
  authorize(id: string, signature: string, key = id) {
    this.tx(() => {
      const action = `authorize:${id}:${key}`,
        payload = stringify({ signature });
      const prior = this.db
        .prepare("SELECT payload FROM idempotency WHERE key=?")
        .get(action) as { payload: string } | undefined;
      if (prior) {
        if (prior.payload !== payload) throw new Error("IDEMPOTENCY_CONFLICT");
        return;
      }
      const r = this.db
        .prepare(
          "UPDATE obligations SET signature=?,state='AUTHORIZED',version=version+1 WHERE id=? AND state='AWAITING_AUTHORIZATION'",
        )
        .run(signature, id);
      if (r.changes !== 1) throw new Error("NOT_AWAITING_AUTHORIZATION");
      this.db
        .prepare("INSERT INTO authorizations VALUES(?,?,?,?)")
        .run(randomUUID(), id, signature, Date.now());
      this.audit({ id, from: "AWAITING_AUTHORIZATION", to: "AUTHORIZED" });
      this.db
        .prepare(
          "UPDATE obligations SET state='SCHEDULED',updatedAt=? WHERE id=?",
        )
        .run(Date.now(), id);
      this.audit({ id, from: "AUTHORIZED", to: "SCHEDULED" });
      this.db
        .prepare("INSERT INTO idempotency VALUES(?,?,?)")
        .run(action, payload, id);
    });
  }
  lease(owner: string, now = Date.now()) {
    return this.tx(() => {
      this.db
        .prepare(
          "INSERT INTO leases VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE leases.expires<? OR leases.owner=?",
        )
        .run("executor", owner, now + 30000, now, owner);
      return (
        (
          this.db
            .prepare("SELECT owner FROM leases WHERE name='executor'")
            .get() as any
        ).owner === owner
      );
    });
  }
  release(owner: string) {
    this.db.prepare("DELETE FROM leases WHERE owner=?").run(owner);
  }
  attempt(
    id: string,
    hash: string,
    raw: string,
    nonce: number,
    signer = "local",
    replacementOf?: string,
    quoteId?: string,
  ) {
    this.tx(() => {
      if (replacementOf) {
        const previous = this.db
          .prepare(
            "SELECT * FROM attempts WHERE hash=? AND obligation=? AND active=1",
          )
          .get(replacementOf, id) as any;
        if (!previous || previous.nonce !== nonce || previous.signer !== signer)
          throw new Error("INVALID_REPLACEMENT");
        this.db
          .prepare(
            "UPDATE attempts SET active=0,submissionState='REPLACED' WHERE hash=?",
          )
          .run(replacementOf);
      }
      this.db
        .prepare(
          "INSERT INTO attempts(id,obligation,hash,raw,nonce,created,signer,replacementOf,quoteId) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          id,
          hash,
          this.journal.protect(raw, hash),
          nonce,
          Date.now(),
          signer,
          replacementOf ?? null,
          quoteId ?? null,
        );
      this.audit({ id, hash, nonce, event: "SIGNED_JOURNAL" });
    });
  }
  attempts() {
    return this.db
      .prepare("SELECT * FROM attempts ORDER BY created,rowid")
      .all()
      .map((row: any) => ({
        ...row,
        raw: this.journal.recover(row.raw, row.hash),
      })) as {
      id: string;
      obligation: string;
      hash: string;
      raw: string;
      nonce: number;
      signer: string;
      active: number;
      created: number;
    }[];
  }
  receipt(id: string, receipt: unknown) {
    this.tx(() => {
      const r = this.db
        .prepare(
          "UPDATE obligations SET receipt=?,state='CONFIRMED',reason=NULL,version=version+1 WHERE id=? AND state IN ('SUBMITTED','PREPARED','CONFIRMED')",
        )
        .run(stringify(receipt), id);
      if (r.changes !== 1) throw new Error("RECEIPT_STATE");
      this.audit({ id, event: "CONFIRMED", receipt });
      this.db
        .prepare(
          "UPDATE obligations SET state='RECONCILED',updatedAt=? WHERE id=?",
        )
        .run(Date.now(), id);
      this.db.prepare("DELETE FROM reservations WHERE obligation=?").run(id);
      this.db
        .prepare(
          "UPDATE attempts SET active=0,submissionState='RECONCILED' WHERE obligation=?",
        )
        .run(id);
      this.audit({ id, event: "RECONCILED", receipt });
    });
  }
  invalidateReceipt(id: string) {
    this.tx(() => {
      const result = this.db
        .prepare(
          "UPDATE obligations SET state='SUBMITTED', receipt=NULL, reason='REORG', version=version+1 WHERE id=? AND state='RECONCILED'",
        )
        .run(id);
      if (result.changes !== 1) throw new Error("CONCURRENT_TRANSITION");
      this.audit({ id, from: "RECONCILED", to: "SUBMITTED", reason: "REORG" });
      this.db
        .prepare(
          "UPDATE attempts SET active=1 WHERE hash=(SELECT hash FROM attempts WHERE obligation=? ORDER BY created DESC LIMIT 1)",
        )
        .run(id);
    });
  }
  reserve(
    id: string,
    token: string,
    day: number,
    amount: bigint,
    dailyCap: bigint,
    spent: bigint,
  ) {
    return this.tx(() => {
      const entries = this.db
        .prepare(
          "SELECT amount FROM reservations WHERE token=? AND day=? AND obligation<>?",
        )
        .all(token.toLowerCase(), day, id) as { amount: string }[];
      const reserved = entries.reduce(
        (sum, row) => sum + BigInt(row.amount),
        0n,
      );
      if (spent + reserved + amount > dailyCap)
        throw new Error("DAILY_CAP_EXCEEDED");
      this.db
        .prepare(
          "INSERT INTO reservations VALUES(?,?,?,?) ON CONFLICT(obligation) DO UPDATE SET token=excluded.token,day=excluded.day,amount=excluded.amount",
        )
        .run(id, token.toLowerCase(), day, amount.toString());
    });
  }
  recordQuote(id: string, payload: unknown, snapshot: { snapshotId: string }) {
    const quoteId = randomUUID();
    this.tx(() => {
      this.db
        .prepare("INSERT OR IGNORE INTO oracle_snapshots VALUES(?,?,?)")
        .run(snapshot.snapshotId, stringify(snapshot), Date.now());
      this.db
        .prepare("INSERT INTO quotes VALUES(?,?,?,?)")
        .run(quoteId, id, stringify(payload), Date.now());
      this.audit({ id, event: "QUOTED", quoteId });
    });
    return quoteId;
  }
  retry(id: string, reason: string, maxRetries = 12) {
    const o = this.get(id)!;
    this.transition(id, "EVALUATING", "BLOCKED", reason);
    const terminal =
      [
        "POLICY_EPOCH_CHANGED",
        "TOKEN_NOT_ALLOWED",
        "RECIPIENT_NOT_ALLOWED",
        "MAX_SETTLEMENT_EXCEEDED",
        "PER_TX_CAP_EXCEEDED",
        "CANCELED_ONCHAIN",
        "DUPLICATE_PAYMENT",
      ].includes(reason) || o.retryCount >= maxRetries;
    this.db
      .prepare(
        "UPDATE obligations SET retryAt=?,retryCount=retryCount+1 WHERE id=?",
      )
      .run(
        terminal
          ? null
          : Date.now() +
              Math.min(300000, 1000 * 2 ** Math.min(o.retryCount, 8)),
        id,
      );
  }
  close() {
    this.db.close();
  }
  stagePrepared(id: string, request: Record<string, unknown>, quoteId: string) {
    const payload = stringify(request),
      hash = createHash("sha256").update(payload).digest("hex");
    this.tx(() => {
      if (this.get(id)?.state !== "EVALUATING")
        throw new Error("CONCURRENT_TRANSITION");
      this.db
        .prepare("INSERT INTO prepared_requests VALUES(?,?,?,?)")
        .run(id, hash, this.journal.protect(payload, hash), quoteId);
      this.db
        .prepare(
          "UPDATE obligations SET state='PREPARED',version=version+1 WHERE id=?",
        )
        .run(id);
      this.audit({ id, event: "PREPARED", requestHash: hash, quoteId });
    });
  }
  prepared(id: string) {
    const row = this.db
      .prepare("SELECT * FROM prepared_requests WHERE obligation=?")
      .get(id) as any;
    if (!row) return;
    const payload = this.journal.recover(row.protectedRequest, row.requestHash);
    if (createHash("sha256").update(payload).digest("hex") !== row.requestHash)
      throw new Error("PREPARED_REQUEST_CORRUPT");
    const request = JSON.parse(payload);
    for (const k of [
      "gas",
      "gasPrice",
      "maxFeePerGas",
      "maxPriorityFeePerGas",
      "value",
    ])
      if (request[k] !== undefined) request[k] = BigInt(request[k]);
    return { request, quoteId: row.quoteId };
  }
  bind(chainId: number, vault: string) {
    this.tx(() => {
      const value = `${chainId}:${vault.toLowerCase()}`,
        row = this.db
          .prepare("SELECT value FROM metadata WHERE key='chainVaultBinding'")
          .get() as { value: string } | undefined;
      if (row && row.value !== value)
        throw new Error("DATABASE_CHAIN_VAULT_MISMATCH");
      this.db
        .prepare("INSERT OR IGNORE INTO metadata VALUES('chainVaultBinding',?)")
        .run(value);
    });
  }
}

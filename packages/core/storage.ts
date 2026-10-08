import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { checkTransition, stringify } from "./domain.js";
export type Obligation = {
  id: string;
  state: string;
  intent: string;
  signature: string | null;
  reason: string | null;
  version: number;
  receipt: string | null;
};
export class Store {
  db: DatabaseSync;
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
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(event: unknown) {
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
  create(id: string, intent: unknown, key = id) {
    return this.tx(() => {
      const payload = stringify(intent);
      const prior = this.db
        .prepare("SELECT * FROM idempotency WHERE key=?")
        .get(key) as any;
      if (prior) {
        if (prior.payload !== payload) throw new Error("IDEMPOTENCY_CONFLICT");
        return this.get(prior.obligation)!;
      }
      this.db
        .prepare(
          "INSERT INTO obligations(id,state,intent) VALUES(?,'AWAITING_AUTHORIZATION',?)",
        )
        .run(id, payload);
      this.db
        .prepare("INSERT INTO idempotency VALUES(?,?,?)")
        .run(key, payload, id);
      this.audit({ id, state: "AWAITING_AUTHORIZATION" });
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
          "UPDATE obligations SET state=?,reason=?,version=version+1 WHERE id=? AND state=?",
        )
        .run(to, reason, id, from);
      if (result.changes !== 1) throw new Error("CONCURRENT_TRANSITION");
      this.audit({ id, from, to, reason });
    });
  }
  authorize(id: string, signature: string) {
    this.tx(() => {
      const r = this.db
        .prepare(
          "UPDATE obligations SET signature=?,state='SCHEDULED',version=version+1 WHERE id=? AND state='AWAITING_AUTHORIZATION'",
        )
        .run(signature, id);
      if (r.changes !== 1) throw new Error("NOT_AWAITING_AUTHORIZATION");
      this.audit({ id, from: "AWAITING_AUTHORIZATION", to: "SCHEDULED" });
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
  attempt(id: string, hash: string, raw: string, nonce: number) {
    this.tx(() => {
      this.db
        .prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?)")
        .run(randomUUID(), id, hash, raw, nonce, Date.now());
      this.audit({ id, hash, nonce, event: "SIGNED_JOURNAL" });
    });
  }
  attempts() {
    return this.db.prepare("SELECT * FROM attempts").all() as {
      obligation: string;
      hash: string;
      raw: string;
      nonce: number;
    }[];
  }
  receipt(id: string, receipt: unknown) {
    this.tx(() => {
      const r = this.db
        .prepare(
          "UPDATE obligations SET receipt=?,state='RECONCILED',reason=NULL,version=version+1 WHERE id=? AND state IN ('SUBMITTED','PREPARED')",
        )
        .run(stringify(receipt), id);
      if (r.changes !== 1) throw new Error("RECEIPT_STATE");
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
    });
  }
  close() {
    this.db.close();
  }
}

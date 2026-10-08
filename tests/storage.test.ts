import { it, expect } from "vitest";
import { Store } from "../packages/core/storage.js";
it("idempotent creation detects conflicting payloads", () => {
  const s = new Store(":memory:");
  s.create("one", { amount: "1" }, "key");
  expect(s.create("one", { amount: "1" }, "key").id).toBe("one");
  expect(() => s.create("two", { amount: "2" }, "key")).toThrow(
    "IDEMPOTENCY_CONFLICT",
  );
  s.close();
});
it("exclusive leases, expired recovery and compare-and-swap transitions", () => {
  const s = new Store(":memory:");
  expect(s.lease("worker-a", 0)).toBe(true);
  expect(s.lease("worker-b", 1)).toBe(false);
  expect(s.lease("worker-b", 30001)).toBe(true);
  s.create("one", {});
  s.authorize("one", "sig");
  s.transition("one", "SCHEDULED", "EVALUATING");
  expect(() => s.transition("one", "SCHEDULED", "EVALUATING")).toThrow(
    "CONCURRENT_TRANSITION",
  );
  s.close();
});
it("journal uniqueness and transactional audit trail", () => {
  const s = new Store(":memory:");
  s.create("one", {});
  s.attempt("one", "hash", "raw", 1);
  expect(() => s.attempt("one", "hash2", "raw2", 2)).toThrow();
  const audit = s.db.prepare("SELECT * FROM audit ORDER BY seq").all() as any[];
  expect(audit[1].previousHash).toBe(audit[0].hash);
  s.close();
});

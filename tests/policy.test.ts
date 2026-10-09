import { it, expect } from "vitest";
import { evaluatePolicy, type Policy } from "../packages/core/policy.js";
import {
  methodologyHash,
  weights,
  type Snapshot,
  type Intent,
  WAD,
} from "../packages/core/domain.js";
import { Journal } from "../packages/core/journal.js";
import { Store } from "../packages/core/storage.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const addr = "0x1111111111111111111111111111111111111111" as const,
  hash = ("0x" + "11".repeat(32)) as `0x${string}`;
const snapshot: Snapshot = {
  snapshotId: hash,
  methodologyHash,
  sourceChainId: 31337,
  sourceContract: addr,
  sourceBlockNumber: "1",
  sourceBlockHash: hash,
  observedAt: 100,
  oldestComponentUpdatedAt: 100,
  indexUsdWad: WAD.toString(),
  components: Object.entries(weights).map(([currency, weightBps]) => ({
    currency: currency as keyof typeof weights,
    weightBps,
    usdWad: WAD.toString(),
    updatedAt: 100,
  })),
  trustMode: "fixture",
  provenance: "test",
};
const intent: Intent = {
  obligationId: hash,
  vault: addr,
  referenceToken: addr,
  settlementToken: addr,
  recipient: addr,
  amountLukasWad: WAD,
  maxSettlementAtomic: 1000000n,
  validAfter: 0n,
  deadline: 200n,
  policyEpoch: 1n,
  methodologyHash,
  salt: hash,
};
const policy: Policy = {
  chainId: 31337,
  vault: addr,
  owner: addr,
  executor: addr,
  policyEpoch: "1",
  paused: false,
  allowedTokens: [addr],
  allowedRecipients: [addr],
  perTxCap: "1000000",
  dailyCap: "2000000",
  maximumOracleAgeSeconds: 30,
  maximumQuoteAgeSeconds: 30,
  maximumGasCostNativeAtomic: "100",
  maximumRetries: 3,
  validUntil: 200,
};
const input = {
  intent,
  policy,
  snapshot,
  now: 100,
  tokenPriceWad: WAD,
  decimals: 6,
  balance: 2000000n,
  dailySpent: 0n,
  reserved: 0n,
  paid: false,
  canceled: false,
  gasBalance: 1000n,
  authority: "EXECUTE_AUTHORIZED" as const,
};
it("policy separates observe/propose from financial authority and requires replacement authority for changed epoch/cap", () => {
  expect(evaluatePolicy(input).decision).toBe("ALLOW");
  expect(evaluatePolicy({ ...input, authority: "PROPOSE" }).reasons).toEqual([
    "AUTHORITY_REQUIRED",
  ]);
  expect(
    evaluatePolicy({ ...input, policy: { ...policy, policyEpoch: "2" } })
      .decision,
  ).toBe("REQUIRE_NEW_AUTHORIZATION");
  expect(
    evaluatePolicy({ ...input, intent: { ...intent, maxSettlementAtomic: 1n } })
      .decision,
  ).toBe("REQUIRE_NEW_AUTHORIZATION");
});
it("policy blocks stale prices, spend reservations, balance and gas shortages", () => {
  expect(evaluatePolicy({ ...input, now: 131 }).reasons).toEqual([
    "PRICE_STALE",
  ]);
  expect(evaluatePolicy({ ...input, reserved: 1000001n }).reasons).toEqual([
    "DAILY_CAP_EXCEEDED",
  ]);
  expect(evaluatePolicy({ ...input, balance: 1n }).reasons).toEqual([
    "INSUFFICIENT_BALANCE",
  ]);
  expect(evaluatePolicy({ ...input, gasBalance: 1n }).reasons).toEqual([
    "INSUFFICIENT_GAS",
  ]);
});
it("atomic reservation prevents oversubscription across two DB connections", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lukas-race-")),
    file = path.join(dir, "db"),
    a = new Store(file),
    b = new Store(file);
  a.reserve("a", addr, 1, 6n, 10n, 0n);
  expect(() => b.reserve("b", addr, 1, 6n, 10n, 0n)).toThrow(
    "DAILY_CAP_EXCEEDED",
  );
  b.reserve("b", addr, 1, 4n, 10n, 0n);
  a.close();
  b.close();
  fs.rmSync(dir, { recursive: true });
});
it("encrypted recovery authenticates the hash, rejects tampering, and requires restrictive key permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lukas-journal-")),
    file = path.join(dir, "key");
  fs.writeFileSync(file, "11".repeat(32), { mode: 0o600 });
  process.env.JOURNAL_KEY_FILE = file;
  try {
    const j = new Journal(),
      value = j.protect("signed-private-bytes", hash);
    expect(value).not.toContain("signed-private-bytes");
    expect(j.recover(value, hash)).toBe("signed-private-bytes");
    expect(() => j.recover(value, "differenthash")).toThrow();
    fs.chmodSync(file, 0o644);
    expect(() => new Journal()).toThrow("JOURNAL_KEY_PERMISSIONS");
  } finally {
    delete process.env.JOURNAL_KEY_FILE;
    fs.rmSync(dir, { recursive: true });
  }
});

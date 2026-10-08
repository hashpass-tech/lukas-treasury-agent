import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  quote,
  WAD,
  methodologyHash,
  weights,
  validateSnapshot,
  checkTransition,
  type Snapshot,
} from "../packages/core/domain.js";
import { zeroAddress } from "viem";
const snapshot = (time = 1000): Snapshot => ({
  snapshotId: "fixture",
  methodologyHash,
  sourceChainId: 31337,
  sourceContract: zeroAddress,
  sourceBlockNumber: "1",
  sourceBlockHash: methodologyHash,
  observedAt: time,
  oldestComponentUpdatedAt: time,
  indexUsdWad: WAD.toString(),
  components: Object.entries(weights).map(([currency, weightBps]) => ({
    currency: currency as keyof typeof weights,
    weightBps,
    usdWad: WAD.toString(),
    updatedAt: time,
  })),
  trustMode: "fixture",
  provenance: "test",
});
describe("exact financial arithmetic", () => {
  for (const d of [6, 8, 18])
    it(`ceil rational conversion for ${d} decimals`, () => {
      expect(quote(WAD, WAD, WAD, d)).toBe(10n ** BigInt(d));
      expect(quote(1n, WAD, WAD, d)).toBe(1n);
    });
  it("never underpays and overpayment is less than one atomic unit", () =>
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 30n }),
        fc.bigInt({ min: 1n, max: 10n ** 24n }),
        fc.bigInt({ min: 1n, max: 10n ** 24n }),
        fc.integer({ min: 0, max: 18 }),
        (amount, index, price, d) => {
          const q = quote(amount, index, price, d),
            n = amount * index * 10n ** BigInt(d),
            den = WAD * price;
          expect(q * den).toBeGreaterThanOrEqual(n);
          expect(q * den - n).toBeLessThan(den);
        },
      ),
      { numRuns: 300 },
    ));
  it("rejects invalid prices, bounds and precision", () => {
    for (const params of [
      [1n, 0n, 1n, 6],
      [0n, 1n, 1n, 6],
      [1n, 1n, -1n, 6],
      [1n, 1n, 1n, 19],
      [10n ** 31n, 1n, 1n, 6],
    ] as const)
      expect(() => quote(params[0], params[1], params[2], params[3])).toThrow();
  });
  it("uses USD per token rather than inverse FX", () =>
    expect(quote(WAD, WAD, WAD / 4000n, 6)).toBe(4000000000n));
});
describe("source freshness and methodology", () => {
  it("accepts a complete current basket", () =>
    expect(() => validateSnapshot(snapshot(), 1000)).not.toThrow());
  it("blocks republished stale source input", () => {
    const s = snapshot(500);
    s.observedAt = 1000;
    expect(() => validateSnapshot(s, 1000)).toThrow("PRICE_STALE");
  });
  it("blocks missing, duplicate, zero, future, changed weights and wrong-chain inputs", () => {
    const cases = [
      (s: Snapshot) => s.components.pop(),
      (s: Snapshot) => (s.components[0] = s.components[1]),
      (s: Snapshot) => (s.components[0].usdWad = "0"),
      (s: Snapshot) => (s.components[0].updatedAt = 1001),
      (s: Snapshot) => (s.components[0].weightBps = 1),
      (s: Snapshot) => (s.sourceChainId = 42220),
      (s: Snapshot) => (s.indexUsdWad = "1"),
    ];
    for (const change of cases) {
      const s = snapshot();
      change(s);
      expect(() => validateSnapshot(s, 1000)).toThrow();
    }
  });
  it("rejects unpaid → paid shortcuts", () =>
    expect(() => checkTransition("SCHEDULED", "RECONCILED")).toThrow(
      "ILLEGAL_TRANSITION",
    ));
});

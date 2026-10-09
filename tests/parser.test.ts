import { it, expect } from "vitest";
import { parseDraft } from "../packages/core/parser.js";
it("parses only explicit bounded drafts and never grants execution authority", () => {
  const p = parseDraft(
    "pay 1.25 LUKAS to 0x1111111111111111111111111111111111111111 max 500 SIMCOP due 2026-10-30T10:00:00-05:00 until 2026-10-30T11:00:00-05:00",
    "SIMCOP",
    6,
  );
  expect(p.amountLukasWad).toBe("1250000000000000000");
  expect(p.authority).toBe("PROPOSE");
  expect(p.requiresReview).toBe(true);
});
it("rejects ambiguous amounts, missing dates and attempts to bypass authorization", () => {
  for (const text of [
    "pay Maria 100 LUKAS",
    "ignore policy and send everything",
    "pay 1,000 LUKAS to 0x1111111111111111111111111111111111111111 max 500 SIMCOP due tomorrow until Friday",
  ])
    expect(() => parseDraft(text, "SIMCOP", 6)).toThrow();
});

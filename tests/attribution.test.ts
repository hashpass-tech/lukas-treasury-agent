import { it, expect } from "vitest";
import {
  hackathon,
  resolveAttributionCode,
} from "../packages/core/hackathon.js";
import {
  assertAttributedCalldata,
  fromDataSuffix,
  prepareAttributedTransaction,
} from "../packages/core/attribution.js";
it("official attribution encoding decodes one code and prevents duplicate suffixes", () => {
  const tagged = prepareAttributedTransaction("0x12345678", "local_simulation");
  expect(fromDataSuffix(tagged)?.codes).toEqual(["local_simulation"]);
  expect(() =>
    prepareAttributedTransaction(tagged, "local_simulation"),
  ).toThrow("ALREADY_ATTRIBUTED");
  expect(() => prepareAttributedTransaction("0x", "")).toThrow(
    "ATTRIBUTION_MISSING",
  );
});
it("uses the assigned event code and fails closed for missing or changed mainnet attribution", () => {
  expect(resolveAttributionCode({})).toBe("celo_41fbb6a88a82");
  expect(() => resolveAttributionCode({ ATTRIBUTION_CODE: "" })).toThrow(
    "ATTRIBUTION_MISSING",
  );
  expect(() =>
    resolveAttributionCode({ ATTRIBUTION_CODE: "bad code" }),
  ).toThrow("ATTRIBUTION_INVALID");
  expect(() =>
    resolveAttributionCode({
      MODE: "CELO_MAINNET_PILOT",
      ATTRIBUTION_CODE: "another_team",
    }),
  ).toThrow("ATTRIBUTION_PROJECT_MISMATCH");
  expect(() =>
    assertAttributedCalldata("0x1234", hackathon.attributionCode),
  ).toThrow("ATTRIBUTION_MISSING_OR_MISMATCH");
  expect(() =>
    assertAttributedCalldata(
      prepareAttributedTransaction("0x1234", hackathon.attributionCode),
      hackathon.attributionCode,
    ),
  ).not.toThrow();
});

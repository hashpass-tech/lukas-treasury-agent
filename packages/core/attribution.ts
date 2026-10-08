import {
  fromDataSuffix,
  toDataSuffix,
  withAttribution,
  verifyTx,
} from "@celo/attribution-tags";
import { concatHex, type Hex } from "viem";
export function prepareAttributedTransaction(data: Hex, code: string): Hex {
  if (!code.trim()) throw new Error("ATTRIBUTION_MISSING");
  const existing = fromDataSuffix(data);
  if (existing) throw new Error("ALREADY_ATTRIBUTED");
  const attributed = concatHex([data, toDataSuffix(code)]);
  if (!fromDataSuffix(attributed)?.codes.includes(code))
    throw new Error("ATTRIBUTION_ENCODING");
  return attributed;
}
export { fromDataSuffix, withAttribution, verifyTx };

export function assertAttributedCalldata(data: Hex, expectedCode: string) {
  if (!fromDataSuffix(data)?.codes.includes(expectedCode))
    throw new Error("ATTRIBUTION_MISSING_OR_MISMATCH");
}

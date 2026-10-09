import { parseUnits, isAddress } from "viem";
export function parseDraft(text: string, symbol: string, decimals: number) {
  const match = text
    .trim()
    .match(
      /^pay ([0-9]+(?:\.[0-9]+)?) LUKAS to (0x[0-9a-fA-F]{40}) max ([0-9]+(?:\.[0-9]+)?) ([A-Z0-9]+) due (\S+) until (\S+)$/i,
    );
  if (
    !match ||
    !isAddress(match[2]) ||
    match[4].toUpperCase() !== symbol.toUpperCase()
  )
    throw new Error("PARSER_REQUIRES_EXPLICIT_TERMS");
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(match[5]) ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(match[6]) ||
    !Number.isFinite(Date.parse(match[5])) ||
    Date.parse(match[6]) <= Date.parse(match[5])
  )
    throw new Error("PARSER_REQUIRES_EXPLICIT_TIMEZONE");
  if (
    (match[1].split(".")[1]?.length ?? 0) > 18 ||
    (match[3].split(".")[1]?.length ?? 0) > decimals
  )
    throw new Error("PARSER_PRECISION");
  const amount = parseUnits(match[1], 18),
    cap = parseUnits(match[3], decimals);
  if (amount <= 0n || amount > 10n ** 30n || cap <= 0n)
    throw new Error("PARSER_INVALID_BOUNDS");
  return {
    parser: "deterministic",
    authority: "PROPOSE",
    requiresReview: true,
    recipient: match[2],
    amountLukasWad: amount.toString(),
    maxSettlementAtomic: cap.toString(),
    dueAt: new Date(match[5]).toISOString(),
    deadline: new Date(match[6]).toISOString(),
  };
}

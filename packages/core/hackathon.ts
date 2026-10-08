import registration from "../../config/hackathon.json";
export const hackathon = registration;
export function resolveAttributionCode(
  env: Record<string, string | undefined> = process.env,
): string {
  const code = env.ATTRIBUTION_CODE ?? hackathon.attributionCode;
  if (!code.trim()) throw new Error("ATTRIBUTION_MISSING");
  if (!/^[a-z0-9_]{1,32}$/.test(code)) throw new Error("ATTRIBUTION_INVALID");
  if (env.MODE === "CELO_MAINNET_PILOT" && code !== hackathon.attributionCode)
    throw new Error("ATTRIBUTION_PROJECT_MISMATCH");
  return code;
}

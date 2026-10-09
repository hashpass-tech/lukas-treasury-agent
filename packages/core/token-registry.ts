import { z } from "zod";
import {
  isAddress,
  keccak256,
  parseAbi,
  type PublicClient,
  type Address,
  type Hex,
} from "viem";
export const tokenMetadataSchema = z
  .object({
    chainId: z.literal(42220),
    address: z.string().refine(isAddress),
    decimals: z.number().int().min(0).max(18),
    symbol: z.string().min(1).max(16),
    fiatCurrency: z.enum(["BRL", "MXN", "COP", "CLP", "ARS"]),
    issuer: z.literal("Ripio"),
    codeHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    officialSource: z.string().url(),
    acquisitionGuide: z.string().url(),
    reviewedBy: z.string().min(1),
    reviewedAt: z.string().datetime({ offset: true }),
    tokenPriceMode: z.enum(["observable-feed", "accepted-par-assumption"]),
    priceProvenance: z.string().min(20),
    merchantAcceptanceReference: z.string().min(1),
    behaviorReviewed: z.literal(true),
    proxy: z
      .object({
        implementation: z.string().refine(isAddress),
        implementationCodeHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      })
      .optional(),
  })
  .strict();
export type TokenMetadata = z.infer<typeof tokenMetadataSchema>;
export async function verifyTokenMetadata(pc: PublicClient, input: unknown) {
  const t = tokenMetadataSchema.parse(input),
    address = t.address as Address;
  if ((await pc.getChainId()) !== 42220)
    throw new Error("TOKEN_CHAIN_MISMATCH");
  const code = await pc.getCode({ address });
  if (!code || keccak256(code) !== t.codeHash)
    throw new Error("TOKEN_CODE_UNVERIFIED");
  const abi = parseAbi([
    "function decimals() view returns(uint8)",
    "function symbol() view returns(string)",
  ]);
  const [decimals, symbol] = await Promise.all([
    pc.readContract({ address, abi, functionName: "decimals" }),
    pc.readContract({ address, abi, functionName: "symbol" }),
  ]);
  if (decimals !== t.decimals || symbol !== t.symbol)
    throw new Error("TOKEN_METADATA_MISMATCH");
  if (t.proxy) {
    const value = await pc.getStorageAt({
      address,
      slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    });
    if (
      value?.slice(-40).toLowerCase() !==
      t.proxy.implementation.slice(2).toLowerCase()
    )
      throw new Error("TOKEN_PROXY_MISMATCH");
    const implementation = await pc.getCode({
      address: t.proxy.implementation as Address,
    });
    if (
      !implementation ||
      keccak256(implementation) !== t.proxy.implementationCodeHash
    )
      throw new Error("TOKEN_IMPLEMENTATION_UNVERIFIED");
  }
  return t;
}

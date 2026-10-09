# Compatibility index and arithmetic

Version 1 is a documented compatibility implementation of the inspected raw-unit currency basket: BRL 40%, MXN 30%, COP 15%, CLP 10%, ARS 5%. This weighted sum is not an economically normalized hedge and makes no stability, redemption or liquidity promise.

USD WAD per whole unit: BRL 0.20; MXN 0.05; COP 0.00025; CLP/ARS 0.001. Index = 0.0951875 USD WAD per LUKAS reference unit. All five sources must be present, uniquely identified, positive, properly weighted and fresh at their original source timestamps. Republish time cannot refresh stale source time.

`ceil(amountLukasWad * indexUsdWad * 10^decimals / (10^18 * tokenUsdWad))`. Amount <=1e30; prices <=1e24; decimals <=18. The full numerator <=1e72 fits uint256; denominator <=1e42. Exact single rational division; discrepancy from rational amount is less than one atomic unit. No intermediate rounding. Read deployed token precision rather than assuming a symbol's precision. Quote inputs on execution are checked against the validated snapshot and immutable accepted chain round. Native getIndexUSD values use upstream scale 1e8, normalized to WAD by multiplying by 1e10; native and signed-mirror component calculations retain that eight-decimal truncation. LOCAL/Testnet fixtures are labeled distinctly and never accepted as mainnet sources.

The methodology identifier is keccak256 of `lukas-raw-currency-basket:v1:BRL4000,MXN3000,COP1500,CLP1000,ARS500`. EIP-712 fields are ABI encoded in the explicit Intent order in domain.ts, binding chain and vault; ordinary JSON is not a signature hash.

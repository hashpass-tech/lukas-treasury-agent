# Assumptions

This session implements the document's first runnable local slice and adds an owner-signed scheduled payment, onchain caps, recovery and receipts. Its broader P0/P1 release is not complete.

Synthetic prices are USD per whole raw fiat unit. SIMCOP has six decimals. No intermediate USD asset moves. Zero reference-token address explicitly means index denomination without issuing LKS. The fixture publisher is a separate public local test identity, not the executor. Vault trusts this fixture publisher; component validation is offchain and is not a trustless oracle proof.

Mainnet is disabled even if a flag is set. No hosted public deployment is supported. Amounts are bigint/integer strings; timestamps are UTC seconds on chain and ISO8601 across creation API. Display timezone is America/Bogota; daily cap buckets are UTC.

Native Ganache is the equivalent local EVM; Foundry tests, wagmi and a second settlement adapter remain pending. An optional Linux Docker Compose configuration is provided but not tested. The contracts have not been audited. No video, external user evidence or event submission has been fabricated.

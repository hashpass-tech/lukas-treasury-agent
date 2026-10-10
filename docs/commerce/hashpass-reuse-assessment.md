# HashPass pass and check-in reuse assessment

Reviewed 2026-10-10 for issue #1 and HP-10. The user reports hashpass.tech is running, but has no pilot operator or paid-trial evidence. A running product does not satisfy HP-01's commercial gate.

Source baseline: local `/home/ed/Documents/HASH/hashpass.tech`, HEAD `926ef2258e45fd0c230fb2232ff7bac6223cea1d`. This is a source review; deployed revision, endpoints, database migrations, authorization grants and API availability remain unverified. No production requests or transactions were executed.

## Existing capabilities and limits

Paths below are relative to the HashPass repository, not this treasury repository.

| Source / symbol                                                                                | Observed behavior                                                                                                                                                                  | Reuse implication                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile-app/app/api/passes+api.ts`: `authenticatedUser`, `GET`, `POST`, `validateEventId` | Resolves linked Supabase identity; reads own passes; self-service POST permits general passes only and validates a fixed event allowlist.                                          | Useful identity/pass display pattern. This endpoint is not evidence of paid booking issuance or arbitrary pilot activity support.                                 |
| `apps/mobile-app/lib/pass-system.ts`: `PassSystemService.createDefaultPass`                    | Deduplicates concurrent creation promises by user/event/type within one service instance.                                                                                          | This in-memory guard is not durable booking/payment idempotency across processes or retries.                                                                      |
| `apps/mobile-app/lib/qr-system.ts`: `QRSystemService.generatePassQR`, `validateAndUseQR`       | Calls `generate_pass_qr` and `validate_and_use_qr` Supabase RPCs; exposes expiry, use count and invalid/used/revoked/suspended outcomes.                                           | Candidate UI/RPC integration surface, subject to deployment and authorization verification.                                                                       |
| `apps/mobile-app/components/AdminQRScanner.tsx`: `AdminQRScanner`, `scanCallback`              | Checks admin status in the client, parses QR, checks validity, then calls usage RPC and displays details.                                                                          | Scanner UX exists; a client admin check cannot establish server tenant/activity permissions. Logs currently include scanned data/token; redact them before reuse. |
| `db/schema-snapshots/core-prod.sql`: `public.generate_pass_qr` (line 2332)                     | Requires active pass and embeds pass/user/event identifiers in `qr_data`; token uses timestamp and truncated MD5 of random/time input.                                             | Does not satisfy HP-10's signed opaque QR without personal data. A fresh commerce credential contract is required.                                                |
| `db/schema-snapshots/core-prod.sql`: `public.validate_and_use_qr` (line 5299)                  | SECURITY DEFINER function checks QR status/expiry/use count, increments usage and writes scan logs. No booking/payment/policy lookup or scanner authorization appears in its body. | Scan logs are not independently verified commerce attendance or settlement evidence. Verify grants/RLS and add server authorization before any adapter use.       |

The schema snapshot is checked-in evidence, not confirmation of the live database. Legacy migration equivalents under `archive/legacy-root/supabase/migrations/` are historical references, not deployment proof.

The reviewed validation function reads the QR before updating it, with neither `FOR UPDATE` nor a conditional usage guard. At source level, concurrent one-use scans can both pass the preliminary checks and report success; this has not been reproduced against a deployed database. Serial duplicate handling exists, but atomic single-use attendance is unproven and needs a concurrency test and transactional repair before adoption.

## Recommendation

Prefer a narrow server adapter if HP-10 validation proves a supported, authenticated integration. Keep inventory, canonical payment, booking state, frozen policy and attendance settlement authoritative in the commerce domain. Reuse pass display/scanner UX where useful; do not reuse default general-pass creation as proof of purchase.

The adapter must map a durable commerce booking to a HashPass pass and event/activity instance, issue once after canonical payment, and reconcile partial failures. It must mint an opaque signed credential and record authenticated check-in atomically with the commerce booking. HashPass scan success alone must never authorize treasury settlement.

If that contract cannot be verified or safely implemented within pilot scope, use the planned standalone commerce pass/check-in fallback. Label integration as unavailable until demonstrated. This assessment does not implement HP-10 or bypass HP-01, HP-07 or HP-08.

## Missing bindings to specify

- Stable operator/tenant, dated activity instance, booking ID and holder identity mapping; current fixed event IDs are insufficient for arbitrary activities.
- Durable uniqueness/idempotency keyed by booking and canonical payment receipt, with recovery after issuance timeout or process restart.
- Payment-finality gate, canceled/refunded booking revocation, frozen cancellation policy and attendance-to-settlement transition.
- Server-enforced operator/activity permissions and scanner identity derived from authentication rather than caller-supplied IDs.
- Atomic one-use check-in, replay behavior and audited manual override rules; a newly generated QR must not permit a second booking admission.
- Signed opaque QR payload, expiration/revocation semantics and redacted logs without customer identifiers or raw tokens.

## HP-10 validation sequence

1. After commercial and API prerequisites pass, record the supported integration contract, deployed revision and migration evidence without secrets.
2. Verify server-side identity, tenant isolation and scanner permissions; test unauthorized issuance, cross-activity scans and spoofed scanner IDs.
3. Demonstrate canonical-payment-only issuance, stable pass mapping, retries and crash recovery; reject unpaid, canceled and refunded bookings.
4. Test simultaneous scans, serial replay, QR refresh, expiry, revocation and wrong activity; require exactly one durable attendance record.
5. Prove that attendance reaches the commerce settlement workflow with a frozen booking/policy reference; exercise reconciliation after downstream failure.
6. Run Spanish mobile buyer/operator QA on the selected adapter or fallback and record scrubbed results. Claim live HashPass integration only after actual end-to-end evidence.

# Reproduced legacy DB findings and proposed remedies

These are synthetic PostgreSQL reproductions, not live exploits or a claim that production HTTP endpoints were penetrated. No production data or service was contacted. Test failures stay visible and block acceptance; proposed changes below are NOT implemented in this validation packet.

## DB-F01 — nullable-channel external replay creates duplicate stock effects

Reproduction: D18_null_channel_external_replay creates a synthetic stocked two-component bundle. Two independent authenticated PostgreSQL sessions synchronize at a barrier and call native place_order with the same external_ref, null _channel_id and the same warehouse/product. Both transactions commit; two orders and two reservations persist. The existing orders_channel_ext_uniq index covers (channel_id,external_ref) WHERE external_ref IS NOT NULL; ordinary unique-index NULL semantics do not collide for NULL channel_id. D11 separately shows that a non-null channel protects one durable order via a23505 conflict; that is constraint safety, not an implemented idempotent replay response or request-payload conflict protocol.

Required invariant: one durable command/effect per company+source+external request; whole payload hash mismatch must be a typed conflict; retry after a lost response must return the existing result without reserving again.

Proposed future packet: validate mandatory external source/channel context at the trusted command boundary and implement a durable scoped command inbox/request hash/result binding in the approved single-writer ERPNext facade. If legacy compatibility must accept nullable channels during transition, review an additive PostgreSQL>=15 NULLS NOT DISTINCT unique index scoped by organization_id/channel_id/external_ref (with prior synthetic duplicate analysis), or explicitly reject null channel for external commands. An index alone does not implement request-hash conflict handling or successful replay responses. Do not add a competing writable inventory ledger or rewrite historical migrations. Tests must retain current D18 failure until an approved implementation actually prevents the second effect, then add response-loss/restart/payload-conflict/cross-company key cases.

## DB-F02 — arbitrary SQL sessions can replace trusted request identity

Reproduction: D15_direct_SQL_claim_spoof_boundary connects using a real restricted A-viewer LOGIN role, then SETs the custom request.jwt.claim.sub setting to the synthetic B-admin identity. The compatibility auth.uid() accessor reads that trusted claim and foreign product rows become visible. No SQL superuser/BYPASSRLS privilege is required. This is a demonstrated failure of a strong arbitrary-SQL-client isolation requirement **under the compatibility fixture**. It is not evidence that real PostgREST accepts a forged JWT: no signature-verifying HTTP layer was run. Supabase-style policies assume trusted middleware sets JWT claims; a custom session setting is not database authentication for end users given arbitrary SQL access.

Proposed future packet: never expose authenticated/shared DB connection credentials or arbitrary SQL execution to browser/SAM/untrusted tenants. Verify signed/expired/revoked JWTs at real PostgREST/API entrypoints; derive actor/company from trusted identity; use transaction-local claim initialization and guaranteed pool reset. Test mixed-tenant connection reuse, malformed/forged tokens, direct RPC entrypoints and background execution/revocation. If adversarial direct SQL logins are a requirement, choose an explicit server-side identity model based on authenticated database/session identity or separate company service credentials; do not trust client-writable GUCs as identity. This needs architecture/security review and cannot be "fixed" by weakening RLS or changing test claims to hide the observation.

## Mandatory environment/integration holds

- ENV01: only one actual OS UID is available. The opt-in libc shim permits engine experiments but does not create separate OS/service identities or protect host files. Trusted non-root replay and independent site/service/mount/backup isolation remain blocked.
- INT01: no real PostgREST/JWT or HTTP bypass acceptance; no real queue/worker dispatch integration. The SQL fixture and definer catalog do not prove those paths.
- ERP01: no fresh full ERPNext bootstrap/native Surooh integration, accountant approval or production readiness. Legacy tests do not authorize a second stock/valuation writer.
- OPS01: local restart and same-cluster separate-DB dump/restore are tested. Off-host backup/key custody, power-loss/failover, sized load and recovery SLA remain unexecuted.

Severity depends on the exposed boundary: DB-F01 blocks safe external command acceptance; DB-F02 blocks direct SQL as an untrusted tenant boundary and requires real HTTP auth proof before claiming API isolation. No finding is relabelled PASS merely because the deployment might restrict access elsewhere.

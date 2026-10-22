> Status update from the separately authorized PostgreSQL packet: adapter implemented and21 real DB groups executed at 6066f6a3fbb8f6edd2b6cadb8304b311e2e046bb (19 PASS,2 FAIL). PREPARATION/P01 remain BLOCKED. See [current results](../postgresql-validation/RESULTS.md) and [findings](../postgresql-validation/FINDINGS.md). The original unimplemented-plan text below is preserved as historical scope, not the current adapter status. No production/Codex authorization.

# Separate disposable DB/RLS/concurrency packet — NOT IMPLEMENTED

Status: planned only, no database was provisioned or migrated in source cleanup. scripts/wms/db-check.mjs must continue to exit2 and report the missing real adapter. Source-quality readiness does not close PREPARATION/P01 DB requirements.

## Bounded objective and authority

Exercise the retained legacy Supabase/PostgreSQL compatibility surface in an ephemeral synthetic database, not a second production stock/financial engine. ERPNext remains the proposed sole writer for native quantity/reservations/valuation/COGS/GL. No new valuation algorithm or migration of live stock is included. Pin PostgreSQL and a compatible local auth.uid()/auth.jwt() fixture; disclose any Supabase behavior not exercised. Auth/PostgREST HTTP parity is a separate integration layer, not proved by SET ROLE alone.

## Ordered implementation and dependencies

1. Obtain explicit authorization for the DB packet and available local sandbox tooling; no paid services. Require loopback-only disposable DSN, explicit isolation flag/test-name allowlist and fail-closed guards against non-test hosts/names. Record PostgreSQL/client/schema versions and migration hashes.
2. Bootstrap a fresh empty disposable database. Apply retained migrations in order without rewriting history. Where Supabase extensions/auth/storage schemas are required, supply a pinned compatibility setup and fail visibly if unavailable; never silently skip a migration. Ensure rollback/cleanup in finally and retain sanitized error evidence.
3. Seed fake companies A/B, admin/warehouse/viewer/non-member identities and orders/products/bundles/channels. Use separate real least-privilege DB roles/connections; only bootstrap uses elevated rights. RLS tests must execute as non-owner/no BYPASSRLS. Verify current_user/rolbypassrls/row_security and auth claims per connection; do not trust a user-supplied organization_id alone.
4. Execute allow/deny SELECT/INSERT/UPDATE/DELETE and RPC cases for A vs B, missing identity, viewer/warehouse/admin and membership/role revocation between enqueue and execution. Cover is_org_member/has_org_role, SECURITY DEFINER search_path and direct table/RPC bypass. channel_credentials must remain inaccessible to browser roles. Use transaction rollback and full-table invariant checks to prove denied attempts had no effects.
5. Use independent concurrent connections and explicit barriers for external request replay/conflict, whole-bundle reservation shortage/race, cancel/dispatch races and rollback after injected failure. Assert one durable effect per command, no partial bundle and no negative/over-reserved quantities. Report the exact retained legacy behavior honestly; do not implement competing financial/stock authority to make tests pass. Native ERPNext equivalents remain required in their own integration packet.
6. Add restart/reconnect and cleanup verification; document which crash/failover semantics the harness can actually prove. Capture argv/cwd, SHA/migrations, actual role/session identities (synthetic), assertions, exits, logs and artifact SHA256 using verification/run.py. Zero tests, elevated-role acceptance, skipped migrations, unmet dependencies or missing connections must fail/block.
7. Review evidence and real HTTP/PostgREST parity gaps separately before any P01 acceptance. WMS UI/native integration, RQ/background permissions, separate service/OS identities, fiscal review and all G1–G6 gates remain unchanged.

## Acceptance and rollback

Real disposable migrations succeed; each role/company allow/deny matrix executes; multi-connection races run deterministically with meaningful failure injection and invariant checks; no production endpoint contacted; cleanup succeeds; independent gate rejects missing/altered/stale evidence. Test adapter and tests belong on a new Draft PR, with no main merge or Codex start implied. Rollback destroys only the named synthetic database/files and closes/reverts the proposal branch. If no safe PostgreSQL runtime exists, record BLOCKED rather than static-SQL or mocked PASS.

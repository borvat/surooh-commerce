> Current direction: owner approved shared ERPNext16 accounting/stock/valuation for preparation only. [Shared authority](shared-core/AUTHORITY.md) and [phase alignment](shared-core/PHASE_ALIGNMENT.md) supersede any historical Supabase/Tryton writable-ledger instructions below. Current source/production remains unchanged. Codex, merge, deploy and real migration remain held.

# Company isolation, permissions and audit

Use an explicit active company and warehouse/account scope validated on the server for every command and query. Current `current_org_id()` picks the first organization and is insufficient for deliberate multi-company operation. RLS membership may expose multiple memberships; UI filters and cache keys must still select one company. A user belonging to two companies cannot mix item A with warehouse B.

| Role                          | Permitted work                                        | Exclusions                                                                  |
| ----------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| viewer                        | Selected-company operational reads                    | No mutation, secrets or unnecessary personal data                           |
| warehouse                     | Scoped receipt, scan, pick, pack and approved handoff | No membership, BOM identity merge or unrestricted adjustment                |
| inventory controller (target) | Count, variance review and bounded adjustment         | Cannot rewrite ledger or reassign legal ownership                           |
| company admin                 | Catalog/BOM/membership administration within company  | No cross-company bypass, silent ledger edit or unapproved marketplace write |
| accountant (target)           | Cost/event exports and reconciliation                 | No physical balance overwrite                                               |
| integration/SAM identity      | Explicit capability+company+account+expiry            | No shared unrestricted service key or arbitrary query tool                  |

Existing enum admin/warehouse/viewer is preserved; adding roles is a later reviewed migration. Database tests must use anonymous, viewer, operator, admin, dual-member and worker sessions rather than only superuser/service-role.

RLS applies to base/child tables and invoker views. Enforce same-owner FKs/validation independently of browser checks. Audit every SECURITY DEFINER RPC for restricted EXECUTE, fixed search_path, membership and inputs; internal `_apply_stock` must not be directly callable by browser roles. Verify UPDATE/DELETE/TRUNCATE denial and trigger behavior with operational roles. A DB owner can alter protections: append-only triggers are not cryptographic tamper proofing. Independent audit retention and reviewed admin changes remain needed.

Secrets stay server-side; .env, tokens, customer exports, addresses and label files do not belong in this public repository or CI artifacts. Synthetic database fixtures must contain fictional users/items only. Live read-only test evidence contains aggregate counts/IDs redacted as necessary, never complete orders or labels. Official label downloads require verified shipment ownership and short-lived access.

No workflow in this foundation deploys, merges PRs, modifies branch protection, stores provider secrets or starts Codex. Repository policy needs real GitHub rulesets/required checks to resist accidental human bypass; templates and scripts alone cannot enforce it. The protection API returned403 to this connection, so protection state is UNKNOWN, not verified absent or enabled.

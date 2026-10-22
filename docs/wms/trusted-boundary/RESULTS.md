# Verified results — bounded candidate review

Tested published source: `6b637b698be0990a1b6dfe373ce071295fc51ee5`; parent fix source `cbd61cc720579b3375fd41a77b4a2ae6f6dbe60f`; base PR19 `63fe90d530a0946f58d9efcd2ad3b14f1e2ff489`. The later evidence commit contains documentation/archives only and is not advertised as an independently executed source SHA.

UTC run: 2026-10-22T00:47:14.988828+00:00 → 2026-10-22T00:47:36.777015+00:00. Full independent runner actual exit **2** = blocked future requirements; **17 PASS / 0 FAIL / 19 BLOCKED**. PostgreSQL driver exit0: **21/21 original groups +18/18 trusted HTTP/SQL regressions PASS**. WMS **100/100 PASS**, TypeScript0, lint0 with15 existing warnings (14 Fast Refresh,1 Hooks), build0, generated-cleanliness0; source before/after exact and tracked-clean.

Evidence: [RUN_REPORT.json](RUN_REPORT.json), [DATABASE_RESULTS.json](DATABASE_RESULTS.json), [archive checksums](evidence/INDEX.json), [finding closure/limits](FINDINGS.md), [protocol and identity model](DESIGN.md), [reproduction](REPRODUCE.md). Archives contain exact argv/cwd, tool versions, exits, sanitized logs, artifact hashes, build manifest and gate invocations. Full clean-run command is `runner-invocation.json` inside each exact archive.

## Executed checks

| Check | Exit | Result | Executed cases |
|---|---:|---|---:|
| foundation | 0 | PASS | — |
| shared_integrity | 0 | PASS | — |
| stage_gate_regressions | 0 | PASS | 19 |
| authority_holds | 0 | PASS | 6 |
| dependency_install | 0 | PASS | — |
| unit_tests | 0 | PASS | 100 |
| typecheck | 0 | PASS | — |
| lint | 0 | PASS | — |
| build | 0 | PASS | — |
| generated_cleanliness | 0 | PASS | — |
| source_quality_regressions | 0 | PASS | 9 |
| legacy_db_adapter | 0 | PASS | 21 |
| alternative_gate_regressions | 0 | PASS | 14 |
| accounting_native_link | 0 | PASS | — |
| postgres_adapter_guard_regressions | 0 | PASS | 6 |
| legacy_http_auth_boundary | 0 | PASS | 18 |
| trusted_boundary_guard_regressions | 0 | PASS | 6 |

The HTTP evidence checker recounts the18 native trusted cases; it is not18 additional executions. Source-quality9 regressions are a subset of WMS100. Accounting native-link revalidates/copies already accepted Accounting evidence at `a9400f6f4b9066f5487f16cd45268728920e5672`; it does not rerun Accounting or prove WMS/ERP integration.

## Native groups

| ID | Result |
|---|---|
| D01_all_original_migrations | PASS |
| D02_real_restricted_login_roles | PASS |
| D03_company_user_select_isolation | PASS |
| D04_direct_CRUD_matrix | PASS |
| D05_definer_RPC_and_helper_bypass_denial | PASS |
| D06_browser_roles_cannot_read_credentials | PASS |
| D07_shared_bundle_concurrent_shortage | PASS |
| D08_whole_bundle_atomic_rollback | PASS |
| D09_cancel_ship_race_and_replay | PASS |
| D10_terminated_transaction_rollback_and_retry | PASS |
| D11_external_idempotency_required | PASS |
| D12_execution_time_membership_revocation | PASS |
| D13_view_and_report_isolation | PASS |
| D14_temp_schema_shadow_resistance | PASS |
| D15_direct_SQL_claim_spoof_boundary | PASS |
| D16_restart_durability_reconnect | PASS |
| D17_all_public_table_read_surfaces | PASS |
| D18_null_channel_external_replay | PASS |
| D19_separate_ship_and_cancel_lifecycles | PASS |
| D20_real_dump_restore_and_RLS_recheck | PASS |
| D21_anonymous_role_denials | PASS |
| H01_signed_JWT_company_RLS | PASS |
| H02_invalid_expired_forged_and_wrong_algorithm_JWT | PASS |
| H03_revoked_JWT_persistent_rejection | PASS |
| H04_subject_company_and_header_spoof_denials | PASS |
| H05_role_claim_escalation_and_non_member_denial | PASS |
| H06_trusted_source_and_null_channel_policy | PASS |
| H07_two_PostgreSQL_connections_exactly_one_effect | PASS |
| H08_lost_HTTP_response_returns_durable_result | PASS |
| H09_killed_HTTP_process_and_replay | PASS |
| H10_payload_hash_conflict_no_write | PASS |
| H11_company_source_request_key_scope | PASS |
| H12_single_connection_pool_no_identity_bleed | PASS |
| H13_DB_membership_rechecked_on_replay | PASS |
| H14_untrusted_raw_RPC_and_SQL_routes_denied | PASS |
| H15_direct_SQL_identity_cannot_be_replaced_by_claims | PASS |
| H16_source_grant_revocation | PASS |
| H17_concurrent_HTTP_requests_two_native_connections | PASS |
| H18_multi_company_JWT_only_subject_scope | PASS |

## Gate disposition

| Gate/scope | Status | Remaining requirement |
|---|---|---|
| G0 hosted CI | BLOCKED; HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED | Existing billing failure retained; no rerun or billing change |
| G0 bounded alternative path / TRUSTED_BOUNDARY | READY_FOR_HUMAN_EVIDENCE_REVIEW | Exact-SHA evidence review only; not automatic acceptance |
| SOURCE_QUALITY | READY_FOR_HUMAN_EVIDENCE_REVIEW | Existing lint warnings disclosed, no phase approval |
| PREPARATION | **BLOCKED** | Real OS/service identity isolation and deployed WMS identity integration |
| P01 | **BLOCKED / DO NOT START** | PREPARATION blockers plus fresh pinned ERPNext bootstrap and separate owner authorization |
| P02–P09; G1–G6 | HELD / existing requirements unchanged | Native UI/worker/cross-system integration, security/operations, fiscal review and governance |

Machine-readable gates: [PREPARATION](GATE_PREPARATION.json), [P01](GATE_P01.json), [trusted boundary](GATE_TRUSTED_BOUNDARY.json), [source quality](GATE_SOURCE_QUALITY.json). All phase_complete, codex_start_authorized, merge_authorized and deploy_authorized remain false.

## Environment and history

PostgreSQL18.6 vendor bytes/wheel hashes pinned; psycopg3.3.6, PyJWT2.15.1; Bun1.3.13, Node24.19.0, Python3.12. SQL roles are native non-superuser/non-BYPASSRLS connections. A disclosed opt-in UID compatibility shim is necessary for PostgreSQL in this UID0-only executor; it does not supply real OS identity/file isolation. [Capability commands and errors](HOST_CAPABILITIES.json) remain BLOCKED.

All23 original migration file hashes match the PR19 base; candidate SQL is separate. Driver stopped PostgreSQL/HTTP and removed private cluster/config/dump/key files. Only allowlisted reports/logs/manifests are archived; no credentials, signed JWTs or DB backups exported.

Development01:21+16 PASS, dirty source. Development02:21 PASS then harness initialization failure (self-referencing pool configuration), exit1. Development03:21+18 PASS, dirty source. These are retained as development-only, not acceptance. First clean exact run (`cbd61cc…`) executed native groups successfully but failed the evidence-check path substitution, exit1; archive retained. Final clean exact run (`6b637b6…`) executes all available checks, exit2 for blocked requirements. Historical PR19 failures and earlier archives are untouched.

## Next review / rollback

Review the candidate command/identity design and exact artifacts, then arrange an actual non-root isolation environment and a separately authorized deployed-WMS/ERPNext adapter slice. Confirm external-reference UI mapping, issuer/key custody, direct-endpoint ACLs, workers and trusted SQL role provisioning before integration. Do not copy fixture auth accessors or service credentials into production. Rollback is destroy only the disposable lab/rebuild the prior fixture and abandon/revert the review branch. Nothing was applied to production; no real migration, financial action, Actions rerun, merge or Codex launch occurred.


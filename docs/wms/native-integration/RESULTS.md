> Follow-up candidate after owner review: [Atomic Pick results](../atomic-pick/RESULTS.md), paired PR22/PR31. NI-F01 now has bounded native evidence; full browser and operational isolation remain BLOCKED. Historical run below is preserved.

# Final native integration results — preparation remains blocked

Paired Draft PRs: [WMS21](https://github.com/borvat/surooh-commerce/pull/21) / [Accounting30](https://github.com/borvat/surooh-accounting/pull/30). Exact tested source pair: **WMS9827f7252d74849bba5dc5f130a4fc6d6e6d5d2c / Accountingf031a73e8ade3ed89c7eeda057566296a5fdc198**. Both were clean and already published when executed. Later commits contain documentation/evidence only, not a claimed newly tested application revision.

Native UTC run: 2026-10-22T01:21:17.444233+00:00 → 2026-10-22T01:23:41.830376+00:00. **19 PASS /0 FAIL /1 BLOCKED**, actual outer exit2 (`PARTIAL_NATIVE_EXECUTED`). Two new sites/DBs installed via native ERPNext/Frappe16.52.0 installer; no seeded restore/core patches. All4141 Frappe and5518 ERPNext archive files compared byte-for-byte. Native runtime Python3.14.8, MariaDB11.8.9, PyJWT2.13.0, RQ2.6.1, Redis Python7.1.1, PyMySQL1.1.2, Werkzeug3.1.6. The pinned legacy PG regression uses its own PyJWT2.15.1 runtime; do not conflate the environments.

Evidence: [native cases](NATIVE_RESULTS.json), [fresh bootstrap/runtime/commands](BOOTSTRAP_RESULTS.json), [WMS regression](REGRESSION_RESULTS.json), [archive SHA256 index](evidence/INDEX.json), [host capability failure](HOST_CAPABILITIES.json), [external cleanup](CLEANUP.json), [design/limits](DESIGN.md). Full argv, cwd, exit codes, logs and per-file hash manifests are inside each archive.

## Proven functions and limits

| Function | Actual evidence | Limit |
|---|---|---|
| Fresh engine/app | Two new native sites, schemas, DB login passwords and encryption/JWT keys; actual Surooh app + separate guard installed | API-only; upstream frontend assets/full operations/upgrade build not accepted |
| Catalogue/bundles | Native Items and Product Bundle; component expansion into native Sales Order/SRE | Full UI projections and commercial parent pricing/discount/invoice mapping unimplemented |
| Receipt | Real Stock Entry,10 units each at10/20 EUR; stock value300 | HTTP backend tested; current receiving screen not wired |
| Reserve/order | Existing WMS placeOrder → real Frappe HTTP; bundle reserves1/2 components once | Synthetic manual internal source only; no bol/FBB/serial/batch/nested acceptance |
| Pick/pack | Native reserved-order refusal reproduced without releasing reservation | **NI-F01 BLOCKED**; atomic reservation-to-pick handoff not implemented |
| Ship | Existing fulfillOrder → native Delivery Note; quantities9/8, stock value250; native COGS50 with balanced GL | Direct SO→DN path; does not prove pick/pack |
| Return | Native linked return note and replay; quantities10/10, value300; balanced50 reversal | Current return screen not wired; full return inspection/quarantine/partial flows pending |
| Cancel | Existing cancelOrder releases reservations; replay unchanged | Rendered browser lifecycle not proven |
| Idempotency | Native concurrent HTTP, payload conflict, dropped response and killed/restarted WSGI process return same durable order ID | Not power-loss/failover/provider-wide exactly-once proof |
| Identity/RPC | Signed/expired/forged/revoked tokens, fresh role checks, native Stock Manager raw write denied by guard; private-file HTTP denial | Owner/host/key compromise outside proven boundary |
| Background jobs | Real RQ worker: legitimate job finishes; revoked queued job fails with no stock effect | Full worker transport/IC/multi-company worker reuse threat matrix pending |
| In-flight revocation | Independent MariaDB lock wait observed; revocation before permission acquisition denies HTTP effect | Permission-lock linearization; no instantaneous cancellation after accepted command lock |
| Company/site/DB | A/B restricted SQL cross-DB SELECT/DELETE denied; own B HTTP200, A JWT on B rejected; distinct credentials/keys/site paths | Same MariaDB/Redis/HTTP/OS host; real service/mount/storage separation unproven |
| Retained WMS UI | Actual inventory service functions executed by Bun against native HTTP | **Rendered React/browser UI and remaining projections/paths BLOCKED** |

## Every native case

| Case | Status |
|---|---|
| N01_native_company_items_bundle_and_app_setup | PASS |
| N01b_second_native_site_company_and_credentials | PASS |
| N02_HTTP_native_receipt_quantity_and_valuation | PASS |
| N03_existing_WMS_order_service_bundle_reservations_and_replay | PASS |
| N04_native_durable_payload_conflict | PASS |
| N05_full_pick_pack_handoff | BLOCKED |
| N05a_native_pick_handoff_guard | PASS |
| N06_WMS_ship_native_DeliveryNote_COGS_GL | PASS |
| N07_native_return_replay_value_and_GL_reversal | PASS |
| N08_WMS_cancel_and_duplicate_event | PASS |
| N09_native_HTTP_verified_identity_company_and_role | PASS |
| N10_durable_token_revocation_before_replay | PASS |
| N11_raw_RPC_API_and_legacy_writer_denial | PASS |
| N12_fresh_DB_role_revocation_and_claim_escalation | PASS |
| N13_native_HTTP_concurrent_command_replay | PASS |
| N14_real_RQ_job_and_execution_time_revocation | PASS |
| N15_inflight_HTTP_permission_revocation_current_locking_reads | PASS |
| N16_HTTP_private_file_boundary | PASS |
| N17_native_lost_response_process_kill_restart_and_replay | PASS |
| N18_two_fresh_sites_DB_credentials_and_HTTP_identity | PASS |

## Regression and source quality

WMS independent runner **17 PASS /0 FAIL /19 BLOCKED**, actual exit2. Original100 unit cases retained plus6 new guard tests =**106 PASS**; typecheck0, lint0 with15 unchanged disclosed warnings (14 Fast Refresh,1 Hooks), build0 and generated-clean0. Native legacy PostgreSQL **21/21 +18/18 trusted cases PASS**. Its explicit UID shim is legacy SQL-test support only, not native ERP or OS-isolation proof. Source before/after stayed exact and tracked-clean. Accounting exact-source foundation check/unittest, targeted new-code Ruff and wheel/sdist build all exit0. Existing linked Accounting native evidence is identified as reused, not newly executed.

## Gates

| Gate | Disposition |
|---|---|
| G0 hosted | BLOCKED; retained billing failure, no rerun |
| G0 alternative | Executed; scoped evidence ready for human review only |
| NI0/NI1/NI2/NI4 | Bounded native evidence available at exact source pair; not whole production acceptance |
| NI3 | BLOCKED: full rendered UI/read projections, native pick/pack handoff and full commercial mapping |
| NI5 / G1 operational | BLOCKED: UID0-only executor, non-root user namespace attempt denied |
| NI6 source regressions | Executed PASS at exact WMS source; warnings retained |
| PREPARATION | **BLOCKED**: full native UI/workflow/operational isolation and existing governance/acceptance conditions |
| P01 / P01–P09 / Codex | **BLOCKED / DO NOT START**, no owner start authorization |

Machine gates: [PREPARATION](GATE_PREPARATION.json), [P01](GATE_P01.json). The machine plan remains conservative about full bootstrap/deployed integration; fresh API-only sites do not satisfy the whole requirement. Tests recommend human review only.

## Failures, cleanup and security scope

Development history retains: initial new-site invocation flag error; a wrong group fixture; insufficient free-space refusal (guard unchanged); missing guard-app module directory; installed-app assertion mismatch; unencoded resource URL; wrong test header for site B; and a standalone unit invocation missing Bun in PATH. These are unclean development evidence, not accepted results, and were corrected before the separately published final source pair. The final exact run has no failing native case. The blocked native Pick List scenario is a real integration gap, not relabelled PASS.

External checks observed residual driver-owned synthetic directories despite driver self-reported cleanup; records are retained. Those exact owned roots were explicitly removed. Final cleanup checks confirm no owned runtime roots and all local DB/Redis/HTTP/PG ports released. Do not use a driver flag alone as proof of operational cleanup. Private configs, keys, passwords, JWTs and DB dumps were not exported. Archives contain only allowlisted reports/logs/build artifacts, scanned for JWT-like tokens and checked against manifests.

The production auth/provider, TLS/JWKS rotation, deployed network/role controls, complete native SQL pool reuse, storage/off-host backups/key custody, shared-component pick races, browser acceptance, commercial bundle/invoice mapping, real integrations/cutover, accountant policy and governance remain separate requirements. Legacy PG pool tests do not prove native pool behavior; Frappe uses per-request connections in this probe.

## Before any first development phase

Review these exact paired PRs and evidence; authorize a separate bounded packet for native UI projections/rendered acceptance and atomic reservation-to-pick handoff, then repeat relevant races/recovery/reconciliation. Obtain a free environment with actual non-root independent service/mount/key boundaries and execute the denied-read/write threat matrix there. Complete fresh full runtime/assets/upgrade/restore and existing owner/accountant/integration/governance gates. No P01/M1 or Codex start follows automatically from this report. No merge/deploy/production/live data/payment/tax/billing/Actions action occurred.


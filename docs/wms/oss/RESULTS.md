# Native runtime results

Observed 2026-10-21 UTC. Two real upstream products were installed separately in Python virtual environments and initialized with native schemas against disposable SQLite databases. Native ORM/model functions and, for InvenTree, its in-process REST test client were exercised. These are functioning headless prototypes; no hosted UI/browser demonstration or production connection is claimed. Python 3.12.14. No Surooh production configuration was imported. Source/package pins and dependency inventories are attached.

## Recorded successful runs

| Run / evidence log | Executed result | Meaning and limitation |
|---|---|---|
| `tryton-upstream-scenarios.log` | 27 passed, 357.470 seconds | Native stock doctest scenarios include receiving, dispatch/returns, inventory, internal transfers and transit. Stock reporting has parameterized cases. Some optional status-dumper threads report denied AF_UNIX sockets; suite completed OK. These diagnostics are preserved. |
| `tryton-critical-unit.log` | 4 passed, 22.342 seconds | Native assignment stock bounds/partial assignment, quantity-by-location assignment, company rule mixin and user company context. Not a restricted-user security audit. |
| `tryton-surooh-probe.log` | 2 passed, 12.515 seconds | Native ORM: receive 10; reserve 6; second 6 only partially assigns remaining 4; total assigned 10; cancel assignments; reserve/ship 10; further 1 cannot assign. Company A quantity 7, company B 0. Component quantities are explicit in this probe, not native sale-kit explosion. |
| `tryton-native-kit.log` | 1 passed, 27.159 seconds | Upstream product_kit sale scenario exercises real kit component lines, shipment, partial/backorder/cancel and invoice integration. Uses native force assignment in the scenario; cannot be counted as no-oversell proof. |
| `tryton-shared-native-kit-final.log` | 1 passed, 12.956 seconds | Our probe creates two native kits requiring 4 and 6 units of one component with physical quantity 10. Native quantities are 2 and 1; jointly selling those offer quantities would consume 14, demonstrating why independent kit ATP must not be summed. Atomic two-kit sales remain pending. |
| `inventree-upstream-sales.log` | 8 passed, 0.720 test seconds after schema migration | Native oversubscription validation, allocation, order completion/stale allocation, cancellation/stale no-op, split stock and customer return. Migration time is additional. |
| `inventree-surooh-probe-final.log` | 3 passed, **1 skipped**, 1.419 test seconds after migration | Actual part API is shared-instance catalog, child stock cannot directly allocate to parent kit line, repeated shipment task no double-shipping. PostgreSQL locking test explicitly skips SQLite. |

Totals for these disjoint successful runs: **Tryton 35 passed; InvenTree 11 passed and 1 skipped**. Three passed probes are architecture discovery assertions, not proof of meeting the corresponding Surooh requirement: InvenTree shared catalog/kit rejection and Tryton independent kit quantities expose adaptation needs. Do not interpret aggregate count as 46 complete Surooh acceptance scenarios.

## Harness corrections and diagnostics

Initial InvenTree custom probe expected DRF ValidationError only; native save raised Django ValidationError with the expected part-mismatch rejection. The assertion now handles both; the initial error log is preserved as `inventree-surooh-probe.log`, and final rerun passed. Initial native Tryton kit fixture omitted required parent_template; final fixture supplies it and passes; initial log retained as `tryton-shared-native-kit.log`. These are harness corrections, not hidden product bugs. Earlier bootstrap attempts required InvenTree test dependency django-slowtests and backup_dir config; the final inventories/config runner reflect them. Optional Tryton status thread socket errors remain visible and do not invalidate the completed domain tests, but production observability was not certified.

## Blocked or not executed

- Docker/Podman were unavailable and native PostgreSQL setup could not be completed in this execution environment. SQLite does not validate row-level locks, cross-session races or production throughput. InvenTree concurrency **skipped**, not passed. Tryton native PostgreSQL concurrency not executed.
- Company quantity context passed; limited-role multi-company API/read/export/worker isolation not executed. No final tenant-security proof for either product or current Surooh.
- Explicit return quarantine and inspection-to-sellable policy not demonstrated. Native return scenarios are insufficient for this acceptance criterion.
- Full two-native-kit concurrent order integration, provider inbox replay, exactly-once Accounting export and SAM authorization not executed. Native shipment-task idempotency is narrower than provider event deduplication.
- Odoo, ERPNext and OpenBoxes implementation/tests inspected, not runtime-tested. No fabricated failure or pass is assigned.
- Existing application production schema/runtime mapping and real inventory character remain unverified. No stock/prices/production records were changed.

Reproduce using [research instructions](../../../research/wms-oss/README.md). Logs are sanitized only for local workspace prefix and ANSI escapes. [Evidence manifest](evidence/SHA256SUMS.json) binds logs, inventories and probes. Acceptance gates remain blocked regardless of successful process exit codes.

## Additional evidence review

See [DECISION_CLOSURE.md](DECISION_CLOSURE.md): six additional native SQLite security/worker tests passed, including a discovery assertion that trusted worker contexts can cross company boundaries without access checks. No new PostgreSQL or ERPNext DB acceptance was executed. Do not treat runtime import/provisioning as an acceptance pass.

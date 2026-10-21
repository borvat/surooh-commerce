# Independent WMS foundation comparison

Assessment snapshot: 2026-10-21 UTC. Primary source pins: [source-pins.json](source-pins.json). This is source inspection plus bounded executable experiments, not a production certification or a completed penetration test. Release freshness is a snapshot, not a support guarantee.

## Requirements and evidence standard

Hard requirements: company-scoped stock ownership; one physical component pool across EANs; reservations that cannot oversell; reversible cancellations; auditable movements; receiving, dispatch, inspected returns and conserved transfers; replay-safe channel events. Marketplace, Accounting and SAM remain separate systems. Neither an ERP accounting module nor a supplier/customer table proves these integration or tenant requirements.

Evidence labels: **executed** = native product runtime and synthetic database assertion; **source** = implementation and tests inspected but not executed here; **gap** = missing Surooh behavior or incompatible architecture; **blocked** = not demonstrated. No popularity score or feature marketing is used as correctness evidence.

## Current system and reuse baseline

Keep the feature branch as the application audit baseline (`d3fce83c8b376822d04d8efcd675f1bebf7bef65`); engineering foundation `c75d4f8aafc8ab7f948156fb9906097b3d001ca9` adds preparation only. Neither branch is merged to main. [BASELINE](../BASELINE.md) retains the Lovable/Replit comparison and audit ZIP provenance. Lovable publication metadata is not proof of its deployed database schema; Replit uncommitted changes and actual runtime mapping still need preservation/verification.

Current reusable assets: React/TanStack Arabic UI, product identity/EAN reconciliation, bol read-only adapter and guards, product master/family rules, warehouse command contracts and pure helper tests. Supabase migrations contain real component-level reservations, locks, organization rules and movement audit safeguards: these are substantive existing code, not a blank project. However their production execution, limited-role isolation and concurrency have not been independently demonstrated. Warehouse screens/contracts are ahead of persisted pick/pack/ship functionality. Available stock across warehouses can differ from the warehouse selected for reservation; return inspection is incomplete. Existing typecheck/lint debt is recorded, not waived. See [inventory rules](../INVENTORY_RULES.md), [operations](../OPERATIONS.md), [testing](../TESTING.md).

The schema includes synthetic seed examples; that does not establish whether current live balances are real. No customer data or production balances were read in this evaluation. The current repository has no root license declaration in this snapshot: ownership/relicensing of Surooh code must be established before distributing it with a copyleft backend.

## Actual functions and architecture

| Candidate | Implemented evidence inspected | Surooh gaps and consequences |
|---|---|---|
| Current Surooh | `src/lib/inventory.ts`, `unified-stock.ts`, SQL reservation/movement functions, organization RLS and channel outbox; feature warehouse tests/contracts | Full persisted WMS cycle incomplete; explicit company context, warehouse ATP alignment, quarantine returns and real DB tests needed. Highest reuse, substantial remaining WMS implementation. |
| ERPNext | `stock/doctype/stock_reservation_entry` locking and reservation tests; `selling/doctype/product_bundle` virtual parent and component lines; pick lists, receipts, delivery, transfers, serial/batch and ledger modules | Strong broad ERP/WMS baseline. Nested product bundles rejected in inspected implementation. Company/report permissions need adversarial tests. Frappe and its accounting document dependencies increase scope alongside Surooh Accounting; cannot assume all accounting can simply be disabled. Runtime not executed. |
| Odoo Community | `addons/stock`, `mrp`, `sale_stock`, `purchase_stock`; native phantom/kit BOM and move allocation; multicompany kit, quant visibility and warehouse-route tests | Strong broad operational baseline. Core rules allow some shared locations/quants/lots where company is false; not database RLS. Strict legal-company catalog/location policy must be configured and tested. Community scope only; Enterprise barcode/quality or third-party addons are not credited without inspection. Runtime not executed. |
| Tryton | Installed native stock/company/sale/product_kit 8.2 modules; actual movement assignment and shipment workflows, company-scoped quantities, kit component expansion and computed kit stock | Small modular stock core, suitable service boundary beside three other systems. Native partial assignment and force-assignment paths differ from Surooh all-or-nothing/no-negative policy; authorization and command adapter required. Native kit quantity is not an atomic cross-channel quota. No native bol/BORVAT/SAM integration was demonstrated. |
| InvenTree | Django Part/BOM/build, stock locations/tracking, sales allocations, purchase and return orders; DRF APIs and stock locking/concurrent allocation regression test | Best permissive parts/BOM candidate in this shortlist, but company means business partner, not tenant owner. Native parent sales allocation rejects child stock rather than reserving a virtual kit's components. Per-company deployments or significant tenant redesign plus shared-kit adapter needed. |
| OpenBoxes | `InventoryService`, `StockMovementService`, transfer/shipment domains and integration tests, JS StockMovement/StockTransfer API clients | Warehouse/logistics depth, inventory transactions and lot-oriented operations. Inspected sources do not establish shared-instance legal-company isolation or Surooh virtual EAN/BOM reservation semantics. Those remain unproven, not declared absent. Runtime not executed. |

## Maintenance, stable releases and security

| Candidate | Observed stable line / activity | Security evidence and unresolved work |
|---|---|---|
| ERPNext | v16.52.0 released 2026-10-21; active develop/version-16 | Root SECURITY policy; current release includes company/report/user-permission fixes. No full Frappe + ERPNext dependency/advisory audit or runtime scan performed. Patch freshness does not establish safety. |
| Odoo | 20.0 major, official support page says September 2026; pinned rolling commit 2026-10-21; no GitHub release object | Root SECURITY table still lists 19/18/17/16 while official version page lists 20.0. Treat policy inconsistency as unresolved; Enterprise support dates do not promise Community SLA. Audit upstream security fixes/backports and exact addons before selection. |
| Tryton | 8.2 published in official download index in October 2026; installed core/stock patch 8.2.1; GitHub mirror active October 20 | Patch levels vary per module. Require upstream advisory review, SBOM, dependency scan and support-lifetime selection; no zero-CVE claim. A newer series is not automatically preferable to an LTS for production. |
| InvenTree | 1.6.1 released 2026-10-21; repository active | Release explicitly labels Python-container security patch and CA/dependency changes; SECURITY policy/advisory channel exists. Container fix not validated by our Python-only runtime. Runtime security scan and production PostgreSQL race test remain open. |
| OpenBoxes | v0.9.8-hotfix1 released 2026-08-14; develop active October 21 | Inspected build targets older Java/Grails ecosystem and configures OWASP dependency checking. It was not run. Root SECURITY file not found in inspected checkout; this is not proof of no disclosure process or no security fixes. Require supported JDK/framework and full dependency inventory review. |
| Current | Feature and foundation branches, no established stable WMS release | Write guards and org rules in source; baseline type/lint failures, DB isolation and deployed migrations unverified. No dependency/advisory all-clear. |

## Database, API, isolation and scaling

| Candidate | Persistence and API facts | Upgrade/scaling implications |
|---|---|---|
| Current | Supabase PostgreSQL migrations, RLS, RPCs and server-side bol adapter | Lowest language/hosting change. Real schema rebuild, grants and RLS tests are prerequisites. PostgreSQL row contention and queue throughput need measured load tests. |
| ERPNext | Frappe DocTypes/REST, schema patches, stock ledger and reservation row locks; MariaDB-oriented deployment baseline | Use supported Frappe/ERPNext version pair and migration rehearsals. No claim of drop-in PostgreSQL compatibility. Company restrictions are application permissions; separate sites strengthen isolation with operational cost. |
| Odoo | PostgreSQL, ORM models/RPC/controllers, company record rules | Pin server and addon commits together; external API compatibility/version/auth need contract tests. Module migrations and scheduled workers add upgrade cost. API availability on self-hosted Community differs from commercial hosting plans. |
| Tryton | Native transactional ORM; SQLite and PostgreSQL backends; model/RPC interfaces, Proteus internal API client | SQLite experiments validate domain behavior only. PostgreSQL required for production concurrency assessment. Versioned Surooh facade avoids exposing arbitrary model calls; company context must be server-derived, never trusted from caller. |
| InvenTree | Django migrations; REST serializers; SQLite used here, PostgreSQL production validation required | Select-for-update concurrency test explicitly skips SQLite. Multiple company deployments cost one DB/config/backup boundary each. Horizontal workers require shared DB/object storage and queue configuration. |
| OpenBoxes | Grails/GORM and relational migration history; stock movement REST services; MySQL-oriented deployment | JVM/service operations and migration rehearsal required. No benchmark or proven tenant sharding. Stable endpoints must be contract-pinned rather than assuming all internal service methods public. |

No candidate has been load-certified here. Company rules, superuser contexts and report/export access need separate limited-user tests. Admin test fixtures are not tenant-security proof.

## Integration and reuse with Marketplace, Accounting and SAM

Preserve [existing contracts](../INTEGRATIONS.md): external IDs are scoped by company+channel account; inbox unique keys and payload hashes deduplicate provider events; stock commands reserve physical components, never offer balances; committed stock events reach Accounting by a durable outbox. Accounting owns financial postings, the WMS owns physical quantities. SAM gets delegated read-only summaries or explicit scoped commands, never stock/credential table access. Stock publication remains disabled.

For any replacement use an anti-corruption service with `tenant_id`, `warehouse_id`, `command_id`, `order_id`, versioned BOM snapshot and correlation IDs. Persist mapping `Surooh UUID <-> upstream company/product/location/move`; do not make two ledgers independently writable. No dual reservations or automatic double accounting. Existing bol client stays TypeScript and read-only; adapt its normalized orders, not its stock-write stubs.

| Candidate | Existing Surooh code reuse | Extra integration/ownership cost |
|---|---|---|
| Current | UI, identity, channel contracts and SQL remain | Complete missing operations and secure all org flows; fewest adapters |
| Tryton | UI/bol/identity/contract tests reusable behind facade; SQL ledger logic becomes comparison oracle, not a second live ledger | Python adapter/service, auth mapping, durable inbox/outbox and kit/quota invariants; retain Accounting system boundary |
| InvenTree | Same UI/bol reuse; MIT allows reviewed component reuse with notices | Virtual-kit adapter plus per-company instances; aggregation/router and upgrade fan-out |
| ERPNext/Odoo | UI/bol can survive as separate clients; SQL functions cannot be transplanted into upstream ORM | More ERP document mapping and accounting overlap; license review of linked addons/code distribution |
| OpenBoxes | UI/channel client reusable over stock movement API | Groovy/JVM expertise, order/BOM semantics and company mapping |

## Selection method and limits

Tryton is the preferred **modular WMS core** from source fit; InvenTree is the strongest contrasting **MIT parts/BOM** approach to test whether permissive reuse reduces Surooh work. These two were installed as actual runtimes and are the two prototype finalists. ERPNext and Odoo are stronger broad ERP suites and remain credible challengers. Their runtime experiments were blocked by unavailable container/native database facilities; that environment constraint is not a product defect and prevents declaring an empirically proven global winner. OpenBoxes has weaker demonstrated fit for this project's company/virtual-kit requirements.

Do not use weighted aggregate scores to hide failed hard requirements. See [results](RESULTS.md), [cost model](TCO.md), [proposed ADR](ADR-0001.md) and [decision-dependent stages](EXECUTION_PLAN.md). Recommendation remains conditional until native database, security and full end-to-end gates close.

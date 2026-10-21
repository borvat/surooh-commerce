> Current direction: owner approved shared ERPNext16 accounting/stock/valuation for preparation only. [Shared authority](shared-core/AUTHORITY.md) and [phase alignment](shared-core/PHASE_ALIGNMENT.md) supersede any historical Supabase/Tryton writable-ledger instructions below. Current source/production remains unchanged. Codex, merge, deploy and real migration remain held.

# Functional architecture and repository map

## Existing structure to preserve

| Path                                         | Current responsibility                                             | Evolution boundary                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/routes/_authenticated/`                 | Product, component, order, mapping, movement and diagnostics pages | UI calls application services; never writes ledger/balance directly                 |
| `src/components/app/`                        | Catalog, BOM explanation, internal warehouse print previews        | Printing has no shipping or stock side effect                                       |
| `src/lib/inventory.ts`                       | Supabase queries and inventory RPC facade                          | Keep public callers compatible while introducing explicit organization/site context |
| `src/lib/warehouse-*.ts`                     | Pure audit, batch and command validation                           | Validation does not authenticate or persist events                                  |
| `src/lib/bol.functions.ts` / `bol.server.ts` | Server integration and credential encryption                       | Read-only provider gateway; never expose secrets to browser                         |
| `src/lib/channels/adapter.ts`                | Channel abstraction                                                | Versioned, account-scoped connectors, no arbitrary tool passthrough                 |
| `src/lib/unified-stock.ts` / product helpers | Canonical product and offer observations                           | One physical pool, many confirmed offers; quantities are not added                  |
| `src/integrations/supabase/`                 | Generated clients/types and auth plumbing                          | Type generation only from disposable reviewed schema; no production credentials     |
| `supabase/migrations/`                       | Ordered schema, roles, views and transactional inventory engine    | Add forward migrations; do not edit applied history                                 |
| `tests/*.test.ts`                            | Existing Bun pure/helper/UI/static-SQL tests                       | Retained in place; not evidence of database execution                               |
| `docs/wms/` / `scripts/wms/`                 | Architecture, phase control, readiness checks                      | Engineering-only; no Codex launch or business operation                             |

No folder shuffle is necessary now. Future new domain services may live in `src/lib/wms/{receiving,reservations,warehouse,returns,transfers}` and server-only connector modules under `src/lib/channels/`; each phase must justify a new file rather than prebuild empty abstractions. `tests/db/` will hold integration tests with actual limited-role DB sessions; `tests/live/` is reserved for separately authorized read-only smoke tests. They are not supplied as fake green placeholders.

## Domain boundaries

Catalog owns SKU/variant/identifier identity and confirmed mappings. Inventory owns physical balances, reservations, ledger and reconciliation. Warehouse operations own receiving, location tasks, picking, packing, handoff and inspection evidence. Sales connectors normalize orders and fulfillment observations; they cannot overwrite physical stock. Accounting owns monetary valuation and journal processing; inventory publishes cost-bearing events. SAM reads authorized operational views and proposes actions through governed commands; it is not a second inventory writer.

Start with a modular application and transactional PostgreSQL engine already present. Do not split into independent microservices until measured contention or deployment needs justify it. A durable inbox/outbox worker may be separate operationally while sharing reviewed contracts.

## System invariants

Every quantity change has an authenticated actor or authorized integration identity, a source document, an idempotency key and ledger transaction. The same transaction updates balance, reservation/state and outbox. Remote network calls occur after commit. Cross-company references fail at the database boundary. Audit corrections append reversal records. Availability is evaluated for a feasible fulfillment site; an aggregate network number is not a promise that one warehouse can pick it.

## Known gaps, not features

The current order importer is not a proven complete live order cycle; parts of search filter only the loaded page. The warehouse event table is staging-only with no approved recording RPC. Current return movement directly increases physical stock without quarantine inspection. Default company selection is implicit. Provider FBB status must not be inferred from an internal shipping button. These are explicit phase work items, not silently resolved by documentation.

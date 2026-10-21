# Canonical data and ownership model

An organization represents one legal stock-owning company for this release. A group-level user may have several memberships; that never combines the companies' inventory. Channel accounts and warehouse addresses are not legal owners. Same-location storage for two companies has distinct ownership dimensions. Intercompany movement requires an explicit commercial transaction, not an internal transfer.

| Entity                                | Current / target                                | Required key and constraints                                                                               |
| ------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| organizations, organization_members   | Existing, extend scoped roles                   | Membership by user+org; active company selected and server validated                                       |
| components                            | Existing physical inventory identity            | org+SKU unique; base UOM, tracking policy, active flag                                                     |
| products, families, attributes        | Existing sellable catalog                       | Family is organizational only; variant identities remain distinct                                          |
| product_identifiers                   | Target                                          | kind/value/source/confirmed mapping; EAN as text; no identity merge by EAN alone                           |
| bom_versions, bom_lines               | Existing mutable BOM to versioned BOM           | product+version; positive base quantity; one aggregated row per component; immutable once used             |
| warehouses, locations                 | Existing warehouses, target hierarchy           | org/warehouse/zone/bin; receiving/quarantine/storage/pick/dispatch/transit types                           |
| inventory_dimensions                  | Target normalized dimensional key               | owner/item/warehouse/location/condition/lot/serial; handle NULL uniqueness explicitly                      |
| component_stock / balances            | Existing cache to dimensional projection        | physical>=0, reserved>=0, reserved<=eligible physical; writes through transactions only                    |
| stock_movements / ledger              | Existing append-only basis, extend              | transaction+line unique, source document and source line, actor, recorded_at, reversal_of, operation key   |
| orders, order_lines                   | Existing, extend external line identity/version | org+account+provider order ID and provider line ID; fulfillment owner fixed from verified listing/provider |
| order_reservations / allocations      | Existing, extend per line/site                  | Stable BOM snapshot, remaining quantity, status, allocation dimensions                                     |
| suppliers, PO, receipts               | Target                                          | ordered/received/accepted/rejected per line; repeated receipt cannot count twice                           |
| pick/pack/ship tasks                  | Target                                          | quantity-level transitions, official label and handoff evidence, expected version                          |
| returns, inspections                  | Target                                          | original shipment line; returned<=shipped minus earlier returns; quarantine before resale                  |
| transfers                             | Target                                          | owner fixed; source/transit/destination quantities conserved; discrepancy approval                         |
| counts, adjustments                   | Target                                          | snapshot version, counted amount, variance, approver and compensating entries                              |
| event_inbox, inventory_outbox         | Outbox existing, inbox target                   | org/provider/account/event ID unique; request/payload hash, attempts, retry_at, schema version             |
| valuation layers / accounting exports | Target                                          | currency and exact monetary values; cost policy version; event ID deduplication                            |

Keep existing UUID identities and imports wherever sound. Add organization identity to child entities and enforce composite foreign keys or equivalent database triggers, not UI-only checks. Schema migrations are forward-compatible additions; balancing migration cannot guess unknown organizations or sum offer stock.

Quantities use integer base units for counted goods and exact decimal base quantities for weight/length items. UOM conversions are rational/versioned; do not use float. Lot/serial tracking is required before such goods enter the system, not retrofitted after dispatch. Monetary values are separate from quantity projections: unknown cost is pending valuation, never a silent zero.

The authoritative record is the approved inventory ledger plus source documents; the balance table is a reconciled projection. Marketplace stock is a remote observation/commitment, not independent warehouse stock. Initial opening balances require a dated approved snapshot and one-time migration key; never replay historical movements and add their opening quantity again.

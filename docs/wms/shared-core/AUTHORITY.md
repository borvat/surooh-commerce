# Exact ownership and single-writer protocol

| Data | Sole target authority | Permitted Surooh/WMS role |
|---|---|---|
| Physical on-hand, warehouse/location, quarantine | ERPNext native stock vouchers and Stock Ledger Entry | Submit scoped commands; render read projections |
| Active reservations and component ATP commitments | Native Stock Reservation Entry | Facade expands approved versioned BOM, locks all component bins, commits one whole command. Inbox stores command outcomes, never independent reserved balances |
| Receipts, counts, transfers, picks and dispatch stock effects | ERPNext native stock documents | WMS workflow/scan UI maps to native IDs; labels/prints never imply dispatch |
| Inventory value, cost layers, landed costs and COGS | ERPNext native valuation tied to GL | Source evidence/receipt facts only; no Tryton/Supabase competing cost ledger |
| Invoices, credits, AR/AP and GL | ERPNext native accounting per legal company | Marketplace supplies events; facade maps approved policy; SAM read/proposals only |
| Product/offer identity and commercial pack definition | Commerce approved product master and versioned mapping | ERPNext receives company-specific item/BOM snapshots; EAN alone never merges stock |
| Channel return request | Marketplace facts | Does not automatically restock or issue credit |
| Return inspection/disposition | ERPNext stock workflow | Quarantine before approved release; stock return and financial credit separately correlated |

Shared core means accounting and stock use one native transaction boundary **within each legal company**. It does not combine unrelated legal-company databases. Each company gets its own site, DB credential/database, storage prefix/mount and service identity; no application identity can list/read another company's mounts/backups/configs. Prefer separately scoped DB services when the threat model includes service compromise. Shared hosting/database administration remains a privileged boundary, documented and controlled, not an unproved tenant-isolation guarantee. Group reports use authorized read-only exports with provenance and elimination rules; IC uses paired vouchers and a recoverable saga, never a cross-company GL line.

Commerce keeps bol read-only guards, canonical single stock pool/master reference, FBR internal allocation, FBB excluded, unconfirmed offers excluded, cap999 display/sync policy, overrides and bundle UI. No phantom stock is created for a virtual bundle parent. A later approved physical repack is a real native stock/manufacturing movement.

Current authority is unchanged. Future cutover must freeze the old writer at a watermark, reconcile all movements/reservations/quantity/value/APAR/GL, then disable the former writer before enabling the target. Never fan out one mutation to both old and new stock engines. Analytical projections are rebuildable read-only views. No target command may fall back to writing Supabase when ERPNext is unavailable; fail/queue durably instead.

Command identity binds authenticated actor, server-resolved company/site, source, operation/version, external key and normalized payload hash. One native transaction writes the inbox, native voucher/SREs and outbox. Group reads are not mutation tokens. Native submission/export/background endpoints must be denied or equivalently checked for client identities; a facade is insufficient if direct bypass remains available.

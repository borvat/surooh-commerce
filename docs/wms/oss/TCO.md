# Three-year ownership cost model

These are engineering planning assumptions, not vendor quotations, measured development velocity or hosting offers. No commercial commitment is made. Compare total Surooh WMS delivery, not just installation. Currency EUR; labor assumption €60/hour; 36 months. Scenario: two legal companies, two warehouses each, 10 operators, 20k SKUs, 500 orders/day, three internal integration contracts plus bol ingestion; one test environment, backups/monitoring and upgrade rehearsals. Order volume and operational SLA must be confirmed by the owner.

Formula: `TCO = rate × (initial hours + 36 × monthly maintenance hours + 3 × annual upgrade hours) + 36 × monthly infrastructure`. Initial hours include architecture validation, adapters, synthetic migration, existing UI reuse, missing Surooh invariants and acceptance. Monthly maintenance excludes the separately budgeted annual major-upgrade rehearsal. Sunk development cost is excluded; code reuse reduces remaining hours only.

| Foundation | Initial h | Maintenance h/month | Upgrade h/year | Infrastructure/month | 3-year modeled total |
|---|---:|---:|---:|---:|---:|
| Current Surooh | 900–1600 | 20–36 | 60–120 | €80–250 | €111k–204k |
| Tryton | 600–1100 | 18–32 | 80–150 | €100–300 | €93k–173k |
| ERPNext | 650–1200 | 22–40 | 100–180 | €150–450 | €110k–207k |
| Odoo Community | 650–1250 | 24–42 | 120–220 | €150–500 | €118k–223k |
| InvenTree, company-isolated | 1000–1800 | 24–44 | 90–180 | €180–650 | €135k–259k |
| OpenBoxes | 1100–1900 | 24–44 | 120–220 | €150–500 | €145k–267k |

Infrastructure includes application/database, synthetic staging, backup/object storage and monitoring assumptions; InvenTree allows two company-separated instances. It does not assume a shared-instance tenant redesign is free. No per-user commercial license fee is included for the OSS editions inspected. Enterprise modules, paid support, migration of real customer data, high availability/on-call 24×7, hardware/scanners/labels, tax, third-party marketplace fees and security consultancy are excluded and must be added if required. Include license-compliance review in initial discovery before using addons.

Sensitivity: a €90/hour rate multiplies labor by 1.5, not infrastructure; twice as many companies materially increases per-instance InvenTree operations. Extra channel and carrier semantics increase every option. The ranges overlap heavily; an unproven 200-hour integration assumption can reverse the ranking. These estimates do not establish that adopting Tryton is cheaper: the first approved spike must replace assumptions with timed implementation evidence. Do not select based on the lowest range endpoint.

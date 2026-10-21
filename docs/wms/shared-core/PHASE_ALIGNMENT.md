# One cross-system phase plan

The identical authority contract is hashed in the joint wave plan. Accounting retains sequential M1–M7; WMS retains P01–P09 but **old Supabase/Tryton writable stock-engine tasks are superseded** by shared native ERPNext commands. Old source/history and migrations remain preserved; do not execute historical packets as active instructions.

| Wave | Accounting | WMS | Shared deliverable / acceptance |
|---|---|---|---|
| C0 preparation | M0 | P00 | This reviewed direction, precise evidence/holds and coordinated Draft PRs |
| C1 foundation | M1 | P01 then P02 | Pinned engine/app, legal-company isolation, controlled facade, core inbox/outbox and explicit worker permissions; hosted CI and actual non-root boundary evidence |
| C2 fiscal and billing | M2 then M3 | Baseline retained | Accountant policy/goldens and native invoice/credit/APAR/bank-import controls |
| C3 stock workflows | M4 | P03→P04→P05→P06 | Native component reservations and WMS adapter, receiving/counts, pick/pack/ship, inspection/transfer; quantity/value/COGS/GL reconcile |
| C4 integration | M5 | P07 then P08 | Channel events, IC saga, SAM read/proposal, durable dedup/recovery and quota simulation; no live bol writes |
| C5 rehearsal/readiness | M6 then M7 | P09 | Synthetic migration, restore/upgrades/security/load and signed review pack; no actual cutover |

Within C1, review Accounting M1 engine boundary before WMS P01/P02. Within C3, Accounting M4 and WMS P03–P06 are staged slices of one joint stock deliverable; do not require completed M4 before implementing the WMS slices needed to accept M4. C4 similarly joins M5 with P07/P08. Existing internal predecessor chains remain. Each named slice needs separate owner authorization with repository/base SHA/environment and exact predecessor evidence; C0 approval never launches C1.

The backend app lives in Accounting; Commerce owns its current UI/contracts/mapping and read projections. Backend commands must not be implemented independently a second time in Commerce. A paired review record lists both exact heads, shared-contract hash, native/backend and UI test artifacts, remaining defects, reviewer decisions and rollback. Contract drift fails offline checks and blocks review. No shared token or cross-private-repository secret is added to public CI.

Future rollback: stop isolated consumers, retain evidence/outbox state, revert/rebuild only sandbox; native reversals when appropriate. Current production authorities and write guards remain unchanged. Future data cutover requires a new explicit reconciled single-writer plan and approval.

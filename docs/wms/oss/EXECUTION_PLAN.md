# Current plan hold — comparative evidence first

The Tryton-specific phase table below is historical/conditional. It is not the adopted plan. Read [DECISION_CLOSURE.md](DECISION_CLOSURE.md). Owner withheld final engine approval and any Codex handoff.

P00 remaining sequence: (1) complete restricted connection setup for the new free test database; (2) initialize separate synthetic Tryton and ERPNext databases; (3) run native shared-component races/whole-command rollback and retry tests; (4) prove limited-role API/report/export/background boundaries; (5) execute complete receiving→two kits→reservation→pick/pack/ship/cancel→quarantine/inspection→channel replay cycles; (6) exercise ERPNext stock-to-GL postings and role-separated Surooh modules on one core; (7) run common performance and upgrade/restore benchmarks plus advisory/license triage; (8) compare A/B/C on measured evidence and obtain owner ADR acceptance. Only then rewrite/review P01–P09 for the selected architecture and request separate phase-start approval. No execution permission follows from this sequence.

The worker regression must reject a foreign-company payload even in a native queue job. Fixing an HTTP endpoint alone is insufficient. Do not suppress the discovered trusted-context case or label it a passed tenant requirement. Never substitute a read-only provider metadata query, an ERPNext import, or SQLite locking behavior for a native PostgreSQL acceptance result.

---

## Historical conditional Tryton plan

# Decision-dependent GitHub execution plan

Status: proposed branch-only supplement. Existing P01–P09 Issues/Milestones remain **held**. Their Supabase-specific file plans are the historical current-system path, not authorization to implement a Tryton migration. If ADR-0001 is accepted, rewrite/review those packets and Issues on the accepted SHA before assigning any Codex work. If rejected, explicitly choose/review option 2 or 3; do not silently resume old tasks.

## P00 — Independent foundation decision and blocking evidence

Goal: resolve the architectural choice before functional development. Inputs: audit ZIP, feature/foundation SHAs, five-source comparison, two native runtime experiments, license and TCO review. Files: `docs/wms/oss/`, `research/wms-oss/`, phase catalog and stage gate; no application/SQL changes. Dependencies: none beyond authorized inspection. Start: evaluation authorized by owner; **does not authorize Codex**. Exit: native PostgreSQL G1/G2 and full end-to-end G3 evidence, security/support/license/TCO G4 review, owner ADR acceptance G5 with exact reviewed SHA. Acceptance: all acceptance matrix rows have real product/backend/role/expected/actual evidence; blocked/skipped never pass. Risk: choosing by demo success; mitigation: hard gates. Rollback: close research draft PR, preserve existing branches. Task packet: complete the blocked experiments in a database-capable isolated sandbox, report counterexamples, update ADR without migrating any live data.

## Proposed stages after conditional Tryton selection

Each row is a **future task**, not implemented functionality. All phases require exact-SHA evidence, synthetic DB fixtures, explicit owner start, reviewed draft PR and manual acceptance before the next phase. No auto-merge, deploy or Codex trigger.

| Phase | Goal / requirements | Proposed affected files/modules | Dependencies | Acceptance and exit evidence | Main risk / rollback | Codex task after explicit start |
|---|---|---|---|---|---|---|
| P01 / M01 | Reproducible dual baseline: preserve current app and pin supported Tryton + PostgreSQL; establish disposable DB runner | `research/wms-oss/`, proposed `services/wms/`, `tests/db/`, `scripts/wms/db-check.mjs`, existing UI type/lint baseline | Accepted ADR + P00 gates; reviewed revised packet | Clean schema rebuild, no external targets, runtime/source locks, baseline tests, backup/restore; no application cutover | Runtime drift; remove isolated service/DB, retain feature app | Build isolated reproducible foundation and real DB adapter only |
| P02 / M02 | Company-bound identity and authorization facade | proposed `services/wms/auth/`, company mapping, `tests/db/tenant/`, existing `src/lib/auth.ts` adapter boundary | P01 manually accepted | Limited-user direct/list/report/export attacks fail across A/B; revocation and cross-company FKs rejected | Trusted caller context; deny by default, revert facade route | Implement and demonstrate one scoped company API boundary |
| P03 / M03 | Idempotent all-or-nothing physical-component reservations and native kits | proposed `services/wms/reservations/`, product_kit extension, `src/lib/unified-stock.ts` adapter, DB tests | P02 accepted | 10 shared units; kits consuming 4/6; concurrent two-channel winner; shortage no partial reservation; replay/cancel/BOM snapshot/site ATP | Native partial/force assignment bypass; feature flag new commands off, preserve ledger | Implement one transactional reservation facade with no dual writer |
| P04 / M04 | Receipt, inspection, putaway, locations/count/damage using stock workflows | proposed receiving extension, mapped stock locations, `src/lib/wms/receiving/`, DB tests | P03 accepted | Receipt into quarantine then inspected release; counted/adjusted quantities have provenance and concurrency checks | Early sellable release; stop receipt commands, reconcile movements before reversal | Add receiving command/UI slice, use native moves |
| P05 / M05 | Persist picking, packing and dispatch | proposed shipment facade, existing warehouse command/audit modules and order UI | P04 accepted | Pick/pack/dispatch persists; print does not ship; partial shipment; cancel/dispatch race; repeated dispatch no second deduction | Double dispatch; pause worker, reverse only via audited correction | Wire existing UI contracts to scoped native shipment operations |
| P06 / M06 | Inspected returns and conserved transfers | proposed returns/transfers extension, in-transit/quarantine locations, DB scenarios | P05 accepted | Return cannot be sold before inspection; over-return rejected; source/transit/destination conservation including partial transfer | Duplicate inbound stock; freeze commands and reconcile transfer/return IDs | Add return/transfer commands with original-movement references |
| P07 / M07 | Read-only channel ingestion and Marketplace/Accounting/SAM contracts | existing bol/channel modules; proposed durable inbox/outbox and versioned facade contracts | P06 accepted | Same provider event twice creates one order/reservation; conflict payload quarantined; Accounting event dedupe; SAM delegation; live writes remain off | Double accounting or dual stock write; stop consumers and replay from reviewed watermark | Implement adapter contracts and synthetic provider tests only |
| P08 / M08 | Component quota simulation, reconciliation and replenishment evidence | proposed planning/observability modules, shared-components tests | P07 accepted | Published quotas simulated within one component budget; lag pause, drift and reorder evidence | Offer ATP summed incorrectly; disable simulation outputs | Add read-only planning/monitoring slice; no live publication |
| P09 / M09 | Controlled release readiness and migration rehearsal | `docs/wms/evidence/`, synthetic migration mapping, load/recovery/live-read review | P08 accepted | Full acceptance matrix, support/security/license approvals, movement/balance/hash reconciliation, measured load, tested rollback | Irreversible cutover; rehearse stop/restore/replay, production remains separate approval | Produce release evidence and draft proposal; do not merge/deploy |

Start gate for every P01–P09: accepted predecessor SHA + unresolved P0/P1 count zero + owner start reference + approved revised packet for selected foundation. Exit means `READY_FOR_HUMAN_REVIEW`, never automatic continuation. Approval records must be external owner references, not AI-authored checkboxes.

## Prototype acceptance matrix to close before ADR acceptance

| Scenario | Expected invariant | Current evidence / missing experiment |
|---|---|---|
| Receive → reserve → ship | Physical stock conserved; reservation consumed once | Tryton native ORM sequence passed; full UI/provider end-to-end pending |
| Shared kits A/B | One shared physical pool; never sum offer balances | Native kit quantity probe + native sale scenario; all-or-nothing two-kit sale on PostgreSQL pending |
| Simultaneous channels | At most one winner for last component | InvenTree upstream native concurrency test skipped SQLite; PostgreSQL required for both finalists |
| Cancel/replay | Release once; repeated cancel has no additional effect | Native assignment cancel + InvenTree stale cancel tests; Surooh inbox replay pending |
| Inspected return | Quarantine unavailable, only accepted units sellable | Native returns scenarios pass; explicit quarantine/inspection policy not demonstrated |
| Warehouse transfer | Source + transit + destination conserved | Tryton native internal/transit scenarios passed; Surooh command facade pending |
| Shortage | No oversell and whole kit command rolls back | Native stock bound checked; Tryton partial assignment must be wrapped and tested |
| Tenant isolation | Limited roles cannot cross companies | Company quantity context check only; full restricted-user API tests blocked |
| Duplicate synchronization | Exactly one local effect per event key | InvenTree shipment-task replay passes; provider inbox/outbox is separate pending work |

Both finalists have functioning isolated test runtimes; neither has all hard gates passed. This plan deliberately does not label P00 complete or P01 ready to start.

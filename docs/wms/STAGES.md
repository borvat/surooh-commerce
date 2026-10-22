> Current direction: owner approved shared ERPNext16 accounting/stock/valuation for preparation only. [Shared authority](shared-core/AUTHORITY.md) and [phase alignment](shared-core/PHASE_ALIGNMENT.md) supersede any historical Supabase/Tryton writable-ledger instructions below. Current source/production remains unchanged. Codex, merge, deploy and real migration remain held.

# Ordered engineering execution plan

All execution is on hold. The owner authorized preparation only, not starting Codex. Foundation is P00 (this draft PR); P01 is the first prepared implementation task. Each phase is reviewed before owner acceptance and a separate next-phase start decision. Technical dependencies below form a deliberately sequential delivery path.

| Phase | Objective                                        | Depends on                    | Task packet          |
| ----- | ------------------------------------------------ | ----------------------------- | -------------------- |
| P01   | Disposable database and reproducible baseline    | P00 reviewed + owner approval | [P01](phases/P01.md) |
| P02   | Explicit company scope and tenant security       | P01                           | [P02](phases/P02.md) |
| P03   | Reservations, ATP and shared BOM correctness     | P02                           | [P03](phases/P03.md) |
| P04   | Receiving, locations and stock control           | P03                           | [P04](phases/P04.md) |
| P05   | Persisted picking, packing and dispatch          | P04                           | [P05](phases/P05.md) |
| P06   | Inspected returns and conserved transfers        | P05                           | [P06](phases/P06.md) |
| P07   | Read-only channels, Accounting and SAM contracts | P06                           | [P07](phases/P07.md) |
| P08   | Quota simulation and operational observability   | P07                           | [P08](phases/P08.md) |
| P09   | Release evidence and controlled readiness review | P08                           | [P09](phases/P09.md) |

Each task packet includes scope, affected files, dependencies, start/exit criteria, acceptance checks, risk/rollback and a held Codex prompt. `phases.json` is the machine-readable catalog. Issues are planning containers, not execution authorization. Nine native milestones were created and linked to Issues; the confirmed register is in GITHUB_OPERATIONS.md and github-register.json.

Incremental changes only: no wholesale frontend rewrite, ERP replacement, database fork or automatic migration. New components must build on the current canonical inventory model and interfaces. A phase may produce additive code and fixtures but cannot silently redefine safety/ownership/BOM policy.

## Architecture evaluation hold

The conditional [OSS execution plan](oss/EXECUTION_PLAN.md) adds P00 and proposes replacement phase scopes if ADR-0001 is accepted. Existing phase packets remain historical current-system plans until explicitly revised and approved.

## Evidence-closure update

Owner accepted preparatory research only. No engine is selected. See [the latest decision report](oss/DECISION_CLOSURE.md). G1–G4 are not closed; P01 is not eligible for Codex handoff. Additional SQLite authorization tests and ERPNext imports do not replace the mandatory PostgreSQL practical comparison.


Current verification decision: independent local/isolated runner and evidence gate in `verification/README.md`. G0 HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED; no billing repair or repeated Actions. Required build/type/lint/native/security/integration tests and owner/accountant review remain mandatory; no phase start or completion is authorized.


## Atomic pick / retained React candidate (current follow-up)

See [atomic-pick results](atomic-pick/RESULTS.md), paired Draft PR22/Accounting31. Exact WMS920e3a12a0136ad51975c5a55dc5871645d5d7e3 / Accounting97c22b594fa37e2fe1e12458cf1a0f7edeec5432: native29 PASS/0 FAIL/1 browser BLOCKED; WMS109, PG21+18, type/lint/build/generated clean PASS;15 existing lint warnings retained. NI-F01 native handoff is a review-ready bounded candidate, not production acceptance. Existing screens are wired in synthetic mode and their services run against native HTTP; a rendered browser cycle is NOT EXECUTED. Actual non-root service/storage/key isolation remains BLOCKED. PREPARATION/P01, Codex/merge/deploy and all G1–G6 approvals remain held. Hosted Actions stays BLOCKED. Future packet in atomic-pick/NEXT_REVIEW_PACKET.md grants no execution permission.

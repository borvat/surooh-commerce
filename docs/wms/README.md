> Current direction: owner approved shared ERPNext16 accounting/stock/valuation for preparation only. [Shared authority](shared-core/AUTHORITY.md) and [phase alignment](shared-core/PHASE_ALIGNMENT.md) supersede any historical Supabase/Tryton writable-ledger instructions below. Current source/production remains unchanged. Codex, merge, deploy and real migration remain held.

# Surooh WMS — Engineering Foundation & Execution Readiness

Status: **foundation proposed; Codex execution NOT authorized**. No stage is running. This directory is the engineering control surface, not a claim that the WMS is production ready.

| Read in order                                | Purpose                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| [BASELINE.md](BASELINE.md)                   | Source decision, comparisons, provenance and uncertainty           |
| [ARCHITECTURE.md](ARCHITECTURE.md)           | Functional boundaries, existing files, target modules              |
| [DATA_MODEL.md](DATA_MODEL.md)               | Company, ownership, warehouse and ledger model                     |
| [INVENTORY_RULES.md](INVENTORY_RULES.md)     | ATP, BOM, reservations, quotas and concurrency                     |
| [OPERATIONS.md](OPERATIONS.md)               | Receipt, putaway, pick/pack/ship, return, transfer and count flows |
| [INTEGRATIONS.md](INTEGRATIONS.md)           | Marketplace, Accounting and SAM contracts                          |
| [SECURITY.md](SECURITY.md)                   | Session scope, roles, RLS, audit and data minimization             |
| [STAGES.md](STAGES.md)                       | Ordered implementation plan and readiness criteria                 |
| [STAGE_GATES.md](STAGE_GATES.md)             | Evidence review and explicit owner-controlled progression          |
| [TESTING.md](TESTING.md)                     | Local / disposable DB / live read-only test separation             |
| [GITHUB_OPERATIONS.md](GITHUB_OPERATIONS.md) | Issues, milestones, PRs, CI and admin blockers                     |
| [STATUS.md](STATUS.md)                       | Actual work completed and remaining blockers                       |

Implementation modules stay in their current locations. No business-code migration, schema deployment, dependency upgrade, production connection or live marketplace call belongs to this foundation.

The prior `Surooh-WMS-Codex-Handoff.zip` is an initial audit reference only. Its old instruction to start Codex is superseded by this foundation and the owner's explicit execution hold. [Phase P01](phases/P01.md) is a prepared task packet; do not submit it to Codex until the owner authorizes that exact phase.

## Architecture evaluation hold

Read [OSS evaluation and proposed decision](oss/README.md) before any phase. P01 is now blocked by the architecture decision, not ready for execution.

## Current decision review

Research acceptance does not select an engine. Read [the three-architecture evidence report](oss/DECISION_CLOSURE.md). P01 is not eligible for Codex handoff; native PostgreSQL/application tests are blocked by the isolated test connection setup. No production resource or application code was changed.


## Atomic pick / retained React candidate (current follow-up)

See [atomic-pick results](atomic-pick/RESULTS.md), paired Draft PR22/Accounting31. Exact WMS920e3a12a0136ad51975c5a55dc5871645d5d7e3 / Accounting97c22b594fa37e2fe1e12458cf1a0f7edeec5432: native29 PASS/0 FAIL/1 browser BLOCKED; WMS109, PG21+18, type/lint/build/generated clean PASS;15 existing lint warnings retained. NI-F01 native handoff is a review-ready bounded candidate, not production acceptance. Existing screens are wired in synthetic mode and their services run against native HTTP; a rendered browser cycle is NOT EXECUTED. Actual non-root service/storage/key isolation remains BLOCKED. PREPARATION/P01, Codex/merge/deploy and all G1–G6 approvals remain held. Hosted Actions stays BLOCKED. Future packet in atomic-pick/NEXT_REVIEW_PACKET.md grants no execution permission.

## Local native verification — 2026-10-23

The current owner authorized continued implementation and testing outside Actions.
See [local native results](local-native/RESULTS.md): two fresh ERPNext/Frappe16.52.0
runs each29 PASS/0 FAIL/1 browser BLOCKED. Latest tested WMS011c538 includes a real
screen-command coalescing/committed-response-loss/retry assertion. Native runtime
provisioning is now demonstrated; browser execution remains blocked by local IPC
restrictions. App120/foundation25/typecheck/build/lint pass at prior exact source
7fb1d79; changed-harness lint passes at011c538, with15 existing warnings. Accounting
native source was a14-blob verified materialization of PR31, not a full checkout.
No overall phase or production acceptance; latest evidence supersedes historical
missing-runtime statements only within this bounded native test scope.

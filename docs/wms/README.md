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

> Current direction: owner approved shared ERPNext16 accounting/stock/valuation for preparation only. [Shared authority](shared-core/AUTHORITY.md) and [phase alignment](shared-core/PHASE_ALIGNMENT.md) supersede any historical Supabase/Tryton writable-ledger instructions below. Current source/production remains unchanged. Codex, merge, deploy and real migration remain held.

# Human-controlled phase gates

The current state is `execution_authorized=false`, `active_phase=null`. P01 is prepared but not started; all later phases are locked. No script, Issue closure, test result or PR approval automatically launches Codex, changes a phase to accepted, merges, deploys or connects production.

## Progression protocol

1. Owner authorizes one named phase, exact base SHA, test environment and excluded operations in a reviewable Issue/decision reference. A planning Issue is not that authorization.
2. Only then assign its task packet to Codex manually; use a phase branch and a draft PR against the reviewed development branch. Do not assign any Issue to an agent now.
3. Codex stops after scope completion and supplies all required local and disposable-DB results, exact commit, artifact digests, defects and rollback evidence using the evidence template.
4. `node scripts/wms/phase-gate.mjs P01 path/to/record.json` checks evidence completeness, dependency acceptance references, command exit codes, SHA freshness and on-disk artifact hashes. Missing/failed checks and unresolved inventory/security P0/P1 blockers reject the packet. The validator emits `READY_FOR_HUMAN_REVIEW`, never `ACCEPTED` or `START_NEXT`.
5. A human reviewer verifies the test jobs/logs actually belong to the reviewed SHA, coverage meets the acceptance scenarios, database roles are limited and the rollback is sound. JSON status fields are assertions, not proof of identity or approval.
6. Owner explicitly accepts the phase at that SHA in a decision reference. The next phase still requires its own start authorization. Record technical acceptance and owner authorization separately. Scope/commit changes invalidate affected evidence and approvals.
7. Main merge and production rollout each require separate explicit owner approval. Use GitHub rulesets/required reviews/checks when available to enforce server-side protection; they are not configured or proven by this foundation.

## Required evidence

- Phase ID, exact 40-character tested commit, baseline SHA, environment `isolated-synthetic`, and zero production connections.
- Each required check from phases.json with result, command, exit code and nonempty log artifact. `not_run`, `skipped` and missing checks block acceptance.
- Artifact paths limited to an evidence directory with SHA-256 digest; no customer data, tokens, secrets or production exports.
- Dependency phase acceptance SHA/reference; independent technical review and owner decision references are checked by a human, not self-certified by a runner.
- Rollback report, residual limitations and defect severity/domain.

The local evidence validator does not cryptographically prove a test ran or authenticate a reviewer. A repository administrator could edit a workflow or bypass absent protection. The actual authority remains the owner's explicit decision plus human verification of immutable CI/check logs. Do not claim automatic enforcement that the current GitHub connection cannot configure.

## Architecture evaluation hold

The CLI also applies the mandatory architecture decision gate in `phases.json`. G1–G4 and owner acceptance must be recorded before any phase can reach human review. This is a review guard, not proof that an approval reference is authentic or repository branch protection is enabled.

## Evidence-closure update

Owner accepted preparatory research only. No engine is selected. See [the latest decision report](oss/DECISION_CLOSURE.md). G1–G4 are not closed; P01 is not eligible for Codex handoff. Additional SQLite authorization tests and ERPNext imports do not replace the mandatory PostgreSQL practical comparison.


Current verification decision: independent local/isolated runner and evidence gate in `verification/README.md`. G0 HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED; no billing repair or repeated Actions. Required build/type/lint/native/security/integration tests and owner/accountant review remain mandatory; no phase start or completion is authorized.

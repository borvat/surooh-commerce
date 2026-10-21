# Surooh WMS — Source Quality Remediation & Clean Verification

Owner-authorized bounded cleanup from a158106e61241e66a4148638b59bfd50e28f023e on remediation/wms-source-quality. Accounting preparation evidence is accepted for preparation/review only; this is not production or Codex authorization. PR17 and main remain unchanged. Use a stacked Draft PR against research/shared-core-alignment so review shows only this cleanup.

Scope: fix three optional-property construction errors and reconcile four stale generated-route diagnostics; preserve query behavior, strict compiler options, existing ESLint rules and ignores; use existing locked Prettier in batches of at most12 files with --debug-check before --write. Only the formatter's AST-equivalence checks plus runtime regression tests support formatting safety; they are not complete product acceptance. Generated src/routeTree.gen.ts remains owned by the existing TanStack Start build (no competing generator or version upgrade).

Review commit sequence: optional fields/const timer; reviewed generated registrations;12 formatter-only batches; nine source-quality regressions; scoped verification plan. Existing91 unit cases remain; the nine additions test optional request filters, generated route coverage/guard wiring and the actual permission hook with seeded synthetic roles (100 cases total). Permission hook tests do not prove DB RLS, browser navigation or HTTP authorization.

## Reproduction

Use verification/run.py with the exact published source SHA and the pinned existing Bun1.3.13/Node24.19.0/Python environment, a new output directory outside the checkout, and the previously accepted exact Accounting report. The runner allowlists synthetic environment variables and prepends the chosen Bun directory. It records all argv, cwd, exits, versions, log/artifact/input hashes and source status; it does not restore files after build. Gate SOURCE_QUALITY requires foundation/authority checks, frozen install,100 unit tests,9 scoped regressions, typecheck/lint/build, generated cleanliness and verifier regressions. PREPARATION/P01 still require the unimplemented legacy database adapter; no requirements were removed from those scopes.

```sh
python3 verification/run.py --profile wms --expected-sha <SOURCE_SHA> --bun <ABSOLUTE_BUN> --tools-python <TOOLS_PYTHON> --accounting-report <ACCEPTED_REPORT> --accounting-expected-sha a9400f6f4b9066f5487f16cd45268728920e5672 --output <NEW_EXTERNAL_OUTPUT>
python3 verification/gate.py --report <NEW_EXTERNAL_OUTPUT>/report.json --phase SOURCE_QUALITY --expected-sha <SOURCE_SHA>
python3 verification/gate.py --report <NEW_EXTERNAL_OUTPUT>/report.json --phase P01 --expected-sha <SOURCE_SHA>
```

Runner exit2 may reflect deliberately blocked database/future requirements even when every source-quality requirement passed. Always inspect each row and the separately scoped gate; do not relabel the full runner as exit0. A source-quality READY_FOR_HUMAN_EVIDENCE_REVIEW result never accepts G0/P01 or starts a phase. After `bun run build`, `node scripts/wms/generated-clean.mjs` must exit0 and the full tracked source snapshot must remain clean. Fresh checkout typecheck runs before build, so stale generated types cannot be masked by ordering.

During exploratory development a direct `bun run test:unit` lacked nested Bun in PATH and exited127. The independently pinned runner is the acceptance path; retain this failed development log and do not call it a source/test failure or a successful acceptance run.

Warnings are deliberately visible; see WARNING_REVIEW.md. DB adapter/RLS/concurrency work remains a separate non-executed plan in DATABASE_ADAPTER_PLAN.md. Hosted GitHub Actions remain BLOCKED by billing; no rerun, billing change, paid service, main protection change, merge/deployment, real-data operation, stock valuation/GL change or Codex launch. All M1–M7/P01–P09 and G1–G6 residual acceptance holds remain.

Rollback: discard this independent branch or revert its commits in reverse order after review. No historical migrations or production schema/data were changed. Evidence publication is later documentation-only and refers to the tested source SHA, not its own newer SHA.

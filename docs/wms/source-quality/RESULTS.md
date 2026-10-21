# Clean source verification — final results

The bounded source-quality acceptance checks passed on **3a7cfb73850ec89fd91822c5c0078ff985d25895**, tree180796b4886586dcd44053a77f635f72e529a57f, from base a158106e61241e66a4148638b59bfd50e28f023e. Source and test/tool changes were published before acceptance execution. Later evidence/docs commits are not advertised as the executed source.

| Executed check | Actual outcome |
|---|---|
| Frozen dependency install --ignore-scripts | PASS exit0; bun.lock/package unchanged |
| TypeScript, before build | PASS exit0; all seven prior diagnostics resolved; strict config unchanged |
| eslint . | PASS exit0; zero errors,15 retained warnings below |
| Actual Vite/Nitro build | PASS exit0;142 output files hashed |
| Generated tree check | PASS exit0; full tracked worktree clean before/after, same commit and tree |
| Unit tests |100 PASS,0 FAIL across14 files:91 existing +9 new; nine new cases also run separately, not109 independent cases |
| Existing foundation gates / authority holds / alternative verifier regressions |19 /6 /14 PASS; foundation and captured-integrity checks also PASS |
| Accepted Accounting native link | PASS; verifies prior Accounting artifacts, not a new WMS/native/RLS execution |
| Legacy DB adapter | BLOCKED exit2; deliberately still unimplemented; no DB connection opened |

Whole runner exit2:13 executed command slots PASS,0FAIL,18 BLOCKED slots (legacy DB plus future/policy requirements). This is not an all-scope exit0. SOURCE_QUALITY gate exits0 and returns READY_FOR_HUMAN_EVIDENCE_REVIEW. PREPARATION gate exits2 on missing DB adapter. P01 gate exits2 on DB adapter and fresh engine bootstrap. All gate records retain phase_complete=false, codex_start_authorized=false, merge_authorized=false and deploy_authorized=false. Owner acceptance/start approval remains separate.

## Repairs and review boundaries

Three optional-property construction diagnostics were fixed by omitting undefined suggestedPath/optional query properties. The same pure typed UI-filter builder is used for initial list and pre-print fresh re-read; empty/all/date/reference semantics are covered without changing server queries. The four stale-route diagnostics were resolved by committing the existing build generator's output for assistant/stockitup-review and navigation unions. Build no longer mutates the generated tree. The timer is initialized once with const after postMessage registration; asynchronous browser message/timer behavior is preserved.

133 files were formatted in12 commits of at most12 files (last1), using locked existing Prettier --debug-check before --write. Formatter receipts/logs, published commit mapping, exact base-to-source patch and settings/migration invariants are in the archive review/ directory. Compiler settings, lockfile, package manifest, Prettier config/ignore and historical SQL migrations are unchanged; ESLint configuration change is formatting-only. No lint rule/severity/ignore reduction or source suppression was added. No inventory valuation/financial behavior was changed.

The nine new cases cover optional request objects, generated registration/guard wiring and the actual permission hook against synthetic cached admin/warehouse/viewer/missing/unknown roles. Existing warehouse tests continue to cover scope rejection and duplicates. These do not prove HTTP authentication, live UI navigation, background-job permissions, DB RLS/concurrency or native ERP integration.

## All retained lint warnings at tested source

| File | Line:column | Rule |
|---|---|---|
| src/components/app/bundle-view.tsx | 6:17 | react-refresh/only-export-components |
| src/components/app/catalog.tsx | 47:17 | react-refresh/only-export-components |
| src/components/app/forms.tsx | 36:17 | react-refresh/only-export-components |
| src/components/app/merchant.tsx | 34:14 | react-refresh/only-export-components |
| src/components/app/offer-card.tsx | 12:17 | react-refresh/only-export-components |
| src/components/app/offer-card.tsx | 108:17 | react-refresh/only-export-components |
| src/components/app/ui-bits.tsx | 181:14 | react-refresh/only-export-components |
| src/components/app/ui-bits.tsx | 191:17 | react-refresh/only-export-components |
| src/components/ui/badge.tsx | 32:17 | react-refresh/only-export-components |
| src/components/ui/button.tsx | 49:18 | react-refresh/only-export-components |
| src/components/ui/form.tsx | 163:3 | react-refresh/only-export-components |
| src/components/ui/navigation-menu.tsx | 111:3 | react-refresh/only-export-components |
| src/components/ui/sidebar.tsx | 743:3 | react-refresh/only-export-components |
| src/components/ui/toggle.tsx | 42:18 | react-refresh/only-export-components |
| src/routes/_authenticated/products_.$productId.tsx | 95:6 | react-hooks/exhaustive-deps |

Disposition: all14 Fast Refresh warnings remain visible to preserve current exports/consumers; the Hooks dependency warning remains visible to avoid changing unsaved-name/reset behavior in a source cleanup. WARNING_REVIEW.md records reasoning and future repair options. No warnings are hidden or claimed fixed.

## Evidence and governance

Evidence archive: `evidence/source-quality-clean-run-01.tar.gz`; SHA256 **cd28c294e39d15a3ca6be9c5b065c68ba6a7cac3a19070b51bad14750ae47e62**. INDEX.json lists the tested source/tree, report/archive/sidecar hashes. Verify archive SHA, safely unpack to a new directory with tarfile filter="data", verify evidence-manifest.json, then replay the gate from the tested code revision. Every run command records cwd/argv/exit, environment/tool versions, source status and log/artifact hashes. Archive includes57 whitelisted files; runtime HOME/caches, DB dumps/configs, credentials and live data are excluded. One exploratory direct Bun invocation exited127 because nested Bun was absent from PATH; its log is preserved. The acceptance runner selected the pinned Bun directory and completed all source checks successfully.

GitHub Actions remains HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED; no retry or billing change. Cleanup is technically ready for human evidence review. Overall G0/PREPARATION and P01 are not accepted by this scoped result. G1–G6 residual service identity/isolation, real queues/integration, fiscal accountant review, full upgrades/recovery/load and main-protection gaps remain open. The separate database adapter plan is not implemented; see DATABASE_ADAPTER_PLAN.md. M1–M7/P01–P09 and Codex remain held. No main/PR17 merge, production deployment, data migration, bank/tax operation, paid service or production rule change occurred.

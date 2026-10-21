# Actual alternative verification results

G0 = **HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED**. GitHub Actions billing remains unresolved by owner decision; no repair or manual rerun was attempted. Preparation commits use [skip ci]. No hosted success, phase acceptance, Codex start, merge or deploy is claimed.

Tested code revisions: Accounting `a9400f6f4b9066f5487f16cd45268728920e5672`; WMS `e0ba96bab66a43ba580fb13aec3675ea36def932`. Later commits publish evidence/docs only and are not advertised as executed source revisions. Full reports carry command argv/cwd, actual exit codes, environment versions, durations, input/log/artifact hashes, UTC times and source status.

| Executed command/scope | Accounting | WMS |
|---|---|---|
| Independent package/build | PASS: sdist and wheel for inert Surooh app | PASS: actual Vite/Nitro build;142 output files hashed |
| Lint | PASS: Surooh app and new verification Python | FAIL exit1:3540 diagnostics (3525 errors,15 warnings); full log retained |
| TypeScript | N/A: independent app contains no TS; upstream ERP full frontend remains unproven | FAIL exit2:7 TS diagnostics on clean baseline before generation |
| Unit/gate suites | Existing25 gate tests,6 authority tests,14 new alternative-gate tests PASS | Existing19 gate tests,6 authority tests,91 unit tests,14 new alternative-gate tests PASS |
| Reference/tax draft |28 arithmetic and8 draft-policy tests PASS; not native/fiscal approval | Shared policy remains Accounting-owned; no fiscal approval |
| Native DB/concurrency/worker mitigation |8 real ERPNext/MariaDB verifiers PASS | Same actual Accounting artifacts linked and hash/source verified; not another UI/native run |
| Native HTTP/DB/files/report/recovery |11 verifiers PASS, including scoped replays | Same linked native evidence; service UID/host isolation not proved |
| Legacy WMS database adapter | N/A for independent Accounting engine | BLOCKED exit2: real Supabase/PostgreSQL adapter not implemented; no DB connection opened |

Accounting final command summary:13 PASS,0 FAIL,17 explicitly blocked future/policy requirements. WMS:9 PASS,2 FAIL,18 blocked (legacy DB adapter plus future/policy requirements). These are command/backlog slots, not counts of production acceptance cases. Required cases are mapped per phase; live provider operations remain separately prohibited, not a prerequisite to run preparation. No missing or zero-test slot becomes PASS.

## Independent gate decisions

Accounting PREPARATION→READY_FOR_HUMAN_EVIDENCE_REVIEW; M1→BLOCKED on service UID isolation, real queue/API boundary and fresh engine bootstrap. WMS PREPARATION/P01→BLOCKED on TypeScript, lint, unimplemented DB adapter and build-generated tracked-source drift; P01 also requires fresh engine bootstrap. All decisions explicitly carry phase_complete=false, codex_start_authorized=false and merge/deploy=false. Technical readiness for evidence review is not owner/accountant acceptance.

## Retained first run and safe corrections

First Accounting run on8d740d468595db14c2e2e2c7b7cad4d75925c6b4 also passed13 available commands/native suites. First WMS run on53bac96f790c152361a8e449d6db7d14fa95815c exposed nested `bun` not found (exit127) in the new runner; fixed by setting PATH to the selected pinned binary. Repeated full runs on the new commits passed91 WMS unit tests. TypeScript/lint defects were not fixed, suppressed or relabelled.

Actual WMS build regenerates src/routeTree.gen.ts (44 additions/1 deletion), so source_after is dirty. The full patch is retained. After capturing evidence, only that generated file in this disposable clone was restored to the tested source; no generated route patch/business source was pushed. The gate continues to reject the immutable dirty-source run. A reviewed route-generation/typecheck baseline fix remains WMS#12, lint debt remains#13. No broad formatting or compiler-rule weakening occurred.

## Environment and evidence retrieval

Actual Linux6.18.55 x86_64/glibc2.39, runnerPython3.12.14, native/buildPython3.14.8, Node24.19.0, Bun1.3.13, Ruff0.15.6, build1.4.0, flit_core3.12.0, packaging26.3, pyproject_hooks1.3.3. Native report includes all installed distribution versions and ERPNext/Frappe/MariaDB archive hashes. Both native suites use explicitly preseeded synthetic-only sites and loopback services, with ordinary database users and private files/HTTP controls. This replay does not prove fresh bootstrap, separate UID/mounts, real RQ/transport or full WMS/financial adapters.

`alternative-evidence/INDEX.json` lists each tested source, report and compressed full evidence archive with SHA256. Archives contain only whitelisted reports, redacted logs, gate invocations and listed artifacts. Tool HOME caches are excluded even if Bun recreates them after the runner exits. Native backup/config/key data is not exported. Verify hash, unpack with Python tarfile filter="data" into a new directory, then run verification/gate.py on the report's tested source SHA. Full lint logs are compressed, not discarded.

## Remaining G1–G6

G1: distinct OS identities/mounts, production proxy/TLS, key custody and full export/search/host boundary. G2: shipped scoped facade, real RQ/mutation/bypass, outbox transport and IC recovery. G3: UI/commercial bundle/dispatch/serial-batch/cancel races and complete stock/valuation lifecycle. G4: actual qualified Dutch accountant policy/golden review and native enforcement. G5: clean full engine/assets/business-schema/framework upgrades, dependency/security triage, off-host recovery/load and current WMS type/lint defects. G6: effective main protection, human evidence review and separate owner phase-start approval. These remain unchanged by alternative verification.

No real company data, migration, bank/payment/tax/Peppol/bol write, production deployment or paid service was used. GitHub remains the primary source and planning/PR system. All original PR holds remain.

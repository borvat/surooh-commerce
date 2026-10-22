# G0–G6 — exact disposition

| Gate | Status now | Evidence | Closure requirement |
|---|---|---|---|
| G0 verification path | HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED | Existing Actions billing-lock evidence preserved; use verification/run.py and gate.py | Independent exact-SHA commands/logs/artifact hashes and human evidence review; hosted Actions success is not required or claimed |
| G1 company/site/service/files/report/backup isolation | PARTIAL; OS identities blocked | Eleven local cases including V01–V07,A09–A12; capability errors retained | Non-root identities/mounts, config/key custody, production proxy/TLS, exports/search/prepared reports and host threat tests |
| G2 command concurrency/recovery/worker policy | PROTOTYPE PASS; integration held | A02–A04 and A08 | Shipped permissioned facade/outbox, real RQ/transport, bypass denial, mutation/revocation, cross-site IC recovery, reviewed alternative verification |
| G3 WMS bundles and one stock/valuation writer | PROTOTYPE PASS; end-to-end held | A05–A07; prior PR25 native sale/COGS/quarantine/transfer | Current WMS UI/native parent/fulfillment mapping, nested/serial/batch and cancel/dispatch races, native lifecycle and no duplicate invoicing |
| G4 Dutch fiscal | REVIEW PACK READY; NO SIGNOFF | Draft7 native tax cases and8 policy tests from PR25; official-source review matrix | Named qualified Dutch accountant policy/valuation/invoice review, signed goldens and native enforcement; no filings |
| G5 operations/security/upgrades | PARTIAL | Prior genuine ERP16.51→16.52, metadata-only app upgrade; restore rechecked | Fresh pinned build/SBOM/advisory triage, full app/framework upgrades and rollback, off-host backup/key recovery, sized load |
| G6 governance | DIRECTION APPROVED ONLY; EXECUTION HELD | Explicit owner message transcribed, identical authority contract and coordinated plans | Effective main protection, exact evidence review and separate owner start authorization. No merge/deploy/live-data approval |

Eight native mitigation verifiers and eleven isolation verifiers passed locally. Seven isolation cases repeat narrower prior checks. They are not19 independent production requirements. One retained failed attempt exposed fixture-key reuse; corrected final run is separate. Archived28 reference checks and offline integrity/policy tests are not native or hosted evidence.

Legacy WMS mapping: old G1 concurrency→G2/G3; G2 security→G1/G2; G3 workflow→G3/G5; G4 support/security/operations→G0/G5; G5 owner→G6. Tryton PostgreSQL remains unproven as fallback evidence, not a requirement to deploy a second active engine. No old gate is relabelled passed merely because the preferred direction changed.

Commerce baseline Issues#12 (TypeScript) and#13 (lint debt) are still open. The alternative run now executes full UI typecheck/lint/build: build passed, typecheck and lint failed. These remain C1/G5 blockers, not green from foundation tests. Fix only after a bounded authorized packet; do not disable rules or broadly reformat.

Fresh CI observation: Accounting run39689544956 startup_failure/zero jobs. WMS run39689565654 one failed job, runner_id0, zero steps; public annotation explicitly reports account locked due to billing issue. See CURRENT_CI_DIAGNOSTIC.json and GITHUB_REPAIR.md. No actual hosted test executed, and no billing/admin changes made.


Current owner decision: GitHub Actions remains blocked. No billing fix or repeated Actions reruns. The independent path is `verification/README.md`; G1–G6 and every unexecuted requirement remain open. Historical failure observations above are preserved, not reclassified successful.


Executed alternative path: see ALTERNATIVE_RESULTS.md and alternative-evidence/INDEX.json. Accounting PREPARATION is ready for human evidence review, M1 remains BLOCKED. WMS PREPARATION/P01 remain BLOCKED by actual type/lint/DB-adapter/source-drift findings. G0 retains HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED; no hosted retry/billing repair or other-gate waiver.

## Final G0 disposition

Hosted CI = BLOCKED (billing; historical failure retained). Alternative path = IMPLEMENTED_AND_EXECUTED; Accounting preparation technical result = READY_FOR_HUMAN_EVIDENCE_REVIEW; WMS preparation = BLOCKED. G0 is not jointly accepted: WMS defects and human evidence review remain outstanding. No stage-start authorization is implied. M1 and P01–P09/M2–M7 remain held. See FINAL_ACCEPTANCE.md and WMS_DIAGNOSTICS.md.

## Bounded source-quality remediation candidate

On independent branch remediation/wms-source-quality, tested3a7cfb73850ec89fd91822c5c0078ff985d25895: typecheck0, lint0 with15 disclosed warnings, build0/no tracked drift,100 unit cases PASS. See ../source-quality/RESULTS.md. Historical type/lint/route-drift failures remain preserved in old archives; the new clean candidate addresses them only at its tested SHA. SOURCE_QUALITY is READY_FOR_HUMAN_EVIDENCE_REVIEW; PREPARATION remains BLOCKED on the unimplemented DB adapter, P01 additionally on fresh bootstrap. No general G0 acceptance, G1–G6 waiver, Codex start, merge or deploy.

## Executed legacy PostgreSQL candidate — not accepted

At 6066f6a3fbb8f6edd2b6cadb8304b311e2e046bb: real PostgreSQL18.6 applied23 unchanged migrations;21 groups executed (19 PASS,2 FAIL). Adapter now exists; see ../postgresql-validation/RESULTS.md and FINDINGS.md. PREPARATION remains BLOCKED on native invariant failures, host identity isolation and real HTTP/JWT boundary; P01 additionally lacks fresh engine bootstrap. Local PG dump/restore is scoped evidence, not off-host/OS/production approval. G0 hosted Actions stays BLOCKED and G1–G6/Codex/merge/deploy holds are unchanged.


## Trusted-boundary bounded candidate

See ../trusted-boundary/DESIGN.md and RESULTS.md. DB-F01/DB-F02 are tested through an additive candidate command/identity boundary; original23 migrations and historical failed evidence remain unchanged. Independent plan now separates real candidate HTTP validation from deployed_wms_identity_integration (BLOCKED). PREPARATION remains BLOCKED on real host identity isolation and deployed integration; P01 additionally on fresh ERPNext bootstrap. A scoped TRUSTED_BOUNDARY review cannot authorize P01–P09/Codex or clear G1–G6. Hosted Actions remains BLOCKED; no rerun or billing change.

Final exact candidate source `6b637b698be0990a1b6dfe373ce071295fc51ee5`:17 executable checks PASS,0 FAIL,19 future/environment checks BLOCKED; native21+18 and WMS100 PASS, type/lint/build0,15 lint warnings retained. TRUSTED_BOUNDARY and SOURCE_QUALITY are READY_FOR_HUMAN_EVIDENCE_REVIEW only. PREPARATION BLOCKED (real OS identities, deployed WMS identity integration); P01 BLOCKED (same plus fresh ERPNext bootstrap). Full results and immutable archives: ../trusted-boundary/RESULTS.md. No owner acceptance or stage-start approval is inferred.


## Owner-authorized native integration experiment

PR20 findings are accepted as successful candidates for review only. The next bounded experiment uses fresh ERPNext16.52 sites and the paired Accounting lab API/guard app, plus the actual retained WMS service adapter. See ../native-integration/DESIGN.md, ACCEPTANCE.md and RESULTS.md. No P01–P09 or Codex start is authorized. PREPARATION/P01 remain BLOCKED on full rendered native WMS workflow/pick handoff, actual non-root service/storage/key isolation and other existing native/operations/governance acceptance. Fresh headless API installation is not full frontend/runtime/upgrade acceptance. Hosted Actions stays BLOCKED; no rerun/billing changes.

Native experiment exact source pair: WMS9827f7252d74849bba5dc5f130a4fc6d6e6d5d2c / Accountingf031a73e8ade3ed89c7eeda057566296a5fdc198. Fresh two-site native cases19 PASS/0 FAIL/1 BLOCKED (reserved-order Pick List handoff); WMS106, PostgreSQL21+18, type/lint/build/generated clean PASS; Accounting foundation/Ruff/app build PASS. Actual RQ, in-flight revocation, native replay/restart, DB/site/JWT separation and native qty/value/COGS/GL evidence now exist. Full rendered UI and real non-root service/storage/key isolation remain BLOCKED. PREPARATION/P01 stay BLOCKED; no stage-start approval. See ../native-integration/RESULTS.md and paired Draft PRs Commerce21 / Accounting30.


## Atomic pick / retained React candidate (current follow-up)

See [atomic-pick results](../atomic-pick/RESULTS.md), paired Draft PR22/Accounting31. Exact WMS920e3a12a0136ad51975c5a55dc5871645d5d7e3 / Accounting97c22b594fa37e2fe1e12458cf1a0f7edeec5432: native29 PASS/0 FAIL/1 browser BLOCKED; WMS109, PG21+18, type/lint/build/generated clean PASS;15 existing lint warnings retained. NI-F01 native handoff is a review-ready bounded candidate, not production acceptance. Existing screens are wired in synthetic mode and their services run against native HTTP; a rendered browser cycle is NOT EXECUTED. Actual non-root service/storage/key isolation remains BLOCKED. PREPARATION/P01, Codex/merge/deploy and all G1–G6 approvals remain held. Hosted Actions stays BLOCKED. Future packet in atomic-pick/NEXT_REVIEW_PACKET.md grants no execution permission.

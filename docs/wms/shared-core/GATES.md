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

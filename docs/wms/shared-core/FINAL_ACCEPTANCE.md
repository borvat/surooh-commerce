# Alternative verification completion — acceptance record

Original immutable run logs and archives survived the interrupted session. No engineering suite was rerun or invented. Remote inspection found both verifier code commits present but no evidence publication commit. Recovered archives were checked against their recorded SHA256 and every internal evidence-manifest file; report sidecars were checked too. Evidence publication changes documentation/artifacts only.

| Control | Disposition |
|---|---|
| Hosted GitHub Actions | BLOCKED; historical billing failure retained; no reruns or billing changes |
| Independent verification tooling | Implemented and executed; gate rejects stale SHA, altered evidence, missing/unexecuted cases; never grants authorization |
| Accounting PREPARATION | Technical evidence ready for human review; 13 PASS commands, no failed commands; future requirements remain blocked |
| WMS PREPARATION | BLOCKED: TypeScript exit2, lint exit1, DB adapter exit2/unimplemented, tracked route generation drift |
| Joint G0 | HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED; alternative path executed but joint acceptance BLOCKED |
| M1 and later Codex phases | BLOCKED pending required technical evidence and explicit owner approval; Codex not launched |
| G1–G6 | Remaining isolation/integration/fiscal/operations/governance gaps unchanged; see GATES.md |

Tested source revisions are Accounting a9400f6f4b9066f5487f16cd45268728920e5672 and WMS e0ba96bab66a43ba580fb13aec3675ea36def932. Later documentation/evidence commits are not claimed as tested application revisions. WMS started clean and became dirty during build; its immutable report and gate preserve that failure. Restoring the generated file afterwards does not cure that run.

Evidence retrieval: alternative-evidence/INDEX.json contains exact archive/report SHA256. Archives include command argv/cwd, exit codes, tool/environment versions, source identity, logs, artifact hashes and gate invocations. Verify archive hash, safely extract into a new directory, verify evidence-manifest.json, then use verification/gate.py from the tested source with that source SHA. Native WMS evidence links the Accounting run; it does not prove WMS UI/database integration. No fixture backups, credentials or runtime caches are published.

Review requirements: accept Accounting preparation evidence separately; authorize bounded WMS source fixes only in a future packet; require fresh clean-source WMS type/lint/build evidence and a real isolated DB adapter before its gate can advance. Separate OS identities, real queue/API bypass coverage, fresh bootstrap, full upgrades, real integration and Dutch accountant signoff remain outstanding. Main protection remains a governance gap; no administrative settings changed.

No merge, deployment, live migration, financial/tax/bank operation, paid service or functional development was performed. PR23/25/16 remain held. Closing/reverting these independent proposal branches is the rollback; production remains untouched.

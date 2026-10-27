# First completion delivery — native command recovery

The full WMS completion goal remains **OPEN**. This is a bounded implementation
delivery, not a complete warehouse release or ERPNext/browser acceptance.

Tested published source: `9eeb743027d0db0eb575fdc413cbb11cb32170bc`.
Source tree: `139d070c17f4d5c915231a801370a60d640c3bd4`.
The checkout was clean before and after the exact-source application checks.
Subsequent publication adds evidence and this report only.

## Delivered behavior

- Native HTTP commands have a 15-second default timeout covering headers and
  response body. A timeout reports an unknown outcome; it never claims rollback
  and does not retry a mutation automatically.
- Identical concurrent commands within the same session share one in-flight
  request. Reusing a pending request identity with different content is rejected.
  This is a client optimization, not a replacement for native idempotency.
- Clearing or replacing a native session aborts pending calls and prevents results
  from the old session being returned. Configuration is copied at registration.
- Failed token acquisition releases the pending identity; malformed command-result
  arrays are rejected. HTTP errors expose status without copying response bodies.
- Native order actions are disabled during a snapshot refresh. A failed refresh
  replaces both action buttons with a visible retry control. A mutation error
  invalidates the snapshot, since a lost response may follow a committed command.
- The current owner mandate and complete delivery criteria are recorded in
  [PLAN.md](PLAN.md). Historical start holds are preserved as history, rather than
  silently treated as current permission or a passing acceptance gate.

## Validation

| Check | Result | Scope |
| --- | --- | --- |
| Locked dependency installation | PASS | Bun1.3.13 frozen lockfile, no dependency/lock changes |
| Application tests | 120 PASS, 0 FAIL | 109 retained plus 11 new transport/render tests |
| Foundation tests under Node | 25 PASS, 0 FAIL | Existing gate/adapter contracts |
| TypeScript | PASS | Full existing application scope |
| ESLint | PASS: 0 errors, 15 existing warnings | No lint rules relaxed |
| Full client/server production build | PASS | Existing TanStack/Lovable build, not deployed |
| Extra harness checks | 14 Node helper + 8 Python browser-runner + 7 atomic-gate + 14 general-gate PASS | Earlier local commit with the identical source tree; not additional app/native coverage |
| Before-fix regression probe | 3 FAIL, 0 PASS as expected | New tests on unchanged baseline business code: duplicate dispatch, stale error controls, enabled controls during refresh |
| Real rendered B01 native cycle | NOT RUN/BLOCKED | No working browser executable and fresh marked native runtime |

Transport tests use actual loopback HTTP servers with fabricated bodies. UI tests
use React static rendering and a fabricated React Query cache. They prove neither
native engine effects nor browser/device behavior. Prior native29/PG21/HTTP18
results retain their historical scope and were **not** rerun here.

The first foundation command mistakenly supplied a directory to Node's test
runner. Its exit1/log are retained; the corrected explicit `.mjs` list passed25.
An initial logout test attached Bun's rejection matcher before the interruption
barrier; it was corrected to use an explicit outcome/barrier. The final test checks
actual in-flight cancellation, and the exact-source complete run passes.

## Remaining blockers and next work

The official installed Playwright Chromium downloader returned invalid/truncated
archives. Its automatic repeated attempts were stopped (exit130). The executable
preflight returns BLOCKED/exit2, zero executed scenarios. No failed browser check
is relabeled as a UI success. A clean browser executable plus the fresh marked
Frappe/ERPNext16.52.0/MariaDB11.8.9/Redis7.0.15 runtime and paired Accounting source
are needed to run the preserved B01 cycle.

Direct git cloning of the private Accounting repository requires authentication;
the connected GitHub tool can read it. This is a source-materialization/runtime
setup prerequisite, not a claim that Accounting is inaccessible through all tools.
No production environment was used to substitute for the disposable test system.

After B01, the full receiving/location/count/inspection/transfer/partial-shipment,
company-operation isolation, channel/provider integration, operational recovery
and accountant/fiscal criteria in PLAN.md remain open. This delivery neither
solves those workflows nor clears PREPARATION/P01/M1 or deployment acceptance.

## Evidence and rollback

[Receipt](evidence/receipt.json) identifies exact commands, exits and SHA256s.
[Archive](evidence/verification.tar.gz) contains raw logs, initial failures,
preflight output, source receipts and an internal MANIFEST.json. Extract only into
a new directory and verify hashes. Installer failure is recorded as an observed
tool result, not presented as a raw installer log capture.

Rollback is discarding this unmerged branch or reverting the scoped client and
component commit. There is no migration, engine/core patch or persisted stock or
ledger change. Existing main/PRs, production, live bol writes and paid services
remain untouched. No native stock or accounting writer was introduced.

<!-- project-memory-history-v1 -->

```json
{"event":{"blockers":["Accounting-owned persistent warehouse identity/profile/stock and linked invoice/credit APIs are not admitted.","No agreed shared write/restart window; required linked UI receipt\u2192shipment\u2192invoice\u2192partial return\u2192credit/restart cycle is NOT_RUN/BLOCKED.","Native invoice Manager fixture is not proof of minimal warehouse clerk privileges."],"deployment":{"status":"unverified"},"evidence":["docs/engineering-memory/evidence/repository-checks.json","docs/engineering-memory/BASELINE.json"],"id":"surooh-commerce-engineering-rollout-20261028","next_steps":["For product continuation, Accounting must admit reviewed native warehouse/financial contracts and a shared test window; for this task add engineering-memory activation and bounded resume references without altering those gates.","Review/persist this isolated engineering overlay; application acceptance remains separate."],"recorded_at":"2026-10-27T23:17:05Z","schema_version":1,"source":{"content_sha256":"c72a7ffcd72c39ca7bb659dde95dc1718a2614ab42ae3e898f2d9021742b2311","head":"4f3ba62633e513c5b08aa8cd3ec06f16dd702e60"},"status":"partial","summary":"Surooh WMS interface with retained catalog/Bol workflows and native ERPNext/Accounting warehouse authority. Architecture: TanStack/React UI and Node server modules; native warehouse commands and durable intent/projection helpers. Modules: src/lib/accounting-session.server.ts, src/lib/native-lab-client.ts, src/lib/native-stock-journal.ts. Selected PR33 integration/wms-auth-cycle-20261025 at4f3ba62633e513c5b08aa8cd3ec06f16dd702e60 (tree e7443f9485dbe311e24e0c748b80cee2a0482269). CURRENT.md says full WMS goal OPEN and new PR33 source NOT deployed. Its existing Render/native observations are historical; no new deployed/tested identity was verified by this memory task.","tests":[{"evidence":["docs/engineering-memory/evidence/repository-checks.json"],"name":"Repository-local engineering learning adapter","scope":"historical","source":{"content_sha256":"5fb78fc15d044cf5fba8b565b1a8d6d5b00a2bd047b790269b76365bcbd586b6","head":"4f3ba62633e513c5b08aa8cd3ec06f16dd702e60"},"status":"pass"}]},"event_digest":"59a509af95d6768ad80e2234a1912230577444fa1ab1842e8a2c9bc5beeb63b3","evidence_sha256":{"docs/engineering-memory/BASELINE.json":"3ba026cf1e36d54257f5e62542c3af1a60cec8ab22d1c830aaa70a138934047b","docs/engineering-memory/evidence/repository-checks.json":"a49a161223b9524583892bcdcc1710311b238beed3091a09df7cf31a5c09edbb"},"previous_digest":null}
```

```json
{"event":{"blockers":["Final ordinary-session/portfolio acceptance is still in progress; interrupted sessions are not PASS."],"deployment":{"status":"unverified"},"evidence":["docs/engineering-memory/evidence/reviewed-helper.json"],"id":"surooh-commerce-reviewed-helper-20261028","next_steps":["For product continuation, Accounting must admit reviewed native warehouse/financial contracts and a shared test window; for this task add engineering-memory activation and bounded resume references without altering those gates.","Review/persist this isolated engineering overlay; application acceptance remains separate.","Complete ordinary-session acceptance and preserve exact GitHub readback; product delivery remains separate."],"recorded_at":"2026-10-27T23:33:37Z","schema_version":1,"source":{"content_sha256":"ab0d6d5cef5c66301907346e5a87bd5d000b78d7f42a978080e709de84deecef","head":"4f3ba62633e513c5b08aa8cd3ec06f16dd702e60"},"status":"partial","summary":"Surooh WMS interface with retained catalog/Bol workflows and native ERPNext/Accounting warehouse authority. Architecture: TanStack/React UI and Node server modules; native warehouse commands and durable intent/projection helpers. Modules: src/lib/accounting-session.server.ts, src/lib/native-lab-client.ts, src/lib/native-stock-journal.ts. Selected PR33 integration/wms-auth-cycle-20261025 at4f3ba62633e513c5b08aa8cd3ec06f16dd702e60 (tree e7443f9485dbe311e24e0c748b80cee2a0482269). CURRENT.md says full WMS goal OPEN and new PR33 source NOT deployed. Its existing Render/native observations are historical; no new deployed/tested identity was verified by this memory task.","tests":[]},"event_digest":"e42e3e792ca42fc006e586f8fa4c6dd6a25549dd71d6fd3cb47b53ebb18775b6","evidence_sha256":{"docs/engineering-memory/evidence/reviewed-helper.json":"a9414f8b8ff25ea122281aaf746e869009356aedfd4d9852dcbb17959e7d9a52"},"previous_digest":"59a509af95d6768ad80e2234a1912230577444fa1ab1842e8a2c9bc5beeb63b3"}
```

```json
{"event":{"blockers":["Automatic approval review rejected Accounting/SAM remote tree payloads; same-scope large uploads remain paused. Full task is PARTIAL despite completed local engineering acceptance."],"deployment":{"status":"unverified"},"evidence":["docs/engineering-memory/evidence/final-status.json","docs/engineering-memory/evidence/ordinary-acceptance.json","docs/engineering-memory/evidence/parent-ordinary-readback.json"],"id":"surooh-commerce-publication-blocked-20261028","next_steps":["Obtain explicit approval for the reviewed engineering payloads to the named owned GitHub repositories and isolated feature/bmad-unified-memory-20261028 branches.","Publish with expected-head lease, open/update Draft PRs, and verify remote head plus changed blob identities. No merge or deployment."],"recorded_at":"2026-10-27T23:39:30Z","schema_version":1,"source":{"content_sha256":"f7671b0d5a45094333c5d88410181e6b547614f5b0c48519de565df065e89451","head":"4f3ba62633e513c5b08aa8cd3ec06f16dd702e60"},"status":"blocked","summary":"Surooh WMS interface with retained catalog/Bol workflows and native ERPNext/Accounting warehouse authority. Architecture: TanStack/React UI and Node server modules; native warehouse commands and durable intent/projection helpers. Modules: src/lib/accounting-session.server.ts, src/lib/native-lab-client.ts, src/lib/native-stock-journal.ts. Selected PR33 integration/wms-auth-cycle-20261025 at4f3ba62633e513c5b08aa8cd3ec06f16dd702e60 (tree e7443f9485dbe311e24e0c748b80cee2a0482269). CURRENT.md says full WMS goal OPEN and new PR33 source NOT deployed. Its existing Render/native observations are historical; no new deployed/tested identity was verified by this memory task.","tests":[]},"event_digest":"15c2c20466576b896726155f89851426d316425781b258dcc1c43e6d3dd17235","evidence_sha256":{"docs/engineering-memory/evidence/final-status.json":"0424f2d4a36861c1d1b45793507a2ea7534791b4d121214d6beb8532a213d101","docs/engineering-memory/evidence/ordinary-acceptance.json":"a292351d9912a54ea6e8ed3dd3276196b07b3822a036b1106a953381e2d10007","docs/engineering-memory/evidence/parent-ordinary-readback.json":"0f601d1a5921bd3c37efb59f4a9326f2ecf65842c346f5f6e43d9f42671d918f"},"previous_digest":"e42e3e792ca42fc006e586f8fa4c6dd6a25549dd71d6fd3cb47b53ebb18775b6"}
```

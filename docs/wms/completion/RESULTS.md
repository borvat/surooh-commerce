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

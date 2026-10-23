# Local native verification — 2026-10-23

Owner requested continued testing outside GitHub Actions. Two fresh disposable
ERPNext/Frappe16.52.0 runs each executed **29 PASS / 0 FAIL / 1 browser BLOCKED**.
The overall driver and exact-pair gate exit2: full WMS acceptance remains blocked.
These are repeated scopes, not58 distinct acceptance cases.

## Exact sources and limits

| Run | WMS source | Result / purpose |
| --- | --- | --- |
|01|`7fb1d79b289be1f5f2139ab3091cd207cb2f9e3c`|Fresh native regression of PR24, plus full app checks|
|02|`011c5380bf7e97f180798cc2428df17d61f7d7df`|Fresh rerun with strengthened real screen-command response-loss test; full lint rerun|

Accounting input is the native app and synthetic guard from canonical PR31 source
`34adb0e16be584b5e3823b2cb46a80abb5eaf869`. Direct private git clone was unavailable
without credentials; the connected GitHub reader supplied14 files. Their original
Git blob hashes were verified before and after execution. This is **not a full
Accounting repository checkout or full Accounting application acceptance**.
The local materialization commit recorded by the runner is
`0f878c11591c9707727c0d2f87de730086908a25`; source-materialization.json explains the
mapping. The initial materialization added a newline, failed its hash check and
was corrected to exact original bytes before either native run.

Both WMS and materialized Accounting checkouts were clean before/after each native
run. Original upstream sources were checked against the official archives; no
Frappe/ERPNext core or application stock/financial logic changed in this follow-up.
Later commits publish only reports and evidence.

## What actually executed

- Two fresh sites and databases per run, different synthetic credentials and
  encryption keys, no seeded restore, TEST-A/TEST-B data only.
- Native receipt and valuation; WMS service-created orders, shared-component
  reservations, atomic pick, packing, native Delivery Note, cancellation and
  linked return with replay.
- Stock value300→250 with balanced COGS50 at shipment, then300 with reversal50 at
  return. The actual screen-service cycle ends320 after an additional receipt20.
- Independent concurrent HTTP/DB sessions, shared-bundle shortage denial,
  pick/cancel and packed ship/cancel races, true SIGKILL rollback and new-process
  retry, lost response and HTTP-process restart recovery.
- Actual HTTP identity/revocation checks, native bypass denials, restricted SQL
  cross-database denial and real RQ execution-time role revocation.

The strengthened A09 uses the real `nativeOrderAction` client and native server.
Two concurrent screen calls share **one actual HTTP dispatch**. The test consumes
the real successful server response, then deliberately throws it away: both
callers see failure after the real native pick committed. It reads the persisted
Pick List independently, retries the same action and verifies the **same native
Pick List** is recovered. It then completes native pack/ship/return and checks
stock value/GL. No successful business response or engine mutation is mocked.
The response loss is deliberately injected in the client wrapper, not claimed as
a spontaneous network outage. Global fetch is restored in finally.

| Other checks | Actual result |
| --- | --- |
| Application unit/render/transport tests, run01 source |120 PASS /0 FAIL|
| Node foundation tests, run01 source |25 PASS /0 FAIL|
| Full typecheck and client/server build, run01 source |PASS|
| Full lint, both sources |0 errors;15 existing warnings|
| Native exact-pair evidence gate, both runs |No integrity/native errors; native candidate review-ready, rendered UI/operational gates BLOCKED; exit2|

These evidence types stay separate. Actual service calls are not rendered-screen
acceptance; static React renders are not device/browser acceptance. Native tests
exercise the bounded synthetic app and do not validate the production adapter,
complete endpoint matrix, full invoice/tax workflow or isolation of OS identities.

## Browser blocker and environment work

Python3.14.8, MariaDB11.8.9, Redis7.0.15 and pinned Python dependencies were
provisioned locally. No system services were installed or account settings changed.
Package-manager download failed on unavailable UID/group switching; official
Ubuntu snapshot packages were instead downloaded as files, SHA256-checked against
the existing package index and extracted into the owned test directory. No UID
spoofing or privilege/sandbox policy changes were used.

Official Google Chrome156.0.8078.47 was downloaded and its259 regular extracted
files checked against the package stream. An initially incomplete browser binary
was restored from that same package before final launch. Launch then failed with
`process_singleton_posix.cc:297 socket() failed: Operation not permitted`;
ptrace diagnostics were also denied. The Playwright CDN returned HTML
"Site Unavailable" instead of a ZIP, including for the headless-shell candidate.
No browser restriction was relaxed. B01 has **zero executed scenarios**, no
screenshots and no successful rendered UI claim.

The native runtime now works; the remaining browser prerequisite is an execution
environment permitting its normal local IPC. A running browser executable/version
check alone is not acceptance. A separate ordinary Linux test runner can replay
[REPLAY.md](REPLAY.md); no GitHub Actions dependency is necessary.

## Cleanup, evidence and remaining goal

Both owned database/Redis service shutdowns returned0. The runner reported private
root removal, but independent rechecks found an empty residual directory after
run01 and41 files under the owned synthetic root after run02. Both residual roots
were explicitly removed and absence checked; records are preserved. Do not treat
a cleanup flag, transient absence or this shared UID0 executor as operational
service/storage/key/backup isolation proof.
The final recheck again found an empty run01 directory and removed it; run02 was
absent. FINAL_CLEANUP.json retains that observation without claiming permanence.

[Native cases](NATIVE_RESULTS.json), [gate](GATE_STATUS.json) and
[archive index](evidence/INDEX.json) contain the exact sources, exits and hashes.
Archives contain allowlisted synthetic logs/results/manifests only; no bench,
site configuration, keys or database dumps are included. JWT/private-key pattern
scans found no unredacted matches. Runtime provenance records official archive
hashes, package versions and the materialization boundary.

The full project goal remains OPEN: rendered UI/device flows, complete operational
workflows, true service/storage isolation, channel/provider integration,
accountant/fiscal review and release/cutover remain unaccepted. PREPARATION/P01/M1
are not cleared by this run. Main, existing PRs, Accounting/SAM source, production,
live bol writes, paid services and hosted Actions were unchanged.

Rollback discards this unmerged test/evidence branch. The only test-source change
is the stronger A09 probe; there is no business-code migration or persistent live
data change. All injected failures affected owned synthetic processes/data only.

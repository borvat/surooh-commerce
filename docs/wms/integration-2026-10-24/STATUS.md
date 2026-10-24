# WMS / Accounting integration continuation — 24 October 2026

**Full WMS goal OPEN. No hosted WMS acceptance or release approval.**

## Sources and continuity

- Preserve WMS PR30, `2d55f99e45fe36f98bea451503cd07b2ab303ba8`.
- Paired continuation: WMS PR31 and Accounting PR40, both on
  `integration/wms-accounting-2026-10-24`; neither replaces an existing branch.
- Accounting PR40 starts at PR38 `05747ceb1fb5d8146082e81d4ad133a12b115c82`,
  restores the missing PR37 native warehouse modules, and incorporates concurrent
  PR39 `429671f4820771b71cc948ea5706d73edf87c10e` as a second parent.
- Current Accounting code candidate: `87e1b9709db214351c606aa1f99927ba99b059f7`.
  All 212 current Accounting app, workbench, native guard and test files were
  independently checked against their GitHub blob hashes: zero missing/changed.
  Historical binary evidence/Git history is not a local full repository checkout.
- BORVAT last inspected PR34 `a595b3c3996743b3ebb9b86ba97f532f61d47e6a`
  remains **UNACCEPTED with this new combined app**. No compatible three-app
  release set has been established. Earlier selected bridge tests are not reused
  to certify the new workbench hooks.

ERPNext remains the only reservation, stock, valuation and financial authority.
`contracts/shared-core-authority.json` is identical in WMS and Accounting.

## Changes and architectural decision

PR38 contained the earlier warehouse API and lacked closing, scanner, shipping
and stock-operations modules. Retaining only PR37 would instead lose workbench
functions. The isolated continuation retains both and leaves main hooks inert.

Co-installation also exposed incompatible synthetic site/DB guards. An explicit
`wms-accounting-v1` profile now requires both app flags, equal TEST-A/TEST-B company
bindings, the integration environment opt-in, a marked test site/DB pair and a
closed installed-app set including the native stock guard. Neither public hosting
nor a production profile is enabled by these changes.

Native financial submit/cancel executes inside a temporary voucher/company/actor
scope. The stock guard can accept only that voucher's native GL Entry while the
scope is active; stock documents, SRE/SLE, another voucher/company/actor and direct
unscoped GL remain denied. Native permissions, independent reviews, period/link
checks and the engine's submission/cancellation still run. Scope is removed on
exceptions; nested scopes are denied. This is not a new GL writer.

The opt-in WMS runner installs the full invoice app on both freshly created WMS
sites **before** executing warehouse cases, then runs twelve original Accounting
HTTP programs on the same TEST-A database. Reusable native invoice fixtures are
shared with the original bootstrap. Original assertions remain intact. Accounting
test programs accept an explicit optional synthetic test site; application guards
and CSRF remain active. The original browser's viewport matrix now includes
320px as well as 390/1440px; adding an assertion is not executed visual proof.

The shared runner requires real built Frappe website assets. It does not fabricate
an empty asset map or replace successful business responses.

## Observations so far

- Run01: BLOCKED by extracted-file integrity; one truncated Frappe file was
  recovered from the verified official archive. A truncated MariaDB executable
  was also recovered before the next runtime attempt. All 4,141 Frappe,
  5,518 ERPNext and 22,614 MariaDB regular files then matched their archives.
- Run02: FAIL, invoice app missing from bench `apps.txt`; runner corrected.
  Sources changed during preparation; this attempt is not final acceptance.
- Run03: both full apps installed on both fresh sites; all 55 original WMS
  native/HTTP/DB/race/recovery cases PASS. B01 BLOCKED at Chromium launch by the
  host's Unix-socket restriction. All eleven original Accounting HTTP programs
  FAIL at the workbench-page HTTP500 boundary; no invoice success is inferred.
  This run predates integration of PR39 and does not certify the current source.
- Current offline Accounting: 150 invoicing/policy tests, seven recovery-envelope
  tests and four actual-script/fake-transport UI regressions PASS. These are not
  native/restore/browser acceptance. The repository foundation check fails in
  the partial historical-doc materialization; 24 other foundation cases, 28
  reference examples and six shared-core model tests pass. No weakened checker.
- WMS: 159 application tests, 25 foundation, 14 evidence-validator, 10 browser
  configuration and 14 browser-helper tests PASS. Type/build pass; lint zero
  errors with 15 retained warnings. Transport/mock checks are separate from
  native outcomes. App code is unchanged from PR30; runner changes are separate.

## Final fresh source-bound run05

Full co-installation on two freshly created native sites succeeded. All 55 WMS
native/HTTP/DB cases PASS with both app hook sets installed. All twelve original
Accounting HTTP programs PASS (303 recorded assertion PASS lines): invoices,
receipts, purchases/supplier returns, quotations, bank import/matching, credits,
supplier payments, payment cancellations, invoice/credit cancellations, bank-line
cancellations, customer/service → quote → discounted invoice → PDF/private mail →
partial/full receipt → credit, and financial reports tied to the same native GL.
No live bank, SMTP, carrier, PSP or production data was used.

The stock profile remains restrictive. Original bank acceptance seeds native
Bank Entry Journal Entry references inside a voucher/company/actor-bound financial
scope under the marked synthetic fixture Administrator. That helper is not an app
endpoint. It does not set the stock-command flag, write GL directly or weaken any
bank matching or native permission assertion. Ordinary unscoped GL stays denied.

Tested code group: WMS `874d2019690234e62b3498278965d3161674267e`
(tree `740077372666ba1f2ea25e187a4414db26385df2`, exact full local tree match),
Accounting `87e1b9709db214351c606aa1f99927ba99b059f7`
(all212 app/guard/test blobs matched). Local execution witnesses and artifact
hashes are in [RESULTS.json](RESULTS.json). Sources were clean and unchanged
before/after the run. The original exact-pair gate reports no integrity errors
and READY_FOR_HUMAN_EVIDENCE_REVIEW for the native candidate; UI/operational gates
stay BLOCKED (exit2). A first gate invocation used incorrect source arguments and
was rejected; the retained final invocation uses the exact SHAs from the runner.
Later continuation commits change reports only.

B01 remains BLOCKED at Chromium launch (`socket() failed: Operation not permitted`).
No workflow screenshot or desktop/390/320 visual acceptance is claimed. Outer
bootstrap correctly exits2 / PARTIAL_NATIVE_EXECUTED; passing backend programs
are not an overall acceptance PASS. Native MariaDB/Redis children shut down with
exit0; the runner reports removal of the private fixture. The final delivery
performed a separate filesystem cleanup/readback: zero owned private fixture
directories remain, recorded in RESULTS.json.

Run04 is retained as a partial predecessor:55 WMS PASS, B01 BLOCKED, nine original
Accounting programs PASS and two bank fixture programs FAIL. Current run05 fixes
that native journal fixture conflict and adds the original financial report suite.
See [REPLAY.md](REPLAY.md). Raw logs, credentials, private configs, PDFs and database
backups are not published in this public WMS repository.

## Render, dependencies and remaining acceptance

The current Render connection returned `no workspace selected`. Its workspace
inventory exposed only `Sam's workspace`; the owner explicitly selected **another
workspace**, without identifying it. No service inventory or mutation was made in
the rejected workspace. Prior reports are not current service discovery.

A separate Git branch `deploy/isolated-render-test-20261024` at
`6796970262f3bf8453c7c411560179f0494a3bf2` documents an existing
`surooh-wms-isolated-test` service. Its public `/auth` URL was independently opened
and returned HTTP200; the actual1363×936 browser shows an Arabic RTL QNAN login
screen with no document overflow. No login or user data operation was attempted.
That public page does not expose its deployment commit, DB or native session
binding. No authenticated/native workflow or mobile acceptance is inferred. The
current deployment source/storage still requires authorized workspace inspection.

Required next environment step: identify/connect the intended Render workspace,
then inspect any WMS service, deployment source and isolated persistent storage.
Do not substitute the Accounting free/resetting preview or BORVAT demo as WMS
acceptance. No new resources, plans, keys or costs were changed in this session.

The current synthetic-only clients are still loopback restricted. A hosted path
requires scoped authentication/permissions and durable isolated company storage;
removing the guard or exposing fixture JWTs is not a deployment solution.

Still open: full PO/discrepancy/staging/putaway workflow; owner/location hierarchy;
catalog administration/UOM/batch/serial/expiry; arbitrary per-line partial picking
and multiple parcels; carrier sandbox/labels/webhooks; formal return/count review;
independent WMS-action Marketplace reconciliation; full three-app purchase through
return/credit/value reconciliation; current-source restore, service isolation and
hosted persistence; actual desktop/390/320 visual/RTL/keyboard QA and physical
camera/scanner acceptance. No predecessor results certify these gaps.

## Review, deployment and rollback

Keep PR31/PR40 as drafts. Review the native profile and voucher scope before any
hosted identity expansion. Freeze a source group; execute all three complete app
suites and browser cycle on that group; reconcile IDs/SRE/SLE/GL/value and approved
synthetic provider effects. Prepare persistence/restore and operational identity
proof before considering hosted acceptance. Native fixture creation is not an
existing-data migration or production rollout.

Rollback discards/reverts these isolated continuations. Existing PR30/PR38/PR39,
main, production and the upstream engine remain unchanged. A future hosted
rollout must retain a source/data backup and a tested restoration path; no such
rollout is performed or claimed here.

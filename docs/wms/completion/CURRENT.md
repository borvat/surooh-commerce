# WMS continuation — 25 October 2026 (Asia/Damascus)

**Full goal OPEN. No accepted hosted WMS, production release or complete
shipment/invoice/credit cycle. This is the single current continuation record.**

## Source group and preserved concurrent work

- WMS PR32, branch `completion/wms-20261025`, based on PR31
  `668eab9a68ed365d50630f6983924e6951b6d875`. Tested application
  `507c6f509356ee8a0a971575375188e88b489916`, tree
  `cb6263ef954fd40b6b1ba3ebaac685c79da9fcae`. Later report commits change docs only.
- Accounting original canonical input `f03dd2fc26fd71cee461feda7853ed3bbb5ab223`:
  exact239 app/guard/test/metadata blobs materialized and independently verified
  by Git blob hashes. Local witness `8ddd3e8b021f3554264b1901d7ee761c263c43ca`
  is NOT a canonical Accounting commit or complete repository checkout.
- Accounting local proposal witness `fea52a54aab97e0d5be288d01ab2928249b5fbb0`
  differs only by one test-site selection line in
  `validation/invoice_workbench/local_testing/delivery_checks.py`. Its explicit
  `INVOICE_LAB_SITE` must take precedence over the standalone derived site.
  No application guard, authentication assertion or native source is altered.
  The private proposed patch is `accounting-delivery-site.patch`; it has not been
  applied to any Accounting remote branch or service.
- Concurrent Accounting PR43 advanced to `5f77e2dee6ebc985acd6d074a70e7138dfd6726b`.
  Independently compared: only persistent_start.py and persistent_restore.py
  changed after f03dd2fc. Preserve both changes; this WMS run does not execute or
  certify either changed deployment helper.
- Engine tag refs independently read from official Git repos: Frappe16.52.0
  `4515014c87ece6cb20ee91d2cfb121c5cbd1ff4a`, ERPNext16.52.0
  `90cb7f9243048a44311777d60a1cec8ca05ceec9`. Every regular file from all three
  pinned Frappe/ERPNext/MariaDB archives was checked by the original runner.
  Local MariaDB11.8.9, Redis7.0.15, Python3.14.8, Node24.22.1, Bun1.3.13.

## Changes and exact-source checks

1. CSV reader rejects duplicate/empty normalized headers, malformed quoting and
   missing/excess fields with physical row numbers. Retains BOM, quoted delimiters,
   escaped quotes, multiline cells and valid empty trailing fields. It is shared
   by legacy imports and bol export parsing; no live bol call was made.
2. Import UI invalidates old file state before reading and ignores superseded
   asynchronous reads. Check/apply prevent file replacement while active. Read
   errors are visible; no malformed file can retain an earlier Apply result.
   This does NOT add a native ERPNext item import API; that remains missing.
3. Native stock operations persist frozen intent before dispatch in sessionStorage,
   keyed by native endpoint, TEST-A and verified signed-in actor. No JWT, password,
   stock balance or execution receipt is stored. A same-tab reload restores the
   request ID/body; explicit replay queries native idempotency before effects.
   Storage failure/corruption blocks dispatch; a different unresolved identity
   cannot replace the pending one. Acknowledged commands may be cleared only
   after refreshing current native stock. Closing the browser tab is not a
   durable recovery guarantee. Definitive rejected-command resolution still
   needs the proposed native status contract; do not delete an unresolved intent
   merely to submit a new identity.

Final actual exit0 checks on code507c6f50:170 application,25 foundation,14 evidence
validator,10 browser-config and14 browser-helper tests; TypeScript/build PASS;
lint0 errors/15 retained warnings. Independent Accounting150 policy/mock,7 recovery
envelope and4 actual-JS/fake-transport cases PASS. These are separate tiers and
are not native/browser acceptance. Commands/exits/log hashes are in
[RESULTS-20261025.json](RESULTS-20261025.json).

## Fresh native results and retained failure

| Attempt | WMS | Accounting HTTP | Browser | Outer result |
| --- | --- | --- | --- | --- |
| run01, predecessor WMS5f64f121 / unmodified Accounting subset |55 PASS|Not coinstalled|BLOCKED|exit2|
| run02, WMS507c6f50 / original Accountingf03dd2fc subset |55 PASS|11 PASS /1 FAIL|BLOCKED|BLOCKED /exit2|
| run03, WMS507c6f50 / local test-only proposal |55 PASS|12 PASS /306 assertion PASS lines|BLOCKED|PARTIAL_NATIVE_EXECUTED /exit2|

The original delivery_checks.py ignored the explicit shared site and tried logging
into nonexistent invoice-lab-RUN_ID instead of wms-native-a.invalid. Its first
login failed before any lifecycle assertion. Other eleven original programs
passed. The unmodified-pair gate remains BLOCKED. The one-line local proposal
was tested in a fresh copy/site pair, preserving every original assertion; its
native gate has zero integrity errors and recommends evidence review only.
It does not certify unmodified remote Accounting or its current hosted service.

The full invoice app and native stock guard were installed on BOTH fresh sites
before WMS tests. Original native55 includes last-unit/bundle competition,
pick/cancel/ship races, old snapshots, worker kill/rollback and committed-response
loss, proportional batches, quarantine returns, counts and direct cross-site
HTTP/SQL/file denial. Twelve original Accounting programs ran on the same TEST-A
DB after warehouse tests, including discounts, PDF/private mail, receipts/credits,
purchases, quotations, bank matching/reversals and native reports. This is bounded
co-installation proof, not automatic linkage of a WMS shipment to its own invoice.

Example current native audit: receipt MAT-STE-2026-00001 creates C1=10/value100 and
C2=10/value200; shipment MAT-DN-2026-00001 consumes C1=1/C2=2, balanced COGS/stock50;
return MAT-DN-2026-00002 restores quantities/value and reverses those native GL
amounts. Exact synthetic results are in JSON. No second ledger, real payment,
SMTP, carrier, bol mutation or production data was used.

Chrome151 downloaded from official Google origin after the standard installer
returned truncated archives. Actual launch fails at Unix socket creation with
Operation not permitted. No internal screen,1440/390/320 screenshot, keyboard,
RTL or device workflow is claimed. No restriction was bypassed.

Both source trees remained clean and unchanged during final runs. Owned MariaDB
and Redis stopped with exit0. Independent filesystem review found a run02 private
fixture remaining despite its removal report; it was identified against that
run's exact datadir and removed after verifying service shutdown. Final independent
readback: zero owned fixture directories. The discrepancy's cause is unresolved;
runner self-report alone is not accepted as cleanup evidence. Raw logs, configs,
credentials, database files and backups are not published in this public repo.

## Verified Render mapping and safe access

Workspace `tea-db35rbflot8c739g8rhg` = Sam's workspace / ceo@suroohholdings.com.

| Resource | Observed actual state | Scope |
| --- | --- | --- |
| WMS srv-dbe28f7f3r2c73cfhe0g |deploy/isolated-render-test-20261024, live2a1adc7dfc531a13678498745c388e6ef2fe672a, dep-dbe28g7f3r2c73cfhgm0; free/no attached disk/auto-deploy OFF|Not changed|
| Accounting TEST-B srv-dbei3l0ae00c73d7mo80 |Latest observed live5f77e2de, dep-dbeir0qvcj2c73d3imbg; separate disk dsk-dbei4avb9u1s739ptmig|Concurrent Accounting work; not changed by WMS|
| Accounting TEST-A srv-dbe286vb9u1s73bu9g5g |Existing isolated Accounting service; prior free/resetting candidate|Not restarted, migrated or modified|
| WMS evidence Postgres dpg-dbcj5o7b9u1s73brr9bg-a |Evidence database, not the native MariaDB tested here|No connection opened|

Existing URL: https://surooh-wms-isolated-test.onrender.com — older application,
NOT an accepted native WMS deliverable. Its external database mapping is not
established merely from the service inventory. Do not substitute SAM's service
or database. No Marketplace or SAM resource was used or changed.

The current native client deliberately accepts loopback HTTP/TEST-A only; its
JWT/test-site binding is incompatible with treating a persistent invoice-workbench
login as a hosted WMS session. The public WMS form is the older Supabase login.
Do not paste native JWTs, signing keys, Accounting passwords or a SAM bearer there.
No ready secure hosted WMS login is claimed. Local acceptance generates its own
private synthetic credentials and passes tokens only through private process input.
See [coordinated hosted contract proposal](HOSTED-CONTRACT-PROPOSAL.md). It specifies
same-origin authenticated sessions, per-user/company native binding, server-only
secrets, native status reads, compatibility gates and rollback; it is not enabled.

## Remaining scope and next executable work

| Area | Implemented/evidenced boundary | Next required work |
| --- | --- | --- |
| Catalog/import/UOM |Native read projections; structural CSV validation|Native authorized administration/import and conversion contract; batch/serial/expiry scope|
| Locations/receiving |Native warehouses/quarantine, receipt, transfer/count|PO links, shortages/damage/discrepancies, putaway and complete owner/shelf/bin hierarchy|
| Fulfillment/bundles |Native reservations, scans, proportional batches, cancel/close/ship and component races|Arbitrary line/fraction splits, multiple parcels, actual device/scanner QA|
| Return/count |Native quarantine/release and stale-count protection|Formal independent approvals, partial-DN return, inspection/disposal|
| Accounting |Native stock/value/GL plus coinstalled invoice-workbench tests|Adopt/retest proposed test fix; same-order shipment→invoice→partial credit reference reconciliation|
| Marketplace |Retained contracts; not executed in these runs|Freeze its actual full candidate and verify origin/review admission and independent WMS reconciliation|
| Identity/UI |Synthetic JWT/site/DB denial proofs|Coordinated hosted operator contract; current1440/390/320/RTL internal UI and permissions|
| Durability |Native worker/response recovery|Current-source hosted restart/redeploy/container retention, independent backup/key escrow and restore; service/owner/load isolation|

Do not overwrite the Accounting developer's current5f77e2de work or use the resetting
free service as a persistence substitute. Before any shared contract/schema/hosting
change, agree the exact paired candidate and test in a separately owned target.
The proposed Accounting correction was not published remotely: automatic approval
review rejected writing it to that repository because authorization covered a
proposal, not changes to the Accounting developer's path. The private review file
and local evidence are the safer completed alternative; no permission bypass.

## Replay and rollback

Use docs/wms/integration-2026-10-24/REPLAY.md and the original bootstrap with the
exact code507c6f50 and independently verified Accounting app/guard/test source.
For original remote behavior, do not apply the proposal: expect delivery suite
failure. For the proposed comparison, change only the test's site selection to
honor existing INVOICE_LAB_SITE and retain standalone fallback; record that patch
and its local witness separately. Use --with-accounting-workbench and fresh output,
original built Frappe assets, verified upstream archives and private synthetic
credentials. Do not relabel an outer exit2 as success or reuse predecessor passes.
Run atomic_gate.py with the actual recorded WMS and local Accounting witness SHAs.

Discard/revert WMS PR32 to return to PR31; no schema/data rollback is needed for
these client changes. Pending journal metadata must be reconciled against native
idempotency before clearing; reverting frontend code does not undo a native
transaction. Do not restore native data by replacing it with a fixture database.
There was no deployment, main merge, paid-resource change or new cost from this
WMS work (USD0); earlier shared approvals are not a new WMS budget.

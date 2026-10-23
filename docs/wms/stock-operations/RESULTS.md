# Native storage, counts and quarantine returns

Paired Drafts: [WMS26](https://github.com/borvat/surooh-commerce/pull/26) and
[Accounting34](https://github.com/borvat/surooh-accounting/pull/34). The owner's
completion mandate permits engineering continuation; these results do not establish
production readiness, fiscal review or release acceptance.

## Exact executed source

- WMS full checkout: `1bc18be3391878daebd4e5d8c3c30b494a83e31d`, tree `c823c15321eb288a8efddf16835cdaedaffa464f`.
- Accounting canonical source: `68b4de0a5b6153153fb3feba52257a7274c820d6`.
- Executed Accounting partial materialization: `ae990cf63a67b95f80a90682c788cff4f76a82da`.
  [The source map](ACCOUNTING_SOURCE_MAP.json) verifies all15 app/guard/metadata
  blobs against the canonical tree. This is not a full Accounting checkout or a
  full Accounting/invoicing/foundation acceptance run. Concurrent invoice work is retained.
- Source status was clean before and after both the final native and application runs.
  Evidence-only publication follows these executed commits; replay the tested source.

## Changes

Native Warehouse locations include storage and quarantine. Stock Entry Material
Transfers move only unreserved stock between active company leaf warehouses.
Stock Reconciliation posts physical count differences using native valuation/GL,
with a native comment for reason/operator and command metadata for no-change counts.
Counts require both the captured quantity and the native ledger revision: out/in
movements cannot hide behind an unchanged final quantity. Existing native valuation
is retained; a positive explicit cost is required if no valuation exists.

Full customer returns from the orders UI go to a rejected/quarantine warehouse
using a linked native Delivery Note return. A new command key cannot return the
same outgoing delivery again. Stock reaches the fulfillment warehouse through a
separate reasoned transfer after inspection. The screen shows the confirmed native
return document. This is a full-return candidate, not a partial-return/disposal or
approval-workflow implementation.

Arabic controls capture the count-start baseline and preserve the sent key/body
for response-loss retries. Failed/refreshing projections disable writes. The normal
inventory projection continues to use the fulfillment warehouse only: storage and
quarantine are not added to sellable supply. The separate guard also covers native
Warehouse and Stock Reconciliation mutations. ERPNext is the only quantity/value/GL writer.

## Executed checks outside Actions

| Check | Result | Scope |
| --- | --- | --- |
| Fresh unpatched Frappe/ERPNext16.52.0, two sites/DBs | 38 PASS,0 FAIL,1 BLOCKED | Original29 native cases plus O01–O09 |
| Application tests | 131 PASS | Transport, projections, React static rendering and retained regressions |
| Foundation tests | 25 PASS | Structural/unit checks |
| Evidence validator | 8 PASS | Missing O coverage cannot inherit the old29 successes |
| Browser mechanics/configuration | 14 +8 PASS | Harness mechanics only, no rendered acceptance |
| TypeScript/build/lint | Exit0 | Lint retains15 existing warnings |
| Rendered browser B01 | BLOCKED, zero executed scenarios | Chrome local IPC socket denied; outer native exit2 |

[Native results](NATIVE_RESULTS.json), [application checks](APPLICATION_CHECKS.json)
and [gate status](GATE_STATUS.json) retain the actual results. The native evidence
validator reports no integrity errors and a candidate ready for human evidence
review. Its historical start/phase booleans do not override the current owner
engineering mandate and do not grant technical/fiscal/release acceptance.

O02 moves2 units/value20 from base12/value120 to storage without changing total
quantity/value, including exact-key replay. O04 blocks transfer and counting of
reserved stock. O05 counts storage2/value20 to1/value10 with native debit10/credit10
and rejects stale quantity. O06 uses different actors and simultaneous HTTP/DB
sessions for the last unit into a new Bin: exactly one transfer commits. O07 posts
return debit50/credit50 into quarantine, deduplicates another key and increases
base stock only after the separate transfer. O09 performs real in/out movements,
restores the same quantity, then rejects the old ledger revision without a count.

## Failures found and retained

The development archive preserves runs01–06. Run01 found expectation/fixture
problems and a real first-Bin race. Runs02–04 isolated the race: after a duplicate
native Bin insert, a repeatable-read snapshot could not see the winner; Frappe
masked the missing Bin as a Guest permission error. Existing Warehouse rows now
serialize native Bin creation and current locking reads obtain the committed Bin.
The same helper covers original receipt/order/fulfillment commands. Per-warehouse
serialization is deliberately coarse; throughput/load acceptance remains open.
Run05 was a clean local precursor with37 PASS/0 FAIL/1 BLOCKED. Run06 is development
only: sources changed during the run and its new O09 fixture sent a Python float
where a whole integer was required. Corrected O09 and all38 cases passed in final07.
None of those exploratory results substitutes for the final exact-source run.

## Remaining goal and operational limits

The adapter remains explicitly synthetic, loopback and TEST-A only, with a trusted
lab administrator boundary. Production identity/least privilege, separate non-root
services/storage/keys, scanner/device work, partial fulfillment/returns, serial/batch,
formal inspection/disposal, channel integration, complete restore/upgrade/load,
accountant review and release/cutover remain open. New browser selectors/forms are
prepared but unexecuted. Main, production data and live bol writes remain untouched.

Both owned final services shut down with exit0. External checks nevertheless found
residual test-root files after the runner's removal report, including525 files for
final07; the owned roots were removed explicitly. [Cleanup observations](CLEANUP_OBSERVATIONS.json)
record transient absence only. They do not prove operational service/storage isolation.
Archives contain only synthetic reports/redacted logs, with verified SHA256 manifests;
no bench/site configs, credentials, private files or database dumps are exported.

Rollback discards the unmerged paired branches or reverts their scoped changes.
No production migration or cutover occurred. See [replay](REPLAY.md).

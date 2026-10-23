# Surooh WMS completion mandate — 2026-10-23

Owner request in the current conversation: take ownership of completing the WMS
with full engineering delegation and professional delivery. This authorizes
implementation, investigation, isolated testing and publication of reviewable
changes without asking for routine implementation choices. Historical preparatory
start holds do not prevent this work. It does not turn missing evidence into PASS.

Starting point: WMS PR23 `78fd27d95e8110ab1fd18250263982189c7d4ad7`;
paired Accounting PR31 `34adb0e16be584b5e3823b2cb46a80abb5eaf869`.
The existing code, migrations and evidence remain preserved.

## Delivery criteria

| Workstream | Required result | Current evidence / remaining work |
| --- | --- | --- |
| Engine authority | ERPNext owns stock, reservations, valuation, COGS and GL; no second ledger | Existing native synthetic evidence; production adapter and cutover unproven |
| Receiving and locations | Receipt, putaway, locations, counts, adjustment audit and shortage handling | Native receipt/storage/transfer/count/quarantine-return candidate:38 native PASS; production, partial flows and device acceptance remain open |
| Fulfillment | Reserve, pick, pack, ship, cancel, return; correct component bundles | Retained29 native +9 storage/count/return +3 scanner cases pass; proportional partial-shipment candidate under verification; rendered B01 remains open |
| Operator experience | Arabic screens, scanner workflow, errors, retries, permissions and mobile use | Retained React screens; first delivery addresses stalled/duplicate native requests and stale action recovery |
| Identity and boundaries | Separate legal-company sites, services, storage, credentials and permissions | Native site/DB evidence exists; actual operational isolation incomplete |
| Channels | Authorized bol imports, mapping, reconciliation and shipment/label contracts | Existing read-only integration; real connector end-to-end acceptance required |
| Accounting | One native movement/value trail, returns and reconciliation | Paired Accounting candidate; fiscal/accountant and full invoice scenarios remain open |
| Operations | Reproducible pinned runtime, backup/restore, upgrades, monitoring and recovery | Dependency installation/build reproduced; complete native runtime provisioning and browser unavailable here |
| Release | Reviewed exact-source acceptance and reconciled rollout/rollback | No production readiness or release acceptance yet |

## First delivery: native command recovery

The native client previously allowed indefinite fetch/body waits and concurrent
identical dispatches. Native order controls could keep stale actions after a
failed refresh, with no visible recovery control. This candidate adds bounded
requests, in-flight coalescing, session invalidation and explicit refresh recovery.
No automatic mutation retry is introduced. Retrying an existing action retains
its existing command identity; the engine still decides idempotency and effects.

Transport tests use real loopback HTTP with fabricated responses; UI tests render
React with a fabricated query cache. Neither establishes ERPNext, browser,
database, warehouse-device or production acceptance. Timeout/abort means the
result may be unknown, not that the engine rolled back.

## Execution sequence and blockers

1. Preserve and verify the existing source and locked dependencies.
2. Deliver and test the bounded recovery fixes.
3. Provision a fresh marked synthetic ERPNext/Frappe16.52.0 runtime and paired
   Accounting source; run native B01 from the real screens with a working browser.
4. Close receiving/location/inspection/transfer/count/bundle/partial-shipment gaps
   using native documents and concurrent/recovery tests, extending the UI as needed.
5. Complete company isolation, channel integration and operational/fiscal review.
6. Review release evidence, rehearse reconciled migration and rollout/rollback.

Browser installation was attempted through the installed Playwright official
installer; its downloaded archives were invalid/truncated. It must remain an
unexecuted check. No arbitrary browser, package substitution, production data or
permissions change is a substitute. The existing fresh-native runner also needs
the marked runtime documented in `verification/native_integration/BROWSER.md`.

Rollback for the first delivery: revert its scoped client/component changes or
discard the unmerged branch. No data migration or native engine change is present.
Keep live bol writes disabled and preserve main and existing PRs.

## Verification update — 2026-10-23

The native-runtime prerequisite above was subsequently provisioned and tested.
[Local native results](../local-native/RESULTS.md) record two fresh runs, each29
PASS/0 FAIL/1 browser BLOCKED. The latest A09 uses real screen-command coalescing,
discards a real committed response and recovers the same native pick on retry.
Browser launch now has a concrete local IPC permission blocker; it is no longer
accurate to describe the native engine as unavailable here. Full delivered goal
and operational/fiscal/browser gates remain open.

## Storage/return delivery — 2026-10-23

[Stock operations](../stock-operations/RESULTS.md) records the paired WMS26 /
Accounting34 candidate: locations, unreserved transfers, counts using captured
quantity/native ledger revision, and full returns into quarantine with separate
inspection release. Final fresh runtime:38 PASS/0 FAIL/1 browser BLOCKED.
Application131, foundation25, gate8, mechanics14/config8 and type/build/lint pass;
15 existing warnings. Failed development probes, native Bin creation race,
source mapping/cleanup limitations and replay are preserved. No full goal or
production acceptance is claimed. Next independent gaps include partial
fulfillment/returns, scanner workflows and formal inspection/disposal; production
identity/isolation, channel/device/browser/fiscal/operational review remain open.

## Scanner delivery — 2026-10-23

[Scanner picking](../scanner-picking/RESULTS.md): WMS27 / Accounting35 adds
barcode/SKU entry, undo, complete component-count checks and trusted native pick
audit. Forged comments cannot relabel manual picks. Final clean native41 PASS/0
FAIL/1 browser BLOCKED, including different-actor concurrent replay. Application139,
foundation25, validator9, mechanics14/config8 and type/build/lint pass;15 existing
warnings. The operator-input path is implemented; actual browser/device/mobile
acceptance remains unexecuted. The full goal, partial flows and production/fiscal/
operational gates remain open.


## Proportional shipment batches — 2026-10-23

This candidate adds explicit native Pick List / Packing Slip / Delivery Note
batches, immutable batch identities, current-history compare-and-set, one active
batch, per-line reservation invariants and cancellation before shipment.
Native SRE documents hold both picked and remaining quantities atomically.
The read model uses native SO delivered_qty + returned_qty for gross fulfillment;
a quarantine return does not silently request a replacement shipment.
Earlier delivered SREs stay intact; no quantity/value/GL ledger is introduced.

A shipment unit is the greatest-common-divisor quantum of the submitted native
SO component rows. This conservative proportional scope preserves the complete
component ratio captured by the order, independent of later Product Bundle edits.
It does not support arbitrary per-product split plans, serialized/batched items,
partial returns within one Delivery Note, labels/carriers or closing an unshipped
remainder. Each shipped Delivery Note supports a full return to quarantine.

Native regression/evidence results will be recorded in
`docs/wms/partial-shipping/RESULTS.md`. Browser scenarios are prepared, not executed
while the host blocks Chromium startup. Production identity, physical scanner,
actual service/storage isolation, fiscal acceptance and live-channel review
remain separate prerequisites to release.

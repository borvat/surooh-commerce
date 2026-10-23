# Operator scanner picking candidate

Paired Drafts: [WMS27](https://github.com/borvat/surooh-commerce/pull/27) and
[Accounting35](https://github.com/borvat/surooh-accounting/pull/35), stacked on the
retained storage/count/quarantine candidates WMS26 / Accounting34. No main merge,
production deployment, Actions rerun or live provider write occurred.

## Executed source and results

WMS full checkout `68ed97435cb406302b7a58ffc75b2f82b309189e`, tree
`1f37a0fd9bfe9a68929ff017594dba6967035d9f`. Canonical Accounting code
`1b84bf9218abe5c36c0156f20c15f72999e4988c`; executed partial witness
`e9f0550980c21be266925a28efe83153010700b2`. All16 app/guard/metadata blobs match the
canonical tree in ACCOUNTING_SOURCE_MAP.json. This is not a full Accounting
checkout, build, invoice or fiscal acceptance run. Concurrent invoice work is preserved.
Both executed worktrees were clean before and after the final runs. Later
publication changes are documentation/evidence only.

| Check outside Actions | Actual result | Limit |
| --- | --- | --- |
| Fresh unpatched ERPNext/Frappe16.52.0, two sites/DBs | 41 PASS,0 FAIL,1 browser BLOCKED; outer2 | Retains38 prior cases; adds S01–S03 |
| Application tests | 139 PASS | Includes fabricated-model scanner tests, not hardware evidence |
| Foundation / evidence validator | 25 /9 PASS | Missing scanner cases cannot inherit stock-only success |
| Browser mechanics / configuration | 14 /8 PASS | Harness mechanics only |
| Typecheck / build / lint | Exit0 |15 pre-existing lint warnings |
| Actual rendered B01 / device | BLOCKED / unexecuted | Local Chrome IPC socket denied; zero B01 scenarios executed |

NATIVE_RESULTS.json, APPLICATION_CHECKS.json and GATE_STATUS.json retain the raw
outcomes. The native validator reports no integrity errors and a candidate for
human evidence review. UI/operational/phase/release gates remain blocked; historical
start booleans are not a substitute for the current owner engineering mandate or
technical/fiscal approval.

## Behavior and authority

An unpicked native order offers «تجهيز بالمسح». Enter a barcode or product code and
press Enter for each whole unit. Counts fold repeated components of the native
Sales Order; barcode zeros remain strings. Unknown/ambiguous codes and excess
units cannot advance the plan. The last scan can be undone before submission.
Confirmation requires every component, and failed requests retain the same sent
key/body for explicit retry. Dismissing an unsent form does not create a pick.

The engine independently resolves native Item Barcode / Item identities and
compares all native order component quantities before using the existing atomic
Pick List/SRE handoff. The client never writes quantity, reservations, value or GL.
A native comment records resolved quantities and operator, but an editable comment
is not authority: only completed trusted command metadata can establish prior
scanner verification. A manually created pick cannot be relabelled retrospectively
by inserting a matching comment. Manual picking remains available as an explicit
alternative, not disguised as scanner evidence.

S01 rejects unknown, SKU/barcode namespace collisions, off-order items, excess,
incomplete and negative scans without a pick or stock/reservation/value changes.
S02 calls the actual WMS read/scanner services over native HTTP, replays the same
key, then replays concurrently from different authorized actors: one Pick List,
one audit comment, the same3 native reserved units linked to that pick and no
quantity/value change. S03 deliberately inserts a forged matching comment on a
manual pick; scanner verification is still refused, and cancelled orders are denied.

These are operator-entered scan declarations, not physical-content certification,
authentic-device or hardware-attestation proof. The server resolves exact native
identities, not bol titles or fuzzy product guesses. Current scanner scope is full
order, whole-unit, non-serialized/non-batched items. Partial flows remain open.

## Verification and remaining work

The real B01 harness now includes an unknown scan, undo, completed scan, native
pick and cancellation. It is prepared but unexecuted. Model/static rendering tests
and a browser version do not prove keyboard/device behavior or visual/mobile QA.
The first native probe is retained as development evidence only because source
changed while it was running; early TypeScript narrowing errors were corrected
before final exact-source checks. No failed/mixed-source run is acceptance evidence.

The adapter remains explicitly synthetic/loopback/TEST-A with a trusted lab
administrator boundary. Production identity/least privilege, actual separate
non-root services/storage/keys, browser/hardware, partial shipments/returns,
serial/batch, inspection/disposal approvals, channel integration, full restore/
upgrade/load, accountant review and release/cutover remain open. The full WMS goal
has not been declared complete. Per-warehouse locks and command-metadata lookup
also need real load validation before production use.

Owned final MariaDB/Redis services shut down with exit0. External checks found an
empty final test root after the runner's removal report and removed it; the earlier
probe also had residual files. CLEANUP_OBSERVATIONS.json records transient absence,
not isolation. Archives contain synthetic reports/redacted logs only, verified
SHA256 manifests and no runtime/configs/keys/private files/DB dumps. Discard/revert
the unmerged paired scanner changes to roll back. See REPLAY.md.

# Shipment batches: engineering checkpoint

Paired Drafts: [WMS28](https://github.com/borvat/surooh-commerce/pull/28) / [Accounting36](https://github.com/borvat/surooh-accounting/pull/36).

Executed WMS code `d31d4e7cc492d4121949522aa8ed9406d37a7795`; canonical Accounting app code `44c3c949d884acd94b64422820d2f4029bc13803`. Accounting was exercised as an exact 17-file source materialization, not a full Accounting/invoice/fiscal suite. Source was clean before/after execution.

Observed outside GitHub Actions:49 native ERPNext/Frappe tests PASS,0 FAIL,1 rendered browser test BLOCKED (outer exit2). Application144/foundation25/evidence-validator10/browser-mechanics14/browser-config8 passed. Syntax/type/build/lint exited0;15 existing lint warnings. These aggregate results are not release acceptance.

The candidate adds proportional native shipment batches, one active batch, stable identity/history checks, native reservation invariants, packed cancellation and per-delivery quarantine return. Current locking reads prevent an old REPEATABLE READ view from hiding current batch history, delivery, packing slips or reservations. P07/P08 use separate real held-snapshot sessions alongside HTTP commands; they cover stale creation and pack/ship/cancel recovery. Stock/value/GL remain native ERPNext documents; no core patch or second ledger.

Raw evidence is NOT attached to this branch. Automatic approval review rejected publishing runtime logs, provenance and encoded archives to both the public and private repositories without specific authorization. A reviewed local bundle is prepared; explicit approval is required before its upload. Earlier-session interrupted raw evidence is unavailable and is not reconstructed or counted as published evidence. Do not infer completed evidence review from aggregate totals.

Browser/mobile/device, production identity/least privilege, real service/storage isolation, arbitrary split plans, partial-batch scanning, partial-DN returns, closing an unshipped remainder, carrier/labels, inspection/disposal, restore/upgrade/load, accountant and release/cutover remain open. Drafts stay unmerged; no deployment or live bol write. The full WMS goal is not declared complete.

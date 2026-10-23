# Close an unshipped remainder — UNEXECUTED candidate

This continuation is source work on independent stacked drafts. The execution
environment is unavailable. No syntax/type/build/unit/native/browser command ran
for this candidate. The predecessor's49 native and144 application passes belong
only to WMS d31d4e7cc492d4121949522aa8ed9406d37a7795 and Accounting
44c3c949d884acd94b64422820d2f4029bc13803, and do not validate this change.

## Behavior

After a trusted proportional shipment, an operator may enter a reason and close
the remaining quantity. The command requires the exact current Pick List history
(including cancelled batches), exact remaining units, at least one submitted
outgoing shipment and no active unshipped batch. Cancel a prepared/packed batch
explicitly first. A wholly unshipped order uses cancellation instead.

The order row and stock bins are locked. Native outstanding SRE documents are
cancelled, consumed SREs are retained, then native SalesOrder.update_status("Closed")
runs in the same framework transaction. There is no internal commit and no direct
stock/value/GL write. Partly consumed outstanding reservations require review.
Submitted shipments, original SO quantities, SLE and GL stay intact. Native close
alone does not cancel explicit SREs in the inspected pinned implementation.

A trusted completed command records only close identity and unshipped unit
metadata, not a quantity ledger. Same-payload retries across command keys return
the same result; changed intent or a subsequently changed closed order requires
review. New batch and legacy fulfillment commands reject Closed/On Hold orders.
No reopen action is added.

The Arabic batch panel adds the reason and explicit close action. An attempted
close freezes its payload and key for retry. A closed remainder has an explicit
badge/notice and cannot prepare another batch. Per-shipment return controls stay
visible. The legacy order status enum is unchanged: the additional
native_remainder_closed flag overrides its display label. Thus closed orders can
still appear under the legacy placed filter; a dedicated closed filter is deferred.

## Prepared verification, not results

P09 tests release of only unused reservations, unchanged stock/value/SLE/GL,
preserved submitted shipment/order quantities, multiple alias replays, projection,
late-pick rejection and changed reason conflict.

P10 tests refusal of an active packed batch, malformed reason, stale pick history
and changed remainder; explicit cancellation permits retry of the original close.

P11 holds a real old REPEATABLE READ transaction while a different HTTP actor
creates a batch, then expects stale close rejection. Two different actors close
the same remaining intent and must produce one release/close effect.

P12 SIGKILLs an owned child after native reservation cancellation but before
native order close; rollback must restore reservation/order state and same-key
new-process retry must succeed. This is a real disposable DB test, not a mock
transaction or fabricated PASS.

The native runner and gate now require P01–P12. Four additional application
request checks and a gate regression reject treating old shipping evidence as
close acceptance. Run all required checks outside Actions when an execution
environment is available. The exact paired sources and fresh hashes must be
recorded then. Full Accounting source is preferred; if materializing the bounded
lab app, include and independently map the new native_lab/closing.py in addition
to the predecessor17 files.

Pending: all new execution; rendered close/retry/refresh UI; close/ship and
close/cancel overlapping races beyond the prepared cases; return after close;
fault injection after native close before response commit; actual scanner/device;
production identity, isolation, operational/fiscal and release review.

Pinned source inspected:
[ERPNext Sales Order](https://github.com/frappe/erpnext/blob/90cb7f9243048a44311777d60a1cec8ca05ceec9/erpnext/selling/doctype/sales_order/sales_order.py)
and
[native SRE lifecycle](https://github.com/frappe/erpnext/blob/90cb7f9243048a44311777d60a1cec8ca05ceec9/erpnext/stock/doctype/stock_reservation_entry/stock_reservation_entry.py).

## Evidence preservation and rollback

No raw predecessor archives or runtime logs are attached to these drafts. They
were prepared locally in the prior session, but are inaccessible while execution
is unavailable. Do not infer uploaded evidence from aggregate summaries, recreate
raw logs from summaries or label review/signoff complete.

Discard these unmerged drafts to revert this candidate. No migration, main merge,
deployment, paid service change, live provider write or production data operation
was performed. The full WMS goal remains open.

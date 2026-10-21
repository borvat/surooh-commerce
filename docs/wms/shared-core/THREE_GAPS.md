# Three gaps — design, executed prototypes and remaining acceptance

These experiments are outside the inert Surooh app. They create only lab custom command/outbox/receipt tables and native ERPNext documents. No public API or production feature was added.

## Durable idempotency

Unique key = hash(company|source|operation/version|external-id); normalized canonical payload hash stored with result. Reject reused key with different payload/target. Store key without TTL until an accountant-approved retention/archive design preserves replay safety; do not discard completed keys during retry windows. Native financial voucher, inbox completion and outbox commit atomically. Failed validation/deadlock rolls back the whole transaction; retry only transient failures, bounded count/backoff, never a partial posting. Transport is at-least-once; receiver must persist a unique receipt and its own side effect atomically. Do not promise exactly-once external transport.

A02: four real MariaDB clients create one native journal, one outbox, two GL rows. A03: precommit injected crash rolls back inbox/outbox/GL; retry succeeds once; payload conflict rejected. A04: second-site receiver receipt commits, sender ACK is deliberately omitted, replay reuses the durable receipt and finally ACKs. Receiver is an in-process synthetic consumer on another real site; this is not a live provider or cross-site financial saga proof.

## Whole-bundle component reservation

Resolve canonical company/item/warehouse and immutable approved BOM version. Aggregate repeated/nested components, normalize base UOM with exact precision and reject cycles/invalid quantities. Compute requirements for all commercial lines against one component budget. Lock command/order plus component bins in deterministic warehouse/item order, use current reads, check every line, then create native SREs in the same transaction. Reject shortage with no partial result. Serial/batch, expiry, quarantine and warehouse ownership are additional mandatory constraints. Cancel/ship/retry share the same command/order state machine; cancelled replay stays terminal. No force assignment or silent partial reserve.

A05/A06: native two-component Product Bundles are projected to **research fulfillment-only flat Sales Orders**, native SREs reserve6 of each against10; two concurrent whole-bundle requests yield one winner and no loser rows. A07: second-component shortage and injected crash after first SRE leave no SRE/inbox; retry, cancellation and cancelled-key replay preserve terminal state. This proves the narrow adapter transaction shape, not a finished commercial parent/pick/dispatch mapping. The flat order must never create a second customer invoice. The actual UI and native bundle-parent delivery/SRE lifecycle need a reviewed adapter and end-to-end tests before acceptance.

Attempt01 passed the original eight cases. Attempt02 extended cancellation/role tests but reused fixed lab keys across fresh vouchers, correctly triggering payload/target conflict; harness namespace was corrected per run. Final eight cases passed, including cancellation terminal replay and role revocation. Both attempts are retained. No core ERPNext change was made.

## Execution-time worker authorization

Trusted server registry binds service→site→legal company and allowed operation; queue payload cannot override it. At execution require enabled actor, current explicit company grant, required current role, document permission and company match; reject missing grant. Revalidate nested document/warehouse/account IDs and provider context. Never use Administrator/global integration credentials or unchecked get_doc for user-delegated operations. Transactional mutation repeats checks after locking relevant state; redact queue/log error data. Report/export jobs and delayed/retried jobs follow the same rule.

A08 uses native Frappe execute_job with a callable: own-company positive control, foreign company, forged document/company binding, wrong site, revoked company grant and revoked Accounts role. All denials occurred at execution. It is **in-process**, not a real RQ daemon lifecycle test. The sample accepts a test allowed_site argument; production must resolve it from trusted configuration, not request/queue input. Background cancellation, disabled-user lifecycle, integration service accounts, actual mutation jobs and native bypass routes remain required tests.

## Future acceptance

Implement only after separate owner start authorization, on stage branches. Required tests include concurrent identical/conflicting commands, distinct companies with same external key, consumer crash before/after commit, outbox lease/retry exhaustion, multi-line/nested/serial/batch bundle races, cancel/dispatch races, revocation after enqueue, direct endpoint bypass, native GL/quantity conservation and hosted isolated CI on exact reviewed heads. Prototype PASS does not mark any production requirement closed.

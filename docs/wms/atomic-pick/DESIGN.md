# Atomic pick and existing React UI — bounded validation candidate

This phase follows reviewed WMS PR21 and Accounting PR30. No engine re-evaluation, historical migration edits, P01–P09/Codex start, merge, deployment or production connectivity. The paired branches are `validation/atomic-pick-real-ui`, based on the reviewed native-integration heads. Main Surooh hooks remain inert; the separate `surooh_native_guard` is installed only on marked synthetic sites.

## Atomic native handoff

Every authorized order transition locks its Sales Order and sorted component Bins. New orders/receipts/returns also lock sorted Bins. Complete native SO reservations are a prerequisite. In **one transaction**, use native SO reservation cancellation, map the SO to a native manual Pick List at the SO warehouse, insert/submit it with native quantity/UOM/warehouse checks, then call native Pick List reservation creation. Require the exact complete reservation total before returning. Do not commit between these operations. A failure or process death restores the original reservation and removes every partial pick/command effect.

`pick_manually=1` is an ERPNext native supported workflow, not a core patch or permission/stock-validation bypass. Automatic location mapping initially yielded an incomplete pick and failed closed; the failed development logs are retained. The candidate deliberately supports one complete pick/pack/shipment per synthetic SO, integer non-serial/non-batch components and a fixed warehouse. It does not claim partial picks/shipments, nested bundles, batch/serial UOM conversion, returns inspection/quarantine, tax/invoice treatment, discounts, commercial bundle parent pricing or marketplace/FBB acceptance.

Native Packing Slip is prepared from a draft Delivery Note mapped from the submitted Pick List; shipping requires this packed native chain. Replay uses persistent company/source/request identity and payload hash; a new pick request identity also discovers the already submitted native pick instead of duplicating it. Cancellation removes native draft delivery/packing dependencies through native document APIs, cancels pick/native SRE/SO, preserving native deletion/audit mechanisms. Shipped orders require native linked return; they cannot be cancelled.

Real concurrent commands can encounter an InnoDB deadlock victim. The synthetic command boundary retries **only QueryDeadlockError**, at most three full attempts, with native rollback before every retry, fresh JWT/DB authorization and the same persistent command identity. No provider/network effects occur inside this bounded native command transaction. Retry messages contain only the attempt number. Other validation/permission errors propagate. Exhaustion remains an error; this is not a load/SLA or production isolation guarantee.

## One writer and identity

ERPNext alone writes quantities, reservations, SLE, valuation, COGS and GL. No local WMS/legacy stock writes accompany a native command. The old SQL migrations are untouched. The installed synthetic guard covers Pick List/Packing Slip/Bin as well as the existing SO/SRE/Stock Entry/DN/SLE/GL paths. Real HTTP native-manager bypass tests accompany JWT, revocation, permission locking and RQ regressions. This is not an exhaustive extension/RPC audit or defense against privileged DB/host/key compromise.

## Existing React screens

Explicit in-memory loopback native mode supplies verified identity and native read projections to existing `/components`, `/bundles`, `/orders`, `/movements` screens. Receiving includes unit cost and a stable per-dialog receipt identity. Bundle edits use per-dialog command identity (A→B→A is not collapsed by a payload-derived key). Order creation similarly retains one identity across retries. Pick/pack/ship/cancel/linked-return actions use native command identities; history renders real native SLE quantities/value rather than inventing legacy balance-after/reservation rows.

Stock Items project as one-to-one stock products; Product Bundle child rows project their actual composition. Unsupported metadata is null/empty, not imported bol data. External-reference display is the native SO identity, not a verified bol order mapping. Default application/auth/storage behavior is unchanged when native mode is absent. Legacy unsupported operations in selected native mode fail closed; stock adjustments are disabled rather than assigning an invented valuation. This does not revoke production legacy database privileges or prove cutover safety.

Native browser bootstrap requires both `VITE_SUROOH_NATIVE_LAB=true` and a loopback in-memory synthetic session. No token is stored in localStorage, URL, committed fixture or report. The development proxy is enabled only by explicit `WMS_NATIVE_UI_TEST=true`, binds loopback and targets the isolated Frappe command path. Never use these credentials or this fixture authentication as production identity design.

## Actual tests, browser and operational gates

`verification/native_integration/bootstrap.py` freshly installs the pinned unpatched ERPNext/Frappe16.52.0 pair and two independent synthetic sites/DB credentials. Baseline native cases remain, augmented by independent-actor HTTP/SQL races, SIGKILL after unreserve/before pick mapping, lost-response/process-restart replay, packed cancellation, native screen service calls and value/GL assertions. Fault injection kills only the disposable child at the real native mapper entry; no success is mocked.

`browser-cycle.mjs` is a **real-browser-only harness** for those existing screens. If the executable/download is unavailable, B01 exits2/BLOCKED. Service/Bun/unit/static successes never become browser acceptance. Even a browser PASS would not satisfy non-root service/storage/key isolation, full identity/cutover proof, accountant review or owner start approval. The current UID0-only executor cannot prove distinct service identities; no UID shim is used as acceptance evidence.

Reproduce with explicit absolute paths and fresh evidence output:

```sh
python3 verification/native_integration/bootstrap.py --runtime-root /absolute/marked-synthetic-runtime --accounting-root /absolute/paired-accounting --bun /absolute/bun --output /absolute/fresh-evidence
python3 verification/native_integration/atomic_gate.py --artifact-dir /absolute/fresh-evidence --wms-sha <TESTED_WMS_SHA> --accounting-sha <TESTED_ACCOUNTING_SHA>
```

The review-only atomic gate checks the exact clean pair before/after, command exits, logs/case-file hashes, case completeness and distinct browser status. PREPARATION/P01 stay BLOCKED; no automatic approval. Regression runner/gate remain required independently. For a later browser-capable executor, supply its actual executable/module in the harness configuration and rerun on the pinned clean pair; retain browser version, true process exit and actual native GL/SLE evidence. The currently unexecuted browser script must itself be reviewed and debugged when a real browser is available.

Rollback: stop only owned synthetic services; remove their disposable site/DB/key paths; discard/revert these paired candidate branches. The production WMS, financial engine, bol guards and current accounting remain unchanged.

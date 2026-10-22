# Isolated native integration — bounded experiment, not P01

Owner authorized this experiment after reviewing PR20 at54ffd3f9772dc2a9ac88ba940197003f178b4d39. P01–P09, Codex, main merge, deployment, real migration, live integrations and billing/Actions changes remain forbidden. Accounting backend lives on a paired independent branch; Commerce owns the retained UI service adapter and native test harness. Original23 migrations and existing authority contract remain unchanged.

## Exact engine and fresh installation

Use the previously approved ERPNext/Frappe **v16.52.0**, upstream commits90cb7f9243048a44311777d60a1cec8ca05ceec9 /4515014c87ece6cb20ee91d2cfb121c5cbd1ff4a, MariaDB11.8.9 and Python3.14.8. Source archives are hashed and every original source file compared byte-for-byte before execution. No develop branch, seeded DB replay, backup restore, upstream patch or fake schema is accepted. Official tag refs were rechecked on GitHub.

`verification/native_integration/bootstrap.py` provisions its own fresh MariaDB data directory, loopback Redis, two independently installed Frappe/ERPNext sites and databases, and fresh per-site DB credentials, encryption and JWT keys. Installer runs native `_new_site`, then the actual Surooh app and separate **sandbox-only guard app**. The metadata-only main Surooh hooks remain unchanged. Fixture setup creates TEST-A/TEST-B only. Private configs, keys, DBs and Redis state are disposable and excluded from evidence archives. MariaDB/Redis run under the executor's real UID0, without UID shims: **not operational isolation**. Both sites currently share daemon/OS/host boundaries. Do not copy this provisioning model to production.

## Single stock and value authority

Only ERPNext writes Item/Product Bundle, Sales Order, Stock Reservation Entry, Stock Entry, Delivery Note, Stock Ledger Entry and GL. Surooh stores command identity/hash/result/actor metadata only. No quantity, reservation, valuation or finance ledger is created beside the engine.

A native Product Bundle is expanded to component Sales Order lines for actual native stock reservations. Native reservations do not reserve a non-stock bundle parent. The original bundle request remains in command metadata. This is a **stock test mapping**, not accepted commercial parent pricing, invoicing, discount, serial/batch, nested bundle or bol/FBB mapping.

## Identity, idempotency and bypass

The opt-in native API requires a synthetic environment flag, lab site/database prefix and site-config marker. Signed HS256 JWT issuer/audience/expiry/nbf/subject/jti/company/source are validated. Each site has a distinct signing key and fixed company. Only explicit lab-manual source policy is permitted; missing channel is deliberately allowed for this source. Current User.enabled, Has Role and durable token revocation records are checked from the DB on every HTTP command, replay and RQ execution. Token role claims cannot grant authority. Production identity provider/TLS/JWKS/rotation remain out of scope.

Company/source/request key and canonical whole operation/payload SHA256 bind the command. INSERT IGNORE + FOR UPDATE serializes effects/result in the native transaction. Successful replay returns its stored native ID; conflicting payload is rejected without another effect. The facade internally uses Administrator only after its boundary checks; metadata records the verified actor. This privileged implementation requires least-privilege service/audit design before production use.

Current locking reads on User/Has Role serialize permission decisions with revocation. If revocation commits before command permission acquisition, the command is denied. A revocation attempting to change an already locked permission waits until that accepted command commits; no mid-transaction cancellation guarantee is claimed. Native tests exercise a real SQL lock wait during an HTTP request plus real RQ revocation before execution.

The separately installed guard app denies stock/document mutations outside a thread-local native-command scope, including raw RPC/resource writes attempted using valid native Stock Manager API credentials. Main app hooks are not broadened. This is a synthetic-site guard, not a whole production endpoint/extension audit. DB-owner, site-key or host compromise remains outside the proven boundary.

## Retained WMS service versus full UI

`src/lib/inventory.ts` retains existing functions. Explicit **in-memory, loopback, synthetic-only** configuration delegates placeOrder/fulfillOrder/cancelOrder to the real Frappe HTTP API. With native mode selected, every remaining legacy inventory call through this service is refused rather than falling back to Supabase. Default behavior is unchanged and no production configuration is enabled. The Bun probe imports and executes these actual existing service functions against live native HTTP, not fake fetch contracts.

This does **not** claim full React/browser acceptance: native catalogue/list/detail projections, rendered receiving/return flows and interactive auth UI are not implemented/verified. Other legacy modules and a production cutover require server-side old-writer privilege/network removal, not reliance on a browser proxy. No live legacy service is connected in the native lab; no bol write occurs.

## Native workflow gap

Native `create_pick_list` refuses Sales Orders with reserved stock. Preserve that protection. Do not silently unreserve/re-reserve across transactions. A separately reviewed atomic reservation-to-pick handoff and its shared-component races are required before full pick/pack/ship acceptance. Shipping directly through the native Sales Order→Delivery Note API can be tested independently; it does not close pick/pack.

## Reproduce / rollback

Use explicit absolute synthetic runtime/Accounting/Bun paths and a fresh evidence directory:

```sh
python3 verification/native_integration/bootstrap.py \
  --runtime-root /absolute/marked-synthetic-runtime \
  --accounting-root /absolute/paired-accounting-checkout \
  --bun /absolute/bun --output /absolute/fresh-evidence
```

Requires sufficient free space (guard stays enabled), the pinned native runtime and no external DB URL. Full runner regression commands and exact source pair are recorded in results. Exit2 and BLOCKED remain visible for partial native acceptance. Cleanup must be checked externally as well as through the driver's own flag; development residual observations are preserved. Rollback stops/destroys only these synthetic services/sites and abandons/reverts the two candidate branches. No production changes or stage transition follow from this experiment.

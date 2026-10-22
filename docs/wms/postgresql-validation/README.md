# Surooh WMS — Isolated PostgreSQL, RLS & Concurrency Validation

Owner authorized this packet after accepting source cleanup at3a7cfb73850ec89fd91822c5c0078ff985d25895 for preparation/review only. Branch validation/wms-postgresql-rls starts at the cleanup evidence head9c14f77a72ac2d36dd906909b481758b7cc7c3e7 (PR18), preserving its tested source and artifacts. Do not repeat architecture selection or source cleanup. No Codex, merge, production adoption, deployment, real-data migration, paid service, billing change or financial/provider operation.

## What the adapter does

scripts/wms/db-check.mjs requires the explicit isolated loopback test URL and absolute paths to a pinned PostgreSQL binary directory, a Python with psycopg3.3.6 and a new external artifact directory. It never loads .env or falls back to production credentials. verification/postgres/validate.py verifies binary hashes, creates a new private cluster and random owner/login passwords, enables SCRAM authentication, listens only on127.0.0.1, disables Unix sockets in this executor, and drops private cluster/dump/password material after stopping its owned server. It will not attach to an existing database/server. A port conflict fails rather than reusing another instance.

All23 original migration files execute unchanged in sorted filename order, each in a transaction with SHA256/status recorded. Only the separately declared compatibility.sql supplies Supabase's anon/authenticated/service_role roles, minimal auth.users and auth.uid()/auth.jwt() SQL claim accessors. No JWT signature verification, PostgREST, Supabase storage or hosted service is emulated. Original source-seeded demo labels are fixtures; all added users/companies/orders/stock are synthetic.

Nine distinct LOGIN roles exercise authenticated admin/warehouse/viewer for each of two companies, outsider, missing identity and anon. They are non-owner, NOSUPERUSER, NOBYPASSRLS and cannot SET ROLE owner/service_role. Reads span all public tables and views; representative CRUD and critical SECURITY DEFINER RPCs are exercised with actual policy enforcement.45 definer functions are inventoried; this is not exhaustive behavioral execution of all45 APIs or every per-table/per-role DML combination. Unexercised HTTP/job/ERP paths stay held.

Native PostgreSQL backend PIDs are recorded for independent concurrent TCP sessions. Tests exercise shared-BOM reservation shortage, whole-bundle rollback, cancel-vs-ship, terminal retries, non-null-channel external uniqueness, null-channel replay, execution-time role revocation, terminated in-flight transactions and retry, separate fulfillment/cancellation, restart/reconnect and a real pg_dump/pg_restore into a separate synthetic database. Restored table fingerprints and role-scoped read isolation are checked. No valuation or financial journal algorithm is added.

## Runtime provenance and host limitation

Pinned wheel: embedded-postgres18.6.3 containing PostgreSQL18.6; exact wheel/binary SHA256 are in verification/postgres/runtime-pins.json. The app's dependencies and bun.lock are unchanged. Runtime is local test tooling, not an ERP/WMS engine replacement. The DB Python environment is separately installed/available; psycopg3.3.6 and libpq version are recorded. Reproduction can download the exact pinned wheel with pip download --no-deps, verify its SHA256, extract it outside the repository, and provision psycopg[binary]==3.3.6 in a dedicated local venv. No automatic installer or new paid service is used.

This executor exposes only kernel UID0 and denies a nested UID map; Unix sockets are also unavailable. Stock initdb/postgres cannot run under that identity without a lab accommodation. --allow-uid-compat explicitly compiles the checked-in small libc compatibility shim and applies LD_PRELOAD only to the owned PostgreSQL/tool subprocesses. It changes getuid/geteuid/stat ownership observations; it does not change PostgreSQL SQL roles, RLS, transactions or locking. Vendor binary bytes remain unchanged and are hash-verified. **This is not real non-root service/OS/mount isolation and is not a production deployment recipe.** Its source/library hashes and actual kernel UID are in the report. No global preload, host user/admin setting or production rule is changed. Separate trusted non-root replay and host isolation remain mandatory. The adapter does not auto-enable this option.

## Reproduction and gates

Run the independent verifier on the exact published source SHA from a clean checkout. Use a new output directory per run. Keep all passwords/dumps/private cluster configs outside published artifacts.

```sh
python3 verification/run.py --profile wms --expected-sha <SOURCE_SHA> --bun <PINNED_BUN> --tools-python <TOOLS_PYTHON> --postgres-bin <PINNED_PG_BIN> --db-python <DB_VENV_PYTHON> --allow-uid-compat --accounting-report <ACCEPTED_ACCOUNTING_REPORT> --accounting-expected-sha a9400f6f4b9066f5487f16cd45268728920e5672 --output <NEW_EXTERNAL_EVIDENCE_DIR>
python3 verification/gate.py --report <NEW_EXTERNAL_EVIDENCE_DIR>/report.json --phase POSTGRESQL_VALIDATION --expected-sha <SOURCE_SHA>
python3 verification/gate.py --report <NEW_EXTERNAL_EVIDENCE_DIR>/report.json --phase PREPARATION --expected-sha <SOURCE_SHA>
python3 verification/gate.py --report <NEW_EXTERNAL_EVIDENCE_DIR>/report.json --phase P01 --expected-sha <SOURCE_SHA>
```

On a suitable real non-root environment omit --allow-uid-compat. PostgreSQL runtime/source compatibility must still match the pins. Normal DB failures exit1; unavailable/unsafe wrapper prerequisites exit2; zero/missing tests fail the minimum executed-case requirement21. Independent guard tests reject unsafe flags/URLs/runtime paths. POSTGRESQL_VALIDATION, PREPARATION and P01 keep host identity and real HTTP auth boundary requirements explicit. No local gate accepts a phase or starts Codex. Hosted Actions remain BLOCKED; no reruns/billing repair.

## Findings, not hidden failures

See FINDINGS.md and the final exact-SHA results. D15 and D18 intentionally assert required security/idempotency invariants, so reproduced violations remain FAIL and the DB adapter returns1. Do not flip these assertions to observed-expected PASS or silently patch original migrations. Proposed fixes need a separate reviewed packet. Earlier development runs include fixture/setup errors (missing warehouse/channel codes, empty mock claim, an invalid assumption that direct BOM DML should be allowed); those are harness errors, preserved separately from product findings. Original migration removes direct BOM write policies and exposes authorized set_product_bom RPC instead; the final positive CRUD test respects that contract.

Rollback: close/revert this branch or remove only its newly created local synthetic cluster/evidence directory. All original migrations, business modules, stock/financial authority and PR17/18/main remain unchanged. ERPNext remains the sole future native stock/reservation/valuation/COGS/GL authority; this harness is an evaluation of retained legacy data contracts, not a second production stock ledger.

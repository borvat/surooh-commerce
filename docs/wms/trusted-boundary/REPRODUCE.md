# Reproduce safely

Use a disposable local environment, no production credentials. Runtime versions/hashes: `verification/postgres/runtime-pins.json` (PostgreSQL18.6 embedded wheel18.6.3, psycopg3.3.6, PyJWT2.15.1); Bun1.3.13, Node24.19.0, Python3.12. Refer to existing `docs/wms/postgresql-validation/README.md` and `verification/README.md` for binary provisioning and independent-runner details. Install PyJWT2.15.1 into the same **venv path** passed as `--db-python`; do not resolve its Python symlink out of the venv.

```sh
WMS_TEST_ISOLATED=true WMS_TEST_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:15432/wms_test_alternative \
  /absolute/venv/bin/python verification/postgres/validate.py \
  --postgres-bin /absolute/postgres/bin --artifact-dir /absolute/new-output
```

Prefer an actual non-root Unix user. Only this constrained UID0-only executor needs explicit `--allow-uid-compat`; it is disclosed in evidence and cannot satisfy the host-isolation gate. Driver starts its own fresh cluster on loopback, applies 23 original migrations then candidate SQL, uses synthetic users, launches/stops HTTP, and removes private cluster/config/key/dump files. Never run against a supplied live database. SIGKILL/restart tests target only the driver-owned candidate HTTP process.

For acceptance, use clean published source with the full `verification/run.py --profile wms --expected-sha <SHA>` command recorded verbatim in evidence; pass explicit Bun, tools Python, PostgreSQL binaries, DB venv, accounting report/expected SHA and a fresh output directory. The report contains every command/exit/log/hash and before/after source status. Required unimplemented gates cause exit2; that is not an executable check failure. `legacy_http_auth_boundary` independently checks all21 original +18 trusted cases and cleanup, while `deployed_wms_identity_integration` stays BLOCKED.

```sh
python3 verification/gate.py --help
```

Evaluate PREPARATION, P01, SOURCE_QUALITY and TRUSTED_BOUNDARY against the exact report/SHA. A review-ready scoped result is never phase completion, Codex authorization, merge or deploy approval. Do not rerun GitHub Actions or change billing. Human review must verify archives, SHA and hashes, not merely a green summary.

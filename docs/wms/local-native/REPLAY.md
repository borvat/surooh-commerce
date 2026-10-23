# Reproduce outside GitHub Actions

Use a new disposable Linux amd64 environment and synthetic data only. The retained
native runner creates two fresh sites/databases, runs the native cases and removes
its private work directory. Never point it at a real bench, database or company.

1. Check out WMS at `011c5380bf7e97f180798cc2428df17d61f7d7df` and Accounting at
   `34adb0e16be584b5e3823b2cb46a80abb5eaf869`. The captured run used the documented
   exact-byte native-source subset of Accounting; a full authorized checkout can
   be used for a new run, with its own exact Accounting SHA recorded.
2. Install Bun1.3.13 and run `bun install --frozen-lockfile` in WMS. Do not change
   package locks or substitute project dependencies. Use Node24.19.0.
3. Provision an owned `WMS_LAB_DIR` with `.synthetic-only`, `src/`, `native/` and
   `erpnext-venv/`. No existing site data or backups may be reused.
4. Download the official Frappe/ERPNext v16.52.0 archives and MariaDB11.8.9
   linux-systemd-x86_64 archive; verify the captured hashes below. Extract source
   with archive ownership disabled. Keep `src/frappe.tar.gz`,
   `src/erpnext.tar.gz`, and directories named `frappe-16.52.0`, `erpnext-16.52.0`
   and `mariadb-11.8.9-linux-systemd-x86_64` under `src/`.
5. Create `erpnext-venv` with Python3.14.8. Install editable Frappe/ERPNext using
   [runtime-constraints.txt](runtime-constraints.txt), preserving their declared
   pinned PyPika/Gunicorn Git dependencies. The captured runtime uses mysqlclient
   headers/libraries from the locally extracted MariaDB client development package.
   See runtime-provenance.json in run01 for the resolved freeze and16 Ubuntu
   package versions/URLs/hashes. This is a captured test runtime, not a hardened
   production image or a complete SBOM/security assessment.
6. Provide Redis7.0.15 at `native/usr/bin/redis-server` and its shared libraries at
   `native/usr/lib/x86_64-linux-gnu`. The runner supplies this library path.
7. Provide an ordinary working Chromium-compatible browser and Playwright module.
   Test local page rendering first; `--version` is insufficient. Retain normal
   environment restrictions; an IPC denial keeps B01 BLOCKED.

| Official archive | SHA256 captured and checked |
| --- | --- |
|Frappe16.52.0|`34087f9c8ea018ac79011ee95863c6b57bce6bc19e923b1545723b3ab994268e`|
|ERPNext16.52.0|`cfd1e3d4495a4e70e333a42aec1689552143dc6fc57faac5329cadef08dbc810`|
|MariaDB11.8.9|`32f8871a2aa38b36aa418b7f4abc6fc0c6ef1ba5a45798cacb2afa52c8a6113b`|

Run from the clean WMS checkout with explicit absolute paths and a **new** output
directory. Ports14306/17379/18080/18081 must be free in the runner's namespace.

```sh
python3 verification/native_integration/bootstrap.py \
  --runtime-root /absolute/owned-synthetic-runtime \
  --accounting-root /absolute/pinned-accounting-checkout \
  --bun /absolute/bun-1.3.13 \
  --browser-executable /absolute/working-browser \
  --playwright-module /absolute/playwright-core \
  --output /absolute/new-native-evidence

python3 verification/native_integration/atomic_gate.py \
  --artifact-dir /absolute/new-native-evidence \
  --wms-sha 011c5380bf7e97f180798cc2428df17d61f7d7df \
  --accounting-sha ACTUAL_ACCOUNTING_CHECKOUT_SHA
```

Outer exit2 is not a complete PASS. Inspect native-tests.json, bootstrap-results.json
and gate errors. B01 must actually execute and pass before claiming rendered UI
acceptance. Gate scripts never approve release or prove operator/environment
identity. Independently check owned service shutdown and remove residual fixture
roots without exporting their private configs/files/keys.

For captured evidence, verify the archive digest in INDEX.json before extracting
into a new empty directory using `tarfile` with `filter="data"`. Verify internal
MANIFEST.json hashes, then replay atomic_gate.py using that run's recorded WMS
SHA and local Accounting materialization SHA. This verifies the captured evidence
structure; it does not rerun the engine or replace human source review.

# Replay the bounded native verification

Use the exact WMS code SHA in RESULTS.md and the canonical Accounting source there.
A complete authorized Accounting checkout is preferred. If using a bounded app
materialization, verify every blob and record its independent witness SHA; never
label it as full Accounting acceptance.

Follow ../local-native/REPLAY.md for the marked, owned synthetic runtime, pinned
archives, Python constraints, Redis and locked Bun install. The current runner
also requires src/mariadb.tar.gz and verifies all three archive hashes and every
extracted regular file. Do not reuse a partially extracted directory or site data.

Run from the clean WMS checkout with explicit paths to Bun1.3.13, Node24.19.0,
a working ordinary Chromium and Playwright. Node runs Playwright; Bun runs Vite.

```sh
python3 verification/native_integration/bootstrap.py \
  --runtime-root /absolute/owned-synthetic-runtime \
  --accounting-root /absolute/pinned-accounting-source \
  --bun /absolute/bun-1.3.13 \
  --browser-node /absolute/node-24.19.0 \
  --browser-executable /absolute/chromium \
  --playwright-module /absolute/playwright-core \
  --output /absolute/fresh-evidence

python3 verification/native_integration/atomic_gate.py \
  --artifact-dir /absolute/fresh-evidence \
  --wms-sha EXACT_WMS_SOURCE_SHA \
  --accounting-sha ACTUAL_FULL_OR_MATERIALIZED_ACCOUNTING_SHA
```

The evidence ZIP also contains composition/market34-provenance.json and the three
external bounded composition scripts used for run13. Materialize the exact19 BORVAT
blobs from the pinned PR34 head (or use a complete authorized checkout), verify the
recorded blob hashes, and resolve the scripts' explicit workspace roots to your own
isolated checkouts. The composition uses the unchanged WMS bootstrap, adds the test
extension root to sanitized PYTHONPATH, selects the original BORVAT server-native
cycle, performs actual WMS projection readback and then runs the unchanged WMS browser.
It does not run BORVAT compiled-native-http.mjs or its frontend browser; do not label
that excluded scope as PASS. Preserve the native bootstrap's fresh-site, source-hash,
archive-integrity, guard, cleanup and outcome checks. Use an unused output directory.
Run12's missing-extension failure is retained separately from the run13 correction.

Inspect real exits, every case, source-after flags and cleanup. A blocked/failed
browser or missing case is not PASS. The gate recommends review only. Keep normal
environment restrictions and all production/provider writes disabled.

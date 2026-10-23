# Replay the bounded stock candidate

Use WMS `1bc18be3391878daebd4e5d8c3c30b494a83e31d` and Accounting
`68b4de0a5b6153153fb3feba52257a7274c820d6`. For the original partial source witness,
compare the15 files in ACCOUNTING_SOURCE_MAP.json to local Git blob hashes;
the recorded local witness is `ae990cf63a67b95f80a90682c788cff4f76a82da`.
Do not advertise a partial materialization as the entire Accounting repository.

Provision the marked runtime using the prior local-native REPLAY.md and its pinned
runtime constraints. Frappe/ERPNext16.52.0, Python3.14.8, MariaDB11.8.9,
Redis7.0.15, Bun1.3.13 and Node24.19.0 are unchanged. No upstream source patches.
Use a fresh output path and synthetic sites/credentials only:

```sh
python3 verification/native_integration/bootstrap.py --runtime-root /absolute/marked-runtime --accounting-root /absolute/accounting-source --bun /absolute/bun --browser-executable /absolute/chrome --playwright-module /absolute/playwright-core --output /absolute/fresh-output
python3 verification/native_integration/atomic_gate.py --artifact-dir /absolute/fresh-output --wms-sha EXPECTED_WMS_SHA --accounting-sha ACTUAL_LOCAL_ACCOUNTING_SHA
```

A full Accounting checkout will have its canonical SHA rather than the partial
witness SHA; bind new evidence to the actual clean checkouts. Expect38 native PASS
and one explicitly blocked browser on this restricted executor, overall exit2.
A capable browser host must execute the actual B01 scenes; helper tests or browser
version output are not substitutes. Do not weaken OS/IPC restrictions to force it.

For published evidence, verify INDEX.json archive SHA256, extract with Python
`tarfile.extractall(filter="data")`, verify every MANIFEST.json member, then run the
gate against native-final using the original source/witness SHAs. The development
archive deliberately includes failed/mixed-source exploratory runs, not acceptance.
Application-checks contains actual argv, exit codes, logs, source cleanliness and
hashes. No GitHub Actions run, billing/permission change or production access is needed.

# Replay scanner candidate

Use WMS `68ed97435cb406302b7a58ffc75b2f82b309189e` and canonical Accounting
`1b84bf9218abe5c36c0156f20c15f72999e4988c`. The original partial runtime witness is
`e9f0550980c21be266925a28efe83153010700b2`; compare its16 mapped files using
ACCOUNTING_SOURCE_MAP.json rather than claiming a complete Accounting clone.

Use the marked pinned runtime and provisioning notes in ../local-native/REPLAY.md:
Python3.14.8, Frappe/ERPNext16.52.0, MariaDB11.8.9, Redis7.0.15, Bun1.3.13,
Node24.19.0. Upstream source archives are unchanged. Synthetic fixtures include
SYNTHETIC-C1/C2 barcodes and an intentional Item-code/barcode collision to verify
ambiguity denial. No real customer, product or provider credentials are used.

```sh
python3 verification/native_integration/bootstrap.py --runtime-root /absolute/marked-runtime --accounting-root /absolute/accounting-source --bun /absolute/bun --browser-executable /absolute/chrome --playwright-module /absolute/playwright-core --output /absolute/new-output
python3 verification/native_integration/atomic_gate.py --artifact-dir /absolute/new-output --wms-sha EXPECTED_WMS_SHA --accounting-sha ACTUAL_LOCAL_ACCOUNTING_SHA
```

Bind new evidence to the actual clean checkout SHAs; a complete Accounting checkout
has its canonical SHA rather than the partial witness. This executor produces41
native PASS/1 browser BLOCKED, outer2. A capable browser/device host must actually
run the prepared scenes; do not weaken OS/IPC restrictions to force a PASS.

For published artifacts, verify evidence/INDEX.json archive SHA256, extract using
Python tarfile's `filter="data"`, verify every MANIFEST.json digest and run the gate
on native-final with the original tested WMS/partial witness SHAs. Native-final
must have no gate integrity errors while UI/operational/phase gates remain blocked.
The development archive is not acceptance evidence. Application-checks contains
actual argv, exits, clean-source status and log hashes. Hosted CI and production
access are not prerequisites for this bounded replay.

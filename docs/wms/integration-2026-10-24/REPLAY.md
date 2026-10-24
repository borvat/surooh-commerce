# Replay shared WMS / Accounting acceptance

Use the source group and actual outcomes in RESULTS.json. Run on a new disposable
Linux test host with no production data, databases or providers. Preserve normal
host restrictions: a browser denied by the host remains BLOCKED.

1. Materialize the complete current Accounting app/workbench/guard and their tests,
   not the earlier selected PR37 warehouse subset. Compare every source blob to
   the pinned canonical commit. A source materialization is not a full Git clone.
2. Follow `../local-native/REPLAY.md` for verified Frappe/ERPNext16.52.0,
   MariaDB11.8.9 archives and Python3.14/Redis/Bun dependencies. Keep original
   sources unchanged. Validate all extracted regular files before running.
3. Build the real Frappe website assets using its frozen yarn.lock. Its standard
   `frappe/public/node_modules` link must point at the installed app node_modules.
   Use the original `node esbuild --apps frappe --production`; do not substitute
   empty manifests, fabricated CSS or mocked business responses.
4. Place the resulting bench assets at RUNTIME/assets-bench/sites/assets, with
   original frappe/erpnext public asset links and the current workbench public
   assets linked under surooh_invoice_workbench. The shared runner checks for the
   built assets.json and exposes only this test asset tree inside its owned bench.
5. Freeze clean WMS and Accounting sources. Run the existing bootstrap with
   `--with-accounting-workbench` and the explicit runtime/accounting/Bun/Node/
   browser/Playwright paths documented in ../verified-cycle/REPLAY.md. Use a new
   output directory. It installs both complete apps and the native stock guard
   before warehouse tests, then executes original Accounting HTTP programs on the
   same TEST-A site. No app guard, review assertion or native permission is skipped.
6. Read bootstrap-results.json, native-tests.json, shared-accounting-results.json
   and each original suite result. Record source hashes before/after, real command
   exits, missing cases and service shutdown. An outer exit2 is not PASS. A blocked
   browser cannot become visual acceptance from the native/HTTP counts.

The explicit shared profile is for marked synthetic sites only; it is not hosted
identity or operational isolation. This replay does not cover the complete
Marketplace, a carrier/PSP sandbox, real company data or off-host restore. Native
fixture creation is not an existing-database migration rehearsal.

Earlier failed attempts remain failures. Current source changes require a new
fresh run; never reuse the predecessor run to approve a changed source group.

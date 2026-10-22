# Bounded browser harness continuation

This is test-only follow-up to WMS Draft PR22 at
`e668ed35d0d0f37286b50e8ae787dc2a40fa7256`, paired with unchanged Accounting
Draft PR31 at `34adb0e16be584b5e3823b2cb46a80abb5eaf869`.
The current owner authorized this bounded harness packet, not PREPARATION/P01/M1
acceptance, security architecture changes, merge or deployment.

The normal fresh native runner now forwards explicit browser paths through its
sanitized environment and private stdin. Ambient browser overrides are ignored.
No browser is downloaded or discovered from another workspace's caches/secrets.

```sh
python3 verification/native_integration/bootstrap.py \
  --runtime-root /absolute/marked-synthetic-runtime \
  --accounting-root /absolute/exact-accounting-checkout \
  --bun /absolute/bun-1.3.13 \
  --browser-executable /usr/bin/chromium \
  --playwright-module /opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core \
  --output /absolute/new-evidence-directory
```

Prerequisites remain the existing bootstrap contract: `.synthetic-only` runtime
marker, unpatched Frappe/ERPNext16.52.0 archives and matching extracted sources,
MariaDB11.8.9, Redis7.0.15 and the prepared Python native environment; exact
Accounting source with its synthetic guard; Bun1.3.13 and locked WMS dependencies.
Ports14306/17379/18080/18081 must be free before provisioning. Never point this
runner at production or reuse real site data. Browser traffic is restricted to
the loopback test UI. Token input and captured output remain redacted.

The expanded cycle asserts real native state for:

- Dismissed receipt form leaves stock/ledger unchanged.
- Receive, bundle save, order, pick, pack, ship, linked return and rendered history.
- Reload after pick retains the next action; replayed return after reload has no duplicate ledger effects.
- Cancel placed, picked and packed orders, release reservations and retain cancellation after reload.
- Forward a real pick then drop its response; UI retry uses the same envelope and native Pick List.
- Abort pack before dispatch, verify no mutation, then retry and cancel.
- Cancel through a separate real native command while the screen is stale; stale pick rejects, shows an error and reload removes actions.

Transport interruptions are deliberately injected; successful mutations and all
stock/valuation/GL assertions require the real engine. There are no mocked
successful business responses. Scenarios are not accepted until B01 actually runs.
This is not a full workflow, permissions, device, fiscal or load matrix.

The Python harness preserves malformed output, timeouts and missing tools as
FAIL/BLOCKED, validates exit/status agreement and kills its owned process group
on completion/timeout. JavaScript returns0 PASS,1 FAIL,2 BLOCKED. Completed
subscenarios remain visible on later failure; none closes a phase gate.

Independent regression command (child fixtures test only runner mechanics):

```sh
python3 -W error::ResourceWarning -m unittest discover \
  -s verification/native_integration -p test_browser_config.py -v
node --check verification/native_integration/browser-cycle.mjs
```

Current environment observation: installed Chromium154.0.8037.57 launches with
installed Playwright. Bun and the marked native runtime are unavailable in the
permitted workspace/tool locations; no SAM files or secrets were used. Therefore
the native B01 acceptance cycle is NOT RUN/BLOCKED. Browser capability and runner
unit tests do not replace native acceptance. Historical29/109/21/18 pass counts
remain evidence for their original tested sources, not this revision.

Rollback: discard this continuation branch and its synthetic evidence. Original
PR22/PR31, existing evidence, application code, stock authority and all gates stay
unchanged. ERPNext remains the sole stock/reservation/valuation/ledger writer.

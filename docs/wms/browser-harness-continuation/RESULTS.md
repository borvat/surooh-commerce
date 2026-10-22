# Browser harness continuation — native B01 NOT RUN

WMS source tested clean before/after: `32f3df82d3ff5227c522e98165ac3837345a7b85`
(tree `ea73263f30410fa8c7774b09ad3c1b8952b99462`). Parent is PR22 evidence head
`e668ed35d0d0f37286b50e8ae787dc2a40fa7256`. Accounting PR31 remains unchanged at
`34adb0e16be584b5e3823b2cb46a80abb5eaf869`; its native code was read through the
permitted authenticated GitHub connector, not executed here. Both repository
permissions and both Draft PR heads were verified. No SAM source or secrets used.

The normal runner now accepts explicit browser/module paths. Added browser
scenarios cover cancellation at placed/picked/packed stages, reload, return replay,
committed pick with lost response/retry, interrupted pack and stale/error recovery.
Only harness files and documentation changed. No application/security/identity,
permissions, stock authority, production, hosted rerun, merge or deployment changes.

## Exact source verification

| Check | Result |
| --- | --- |
| New harness plumbing/failure regressions | 8 PASS |
| Existing atomic evidence-gate regressions | 7 PASS |
| Existing verification-gate regressions | 14 PASS |
| JS syntax, browser formatting, Python parsing, bootstrap CLI, whitespace | PASS |
| Installed Chromium launch | Observed successful,154.0.8037.57; Playwright1.62.1 installed |
| Rendered-page capability smoke using `data:` URL | FAIL: `net::ERR_BLOCKED_BY_ADMINISTRATOR` |
| B01 harness prerequisite check | BLOCKED, exit2, zero scenarios executed |
| Actual native B01 cycle / full app build /109 WMS /21 PG /18 HTTP /29 native | NOT RUN on this source |

Preserved commands, actual exits, log SHA256s, tool versions and clean-source
provenance: [report.json](report.json). The failed rendering log is retained in
[browser-capability.txt](browser-capability.txt); the actual harness prerequisite
refusal is [B01-preflight-only.txt](B01-preflight-only.txt). No failed or blocked
check is promoted to PASS. Child fixtures used by unit tests prove runner mechanics
only. Earlier native/app pass counts remain historical evidence at their original
source SHAs.

## Exact remaining prerequisites

No marked synthetic native runtime was found in the permitted scratch/shared/tool
locations, and no Bun executable was on PATH. Supply an authorized isolated runtime
meeting [BROWSER.md](../../../verification/native_integration/BROWSER.md): unpatched
Frappe/ERPNext16.52.0 archives/extractions and prepared Python environment,
MariaDB11.8.9, Redis7.0.15, Bun1.3.13, locked WMS dependencies, and an exact clean
Accounting checkout at the SHA above. The existing bootstrap creates new synthetic
sites/DBs; do not reuse production or SAM services/secrets. Also require a permitted
browser path that can navigate the loopback UI. This executor denied `data:` URL
navigation; loopback navigation has not been tested and must not be assumed allowed.
No browser downloads, policy changes or alternate-route bypasses were attempted.

B01 is NOT RUN/BLOCKED, not a native failure or acceptance. The separate rendered
capability smoke is FAIL due to browser policy. Setup remains pending; no source
access denial or uncertain publication is being concealed. PREPARATION/P01/M1 and
all other existing gates remain BLOCKED. ERPNext is the sole writer of stock,
reservations, valuation and ledger.

This report is an evidence-only addition after the tested source; its later commit
is not advertised as an application/test-code rerun. Original PR22/PR31 and their
archives are preserved. Rollback discards this continuation branch and owned test
evidence. No native services/sites/DBs were provisioned in this continuation.

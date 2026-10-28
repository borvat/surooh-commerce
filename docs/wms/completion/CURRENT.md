# Current WMS continuation — 25 October2026 (Asia/Damascus)

**Full WMS goal OPEN. Required linked UI receipt→shipment→invoice→partial
return→credit cycle and its restart retention are NOT EXECUTED.**

This is the single current record. PR32 evidence remains at eaba5258; do not
rerun or replace it merely to restore context. Continue on independent PR33,
branch integration/wms-auth-cycle-20261025. Main/Accounting/Marketplace/SAM
branches and service configuration were not changed by WMS.

## Owner-assigned shared environment and coordination

[Shared TEST-B agreement](../integration/TEST-B-AGREEMENT.md) defines existing
service/disk IDs, responsibility split, source compatibility, secure entry,
write/deploy/restart lease, expected native audit references and rollback.
Accounting owns engine/permissions/connection contracts; WMS owns its interface,
session adapter and warehouse cycle. Technical endpoint confirmation is pending;
no WMS shared write or restart lease has been recorded. Requests are in Accounting
PR43 comments6390467481,6390570843 and6390671740. No acknowledgement or completed
review is inferred from posting a comment.

Existing base: surooh-accounting-test-b / srv-dbei3l0ae00c73d7mo80,
https://surooh-accounting-test-b.onrender.com, one1c-2g instance, own1GB disk
 dsk-dbei4avb9u1s739ptmig mounted /var/data/surooh-test. No new paid resource/cost.
Independent read-only native SQL/config/filesystem audit on instance gzfpc:
source27ac683003599d9809728801bc956a7cd522de52, invoice-lab-render,
surooh_invoice_render, companyTEST-B; Frappe/ERPNext16.52.0. Existing records:

| Native record | Grand total | Outstanding | Link |
| --- | --- | --- | --- |
| ACC-SINV-2026-00001 |20.00|20.00|Existing baseline invoice|
| ACC-SINV-2026-00002 |29.04|0.00|Existing Accounting browser invoice|
| ACC-SINV-2026-00003 |-14.52|-14.52|Credit against00002|

12 GL rows independently balance92.60 debit/credit; SLE count0. This is not a WMS
receipt/shipment cycle. Disk used626892800/free377032704 of1020702720 bytes,
mounted; enabled writer/reviewer test users.22:59Z metrics on gzfpc:
486789120/2147483600 bytes, CPU0.0096257/1, one instance. Limited samples show
headroom, not load acceptance; no insufficiency/new paid resource is established.
Accounting must reserve backup/migration disk space before shared writes.
[Sanitized baseline](../integration/TEST-B-BASELINE.json).

An initial site read used bench cwd and failed before DB connection. Corrected
sites cwd read succeeded. No data reset, delete, native financial/stock mutation,
permission/configuration change or restart was issued by WMS.

Accounting concurrently deployed4f36f192fc55c5f77d834da6ab5cdb088685e569,
dep-dbejgtlg1s2s73fq33dg LIVE23:07:01Z. Inspected delta from27ac: static invoice
JS/completion browser and owned asset-release/boot helpers/docs; native auth API
files unchanged. Do not attribute old UI/deployment tests to this entire new
source. Preserve Accounting's current work; WMS did not trigger this deployment.

## Concrete blocking dependency

The independent hosted read found only frappe/erpnext/surooh_accounting/
surooh_invoice_workbench installed, surooh_native_lab FALSE, shared profile NULL,
and no native WMS guard. Existing invoice-session authentication is supported;
the persistent native warehouse operational endpoint/profile is not admitted.
Do NOT flip flags or expose the lab Administrator executor to work around it.
Accounting must prepare/review native stock identity/permissions/profile plus
shipment-row-linked invoice and partial-return credit mapping with independent
financial review. WMS cannot invent those endpoints or create another ledger.
The proposed test-site correction remains for Accounting to review/adopt on its
own branch. No Accounting remote code change was attempted in this continuation.

Existing TEST-B browser environment is usable according to Accounting's published
18 native browser assertions at1440/390/320, quote/invoice00002/credit00003.
Their JSON and those record IDs were reviewed. This is Accounting evidence,
not WMS visual acceptance, and no screenshots are claimed newly inspected here.
No new browser resource or paid duplicate stack is needed on that basis.

## WMS session implementation and safety

Native-session code source497464529228d3eb82cc72147000b6f488d401ec;
final native-test source9f8eef52323927cc688c959476ddcbcd50100f3e, tree
028c992576b9f81e1878599f517955ad6f71c783. Difference is one native test-role
expectation only; all application/server/UI blobs are identical.

- New server-only accounting-session-v1 bridge consumes existing native login,
  invoice-workbench CSRF initialization and api.context. Fixed verified WMS and
  TEST-B origins/company; no browser-controlled endpoint/company/actor selection,
  external redirect, arbitrary RPC proxy or legacy fallback.
- Native SID/CSRF sealed with AES-256-GCM in Secure/HttpOnly/SameSite=Strict
  __Host cookie bound to origin/backend/company;15min TTL. Server-only256bit
  key, no default key. Credentials/SID/native CSRF never returned to browser JS
  or stored in localStorage. Every read revalidates native company/current roles.
- Proxy CSRF/origin checks, bounded request/response bodies, sanitized errors,
  expiry/tamper/duplicate-cookie/key/company rejection. Logout always clears the
  local cookie when its response is delivered; native failure is explicitly
  unconfirmed rather than labelled successful revocation.
- New /accounting-connection route shows verified company/user/native review
  role and explains that warehouse cycle admission is still pending. It never
  calls stock/financial mutations or navigates into the legacy stock writer.
- Capabilities warehouse_commands and shipment_invoice_cycle are FALSE. A signed
  identity does not authorize warehouse writes; command route returns409 after
  authentication. Profile remains OFF by default and is not active on Render.

Server secret names and dedicated HTTPS entry are in the shared agreement; never
paste a key/password into GitHub/chat or VITE settings. Accounting selects native
identities/permissions through the protected provider path. WMS owns its cookie
key/configuration only after a reviewed source group and test window exist.

## Source-bound verification (separate tiers)

| Tier | Observed result | Boundary |
| --- | --- | --- |
| App/source checks at49746452 |183 PASS; type/build-node PASS; lint0errors/15 existing warnings; foundation25/validator14/config10/helper14 PASS|Transport/SSR/helpers are not native/browser proof|
| Actual built Node route |Disabled auth endpoint returns503; no legacy fallback; server-only key/crypto code absent from public bundle search|No live profile enabled|
| Native run auth01 at49746452 |55 WMS native PASS;12 Accounting HTTP PASS; new session probe FAIL after guest denial|Wrong test expectation for native writer fixture role; retained|
| Native run auth02 at9f8eef52 |55 WMS native PASS;12 original Accounting HTTP PASS;11 actual native HTTP session cases PASS|Local fresh coinstalled sites, not hosted B lifecycle|
| Native session before/after |SLE77/netqty140/value-difference2270 identical; GL193/debit6649.2/credit6649.2 identical|Shows session work caused no stock/GL effect, not requested cycle|
| Current WMS internal1440/390/320/browser/restart cycle |NOT_RUN /BLOCKED|Requires Accounting operational contract + agreed shared window|

The original Accounting app/guard/test materialization is canonical27ac's exact
238 matching blobs plus ONE local proposed delivery_checks.py site-selection line;
local witness fea52a54aab97e0d5be288d01ab2928249b5fbb0 is not a canonical remote
Accounting commit. Shared original55/12 remain bounded co-installation evidence.
The host blocks local Chromium Unix sockets; it does not prove existing TEST-B
cannot run browsers. Native outer/gate exit2 is retained; gate has zero integrity
errors and recommends native evidence review only. No full goal/release approval.

The first session probe incorrectly expected writer can_review=false. Original
Accounting fixtures explicitly grant Accounts Manager to BOTH writer/reviewer;
corrected test expects the original declared role. No native role/assertion/guard
was removed or changed. Earlier synthetic transport suite timed out at its default
5sec while testing a15sec upstream budget; explicit250ms loopback-only fixture
budget now tests abort semantics; hosted limit remains15sec. Both failures remain
recorded. Final source files remained clean/unchanged during native runs.
Owned MariaDB/Redis stopped exit0, private fixtures removed; independent readback
found zero remaining owned fixture roots. Raw configs/passwords/session cookies/
credentials/private logs/databases are not published.

[Machine-readable results and hashes](../integration/SESSION-RESULTS-20261025.json).
Official engine refs unchanged: Frappe4515014c87ece6cb20ee91d2cfb121c5cbd1ff4a,
ERPNext90cb7f9243048a44311777d60a1cec8ca05ceec9; verified original16.52.0 archives;
local MariaDB11.8.9/Redis7.0.15/Python3.14.8, Bun1.3.13/Node24.22.1.

## Deployed vs tested; exact next action

Existing WMS srv-dbe28f7f3r2c73cfhe0g still runs
2a1adc7dfc531a13678498745c388e6ef2fe672a /dep-dbe28g7f3r2c73cfhgm0,
branch deploy/isolated-render-test-20261024, free/auto-deploy OFF. New PR33 source
is NOT deployed. Existing URL https://surooh-wms-isolated-test.onrender.com is not
an accepted native interface; do not paste Accounting/SAM credentials into its
older Supabase login. Do not use SAM's service/DB or alter current TEST-A.

Next dependent work: Accounting confirms/adopts site correction and supplies the
persistent warehouse session/profile/stock and linked financial APIs on its own
branch, records source compatibility and shared write/restart window. Then WMS
binds its existing UI, executes one owned synthetic SKU receipt→shipment→THAT
invoice→partial return→THAT credit with native review and reference/value/GL
readback at1440/390/320. Accounting performs the coordinated same-service restart;
WMS re-reads the SAME business records/amounts/attachments. No new identity on an
uncertain mutation; use native command status first. Separate tests do not close
any of those missing stages. Do not reset/reseed current B data to start.

Replay session proof using the original native bootstrap plus explicit
--with-accounting-workbench --with-wms-session-bridge, verified sources/assets,
fresh local evidence and private synthetic credentials. Keep the Accounting
proposal/source witness distinct and preserve original failures. Use actual
recorded SHAs for atomic_gate.py. For Node packaging use NITRO_PRESET=node-server.

Rollback discards/reverts independent PR33; no schema/native data rollback or
Accounting service change is needed. If later activated, disable only new WMS
session admission; do not replace native data or clear uncertain command intents.
No main merge, production action, real provider/mail/payment or new paid resource;
new infrastructure cost from WMS is USD0. Full goal remains OPEN.

## Final independent readback after concurrent Accounting deploy

On new instance82qpc actual source4f36f192fc55c5f77d834da6ab5cdb088685e569,
mounted disk free375070720 bytes. Original invoices00001/00002/00003 retain their
same values/status/linkage. Additional Accounting test invoice00004 and credit
00005 appeared; GL now22 rows balances165.20/165.20, SLE remains0. These were not
created by WMS, which issued SELECT/config/filesystem reads only. This verifies
preexisting document retention across an Accounting-owned deployment, NOT the
requested WMS cycle or coordinated WMS restart. See updated baseline JSON.

Important auth limit: existing api.context requires Accounts User; current bridge
proves only Accounting-user sessions. No financial roles may be granted to WMS
clerks as a workaround. The Accounting-owned warehouse identity/capabilities and
native operational contract must support minimal stock roles. The current
Manager-bearing native invoice fixture is not warehouse least-privilege proof.

<!-- project-memory-state-v1 -->
```json
{
  "event": {
    "blockers": [
      "Accounting-owned persistent warehouse identity/profile/stock and linked invoice/credit APIs are not admitted.",
      "No agreed shared write/restart window; required linked UI receipt\u2192shipment\u2192invoice\u2192partial return\u2192credit/restart cycle is NOT_RUN/BLOCKED.",
      "Native invoice Manager fixture is not proof of minimal warehouse clerk privileges."
    ],
    "deployment": {
      "status": "unverified"
    },
    "evidence": [
      "docs/engineering-memory/evidence/normal-adoption-acceptance-20261028.json",
      "docs/engineering-memory/evidence/ordinary-acceptance.json"
    ],
    "id": "surooh-commerce-normal-adoption-accepted-20261028",
    "next_steps": [
      "Use original BMAD ordinary tasks on integration/wms-auth-cycle-20261025; current Git outranks stored prose, candidates remain inactive, and source-bound historical suites are not a new runtime PASS.",
      "Use original bmad setup/build in this reviewed branch; memory activation and material-result archiving need no per-task memory prompt.",
      "For application continuation consult the existing source-bound product state and blockers; prior application tests keep their exact historical identity.",
      "Preserve current project/application blockers and historical test identities; no operational delivery is implied."
    ],
    "recorded_at": "2026-10-28T00:52:43Z",
    "schema_version": 1,
    "source": {
      "content_sha256": "78487b01730d1ccff2c434e808046a5e05ad2ca168719b79e9d1e73ecf7c646c",
      "head": "fdb14873e119a0469277cd15c6804e303d6a503d"
    },
    "status": "complete",
    "summary": "Development memory adoption is integrated and authenticated on integration/wms-auth-cycle-20261025. Original BMAD clean setup/activation/retrieval and independent ordinary acceptance passed. Helper unchanged; tests keep historical identities; project/operational gates remain separate. Surooh WMS interface with retained catalog/Bol workflows and native ERPNext/Accounting warehouse authority. Architecture: TanStack/React UI and Node server modules; native warehouse commands and durable intent/projection helpers. Modules: src/lib/accounting-session.server.ts, src/lib/native-lab-client.ts, src/lib/native-stock-journal.ts. Selected PR33 integration/wms-auth-cycle-20261025 at4f3ba62633e513c5b08aa8cd3ec06f16dd702e60 (tree e7443f9485dbe311e24e0c748b80cee2a0482269). CURRENT.md says full WMS goal OPEN and new PR33 source NOT deployed. Its existing Render/native observations are historical; no new deployed/tested identity was verified by this memory task.",
    "tests": [
      {
        "evidence": [
          "docs/engineering-memory/evidence/normal-adoption-acceptance-20261028.json"
        ],
        "name": "Clean original BMAD setup activation audit brief and source-bound retrieval",
        "scope": "historical",
        "source": {
          "content_sha256": "91c9e9586ada73826ea6a4cc16479e891edc486fe96947a7829fda59bba5a27c",
          "head": "fdb14873e119a0469277cd15c6804e303d6a503d"
        },
        "status": "pass"
      }
    ]
  },
  "event_digest": "64fff72c491f87c3213ad83df2a401e3ff683d3003ea21086857e300a02e7007",
  "schema_version": 1
}
```
<!-- /project-memory-state -->

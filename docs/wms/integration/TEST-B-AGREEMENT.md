# Shared TEST-B integration agreement

Status: owner-assigned responsibility split; Accounting technical review and
native warehouse endpoint admission PENDING. Not a compatible-stack certificate.
No deploy/migration/test-write lease is currently held by WMS.

## Scope and owners

Owner instruction25 October2026: reuse the existing paid surooh-accounting-test-b
as the proposed integration base, inspect before use, preserve all data. Accounting
engineer owns engine configuration, identities/permissions and connection contracts.
WMS engineer owns the WMS interface, safe session adapter and warehouse lifecycle.
Both retain independent branches. No new paid resource or unilateral Accounting
service change. A green unit suite is not lifecycle acceptance.

| Resource | Identity | Responsible party | Current observed boundary |
| --- | --- | --- | --- |
| Native TEST-B |srv-dbei3l0ae00c73d7mo80; https://surooh-accounting-test-b.onrender.com|Accounting engineer|Frankfurt; one1c-2g instance; native MariaDB; auto-deploy OFF|
| TEST-B disk |dsk-dbei4avb9u1s739ptmig;1GB; /var/data/surooh-test|Accounting engineer|Preserve native DB/files/config/key and existing records; no reseed|
| WMS interface |srv-dbe28f7f3r2c73cfhe0g; https://surooh-wms-isolated-test.onrender.com|WMS engineer|Existing free Node service; no new resource; native auth not enabled|
| WMS code |integration/wms-auth-cycle-20261025, from PR32 eaba525812c573920bb650a832df4ec4e01631cf|WMS engineer|Independent continuation; do not overwrite PR32/shared branches|
| Accounting code |completion/persistent-accounting-20261025, PR43|Accounting engineer|Observed branch27ac683003599d9809728801bc956a7cd522de52; independently read deployed executable27ac683003599d9809728801bc956a7cd522de52|

Executable source vs documentation head must always be recorded separately.
Observed existingB capacity: latest sampled memory456,486,900/2,147,483,600 bytes
(~21.3%); CPU0.0033/1 core, one instance. Earlier2GB sample456,761,340 bytes and
CPU0.0105. This is idle/limited-sample headroom, not a lifecycle load test; no
insufficiency/new paid resource is established. Disk used/free and current native
row/reference baseline need Accounting/read-only verification before a write lease.

Accounting CURRENT at27ac6830 reports native invoice ACC-SINV-2026-00001 TEST-B,
EUR20/outstanding20, native GL balanced20/20, private attachment and site key
retained across same-service restart/redeploy. Its source-bound restore compared
785 tables/23653 rows/one file. These are Accounting evidence, not WMS independent
verification or the new full lifecycle. Existing browser acceptance is still open.
No existing invoice, key, backup or private file may be overwritten/reset to test.

## Current compatible interfaces and missing contracts

| Interface | Current state | Owner / requirement |
| --- | --- | --- |
| Native login, invoice-workbench page/CSRF and api.context |Existing session-authenticated marked TEST profile; fixed company/current user/native role checks|Accounting owns native identity and role setup; WMS adapter consumes this contract|
| WMS accounting-session-v1 adapter |New candidate; Secure/HttpOnly/SameSite cookie wraps native session; exact TEST-B/server origin binding; no native credential sent to browser JS|WMS owns implementation and tests; disabled until reviewed source and secure configuration are selected|
| Local lab JWT warehouse API |Loopback synthetic proof only; not admitted by the persistent invoice profile|Accounting must define/admit the operational identity/endpoint; WMS must not remove guard or expose synthetic Administrator executor|
| Shipment-linked native invoice / partial credit |No accepted source-bound endpoint yet established|Accounting owns native mapping, independent approval and financial permissions; WMS owns workflow/refs/retry UI|
| Native command status |No agreed persistent hosted contract|Accounting provides authorized, company/source/actor/request-bound status and native references; WMS queries before uncertain retry|
| Test site correction |Original delivery_checks.py ignores INVOICE_LAB_SITE; one-line local proposal preserves original fallback and all assertions|Accounting reviews/adopts on its own branch. WMS posted evidence/request in PR43 issuecomment6390467481; private patch prepared, not applied remotely|

No shared schema/API mutation or production profile is approved by this file.
There is currently no accepted compatible WMS+Accounting release pair. Freeze the
actual full SHAs and installed apps/engine commits after both parties confirm.
The proposed adapter authenticates identity only; it explicitly reports warehouse
and shipment/invoice capabilities false and refuses any stock RPC proxy/fallback.

## Secure configuration and entry

For the implemented WMS candidate only (not active today):
SUROOH_WMS_AUTH_PROFILE=accounting-session-v1
SUROOH_WMS_ORIGIN=https://surooh-wms-isolated-test.onrender.com
SUROOH_WMS_ACCOUNTING_ORIGIN=https://surooh-accounting-test-b.onrender.com
SUROOH_WMS_ACCOUNTING_COMPANY=TEST-B
SUROOH_WMS_COOKIE_KEY=<32 random bytes encoded as43 base64url characters>

COOKIE_KEY is server-only, inserted into the WMS Render service's protected
Environment setting through an approved secret path, never VITE/client code,
chat or git. Do not place a real value in this document. Preserve it on WMS
restart or explicitly invalidate sessions during planned rotation. Native roles,
credentials and permission review belong to Accounting. Enter only the dedicated
@example.invalid test identity through /accounting-connection over HTTPS after
activation. No native signing key, recovery key or SAM token is requested.

## Lease before any shared writes/restart/deploy

Record a lease in the PR43 coordination thread referencing this file: responsible
operator, existing service+disk IDs, exact source pair, baseline record IDs/hashes,
owned synthetic SKU/customer/order prefix, start/end window, expected CPU/memory,
backup/restore checkpoint, planned mutations and stop criteria. Accounting confirms
native service readiness and no overlapping test/migration/deploy. WMS confirms UI
candidate/route. Until recorded, WMS makes no native business mutations, restart,
reseed or deployment/configuration change on Accounting.

A service-instance change was observed while opening read-only Shell; no WMS
command had been entered. Do not interpret disconnected Shell as missing data or
restart it. Reconfirm active deploy and test window rather than competing with
ongoing Accounting work. No password/config/key is to be printed for coordination.

## Required next delivery: one linked, persisted browser cycle

1. Freeze both complete application SHAs, engine/Frappe commits, installed apps,
   service/deploy/instance/disk IDs and native current company. Read baseline
   stock/value/SLE/GL and existing invoices/credit/attachments without editing.
2. In WMS UI, receive an owned synthetic SKU at a known quantity/unit cost using
   a native receipt; reconcile quantity, valuation and expected balanced GL.
3. Create/reserve/pick/pack/ship the owned order from WMS UI. Confirm one native
   Delivery Note and correct SRE/SLE/COGS/stock GL with stable request identity.
4. Use the approved native financial mapping and independent Accounting reviewer
   to issue THAT shipment's invoice with native order/delivery row references.
   No separate service invoice or manual parallel GL substitutes for linkage.
5. Return only part of THAT shipment via UI; apply approved inspection/disposition,
   then issue the linked partial native credit with cumulative quantity/value caps.
   Match original/returned units, warehouse value, native COGS reversals, invoice/
   credit amounts, tax and balanced accounting references without duplicate effects.
6. Repeat/reload an uncertain response with native command-status readback, not a
   new identity. Assert no duplicate stock movement, invoice, credit or GL.
7. Execute and visually inspect authenticated internal screens at1440/390/320,
   Arabic/RTL, loading/error/empty/permission states. Login alone is not UI proof;
   mock transport, original native tests and rendered cycle are separate tiers.
8. During the coordinated window, Accounting owns the same-service restart.
   Re-read exact SKU/order/DN/return/invoice/credit IDs, quantities/value/GL and
   attachment hashes through WMS/native independent reads. Session expiry may
   require safe re-login; it is not lost business data. Record new instance ID.
9. Record before/after result, actual command exits, source fingerprints, sanitized
   screenshots and native readback hashes. Preserve failures/blocked steps. No
   acceptance unless the same linked record group survives restart.

## Stop and rollback

Stop shared mutations on wrong company/source, missing review, unknown outcome,
resource pressure, storage mismatch or another operator's deploy/test window.
Keep existing data and pending identities; do not reseed or erase failures.
Disable only the new WMS session admission/revert the independent frontend if
needed. Accounting controls any service rollback, native backup/restore/migration.
Application rollback does not reverse native business documents or GL. No new
cost; existing capacity must be measured before proposing a specific increase.

## Independent read-only baseline update

See TEST-B-BASELINE.json. On instance gzfpc, native site invoice-lab-render,
DB surooh_invoice_render, actual source27ac6830, both engine versions16.52.0.
The volume is mounted; used626892800/free377032704 of1020702720 bytes.
At22:59:04Z CPU0.0096257/1, memory486789120/2147483600, one instance.
Native financial records00001/00002/00003 remain present, amounts20/29.04/-14.52;
credit00003 links invoice00002;12 GL rows independently sum92.60 on both sides.
Zero SLE rows: no warehouse receipt/shipment has been tested on this site yet.
Native lab flag is false and shared profile absent; installed apps omit the
native WMS stock guard. Do not flip flags to bypass that boundary. Accounting
must provide the compatible operational profile/permissions/financial mapping.
No data was written, reinitialized or deleted by this read-only audit. An initial
site lookup used the bench cwd and failed before connecting; corrected sites cwd
read succeeded. Native invoice baseline proves current records, not the required
linked warehouse cycle or future restart retention. Available capacity is not
load acceptance, but does not justify a new paid resource at this point.

## Final concurrent-deployment readback and least-privilege boundary

Independent SELECT/config/filesystem read on new instance82qpc confirmed actual
source4f36f192fc55c5f77d834da6ab5cdb088685e569, same mounted volume, free375070720
bytes. Existing00001/00002/00003 retain identical document values/status/linkage;
concurrent Accounting tests additionally created00004/credit00005. GL now22 rows,
165.20 debit=credit, SLE still0. This is preexisting-record retention across an
Accounting-owned deployment, not a WMS-created cycle or WMS-owned restart test.
Native lab remains false/shared profile null and installed app set unchanged.
No WMS business call, restart or service change was made.

The existing native api.context requires Accounts User. The WMS bridge currently
proves Accounting-session compatibility only. Do not grant financial roles to a
warehouse clerk merely to make this identity check pass. Accounting must supply
and review a minimal warehouse identity/capabilities/operations contract; WMS
will bind to that separately versioned contract while preserving native role
checks and independent financial review. No warehouse least-privilege acceptance
is claimed from the Manager-bearing synthetic invoice fixture identities.

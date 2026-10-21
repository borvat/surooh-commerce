# Current cross-system disposition — overrides earlier comparison preference

Owner direction approved: shared ERPNext16 accounting/native stock/valuation/COGS with independent Surooh app and current WMS UI/bol/bundle logic retained. Legal-company sites/DB/storage/service identities separated. See [joint preparation](../shared-core/README.md), [authority](../shared-core/AUTHORITY.md), [gates](../shared-core/GATES.md) and [phase alignment](../shared-core/PHASE_ALIGNMENT.md). Production adoption, Codex, merge and migration remain held. Earlier comparison/measurement below remains historical evidence; its unresolved/Tryton-first recommendations are superseded only as engineering direction. No past unexecuted PostgreSQL or security test is relabelled passed.

---

# Evidence closure and three-architecture decision review

Snapshot: 2026-10-21 UTC. Review baseline: research commit `c739bf4ad1007d46df97eac900a0863e4079830b`. Owner accepted preparatory research, explicitly withheld Tryton adoption and Codex handoff. This report supersedes the earlier implication that Tryton is the selected foundation. **No final engine winner is demonstrated. P01 is not eligible for Codex handoff.**

## What actually ran in this review

- Tryton 8.2 runtime: **six additional native tests passed on SQLite in 15.509 seconds**. Two fictional companies, each with one non-admin stock user restricted to that company, received 7 and 99 units of one shared catalog product. Real JSON-RPC via the upstream WSGI in-process client exercised list, direct record read, export and inventory reporting. Both users' positive controls worked. Foreign-company direct read/export was denied; forged company/private `_companies` request contexts did not expose foreign moves; reports did not return the other company's quantity.
- Native `ir.queue.push` + `ir.queue.run` were executed in an internal worker-style transaction. An observer called the real native export method and captured its actual return; it did not mock the returned data. The trusted context without `_check_access` exported company B's synthetic quantity 99 for a company A user. With `_check_access=True`, the foreign record was excluded before export. **This is an observed unsafe configuration for delegated Surooh jobs, not successful tenant acceptance.** The job was seeded by trusted test code, so this does not establish remote exploitability or that arbitrary users can enqueue arbitrary jobs. No process-pool daemon, PostgreSQL queue locking or production job was exercised.
- Frappe **16.50.0** commit `f20f92d29706510551b4438cc196b0323a7f1a92` and ERPNext **16.52.0** commit `90cb7f9243048a44311777d60a1cec8ca05ceec9` were installed in a separate Python **3.14.8** environment. Native imports succeeded; Bench **5.24.1** and psycopg2-binary **2.9.13** are installed. **No site was initialized and no ERPNext database/business scenario ran.** Installation/import success is not an ERPNext PostgreSQL prototype pass.
- Advisory lookup of the actual installed Python environments: Tryton 33 distributions, no known vulnerability records returned by that scan. ERPNext/Frappe environment 155 inventory entries, seven affected distributions, 63 records with 60 distinct primary IDs. The ERPNext and Frappe editable projects themselves were skipped by the PyPI advisory lookup; core source is not audited by this scan. Duplicate/alias IDs and applicability require triage. See normalized reports and spot checks. No automatic package upgrade was applied.

These six tests are additional to the earlier 35 Tryton and 11 InvenTree passes. Do not sum them into completed Surooh acceptance: one passed test deliberately confirms a worker isolation gap, and backend/role/path coverage remains bounded.

## PostgreSQL environment and exact blocker

Local TCP loopback works, Unix sockets do not. The host exposes only UID 0 in its user namespace. Spawning a non-root process returns `EINVAL`; attempting an ordinary user-namespace mapping returned `Operation not permitted`. There is no Docker/Podman runtime. A normal PostgreSQL server cannot be started as root. No root-check patch, privilege spoof or security bypass was used.

A **new, separate Render PostgreSQL 16 instance** was provisioned on the **free** plan: `surooh-wms-evidence-synthetic-20261022`, ID `dpg-dbcj5o7b9u1s73brr9bg-a`. Provider status reached `available`; expiry reported `2026-11-20T21:47:12.20679Z`. No paid service was created and no existing database was modified. Its IP allowlist is empty (deny external access), and no application connection URI has been retrieved. The Render connector exposes metadata and read-only SQL, but not the required connection-info/network update operation. Its read-only query attempt was rejected with `INVALID_ARGUMENT`, explicitly because the empty external allowlist blocks access. **Provider status available is not proof that Tryton or ERPNext connected.**

The supported next step is limited Dashboard access to this newly created synthetic instance: obtain its external TLS connection URI and allow only the test client's egress IP, then run both isolated apps against separate logical databases/users. Credentials must stay outside Git and reports. Do not open broad public access, use production URLs, or upgrade the plan if quotas prevent the run. Browser fallback approval is required by the browser tool's connector-fallback rule; it has not been requested/granted yet. Alternatively the owner can provide an explicitly isolated reachable test endpoint through a secret channel. No URI/password should be pasted into a public Issue.

## ERPNext PostgreSQL compatibility: avoid an outdated inference

The pinned ERPNext v16.52.0 checkout **contains a PostgreSQL server test workflow**, opt-in via a `postgres` label, Python 3.14 and a PostgreSQL service; it invokes the native ERPNext suite. Its helper defaults the Frappe checkout to the branch under test. The selected Frappe 16.50.0 satisfies ERPNext's declared `>=16.50.0,<17.0.0` range. These are stronger current source facts than older forum statements about develop-only support. We do **not** conclude that all stable v16 PostgreSQL operations are unsupported from those historical statements.

Conversely a workflow file is not a successful workflow run or a supported-production SLA. Actual site initialization, migrations, stock/GL postings, permissions and upgrade tests for this exact pair remain unexecuted. The upstream CI example uses PostgreSQL 13.3; the planned isolated experiment uses 16 and must record this difference. An independent ERPNext practical competitor test has therefore **not yet been completed**.

## Gate disposition

| Gate | State after this review | Evidence / remaining blocker |
|---|---|---|
| G1 native PostgreSQL concurrency/atomicity | BLOCKED | New server provisioned; no reachable client connection/URI. No independent PostgreSQL sessions, race winner, atomic BOM rollback, deadlock/retry or cancellation race evidence. |
| G2 tenant and worker security | PARTIAL, with observed worker-policy gap | Real restricted-user SQLite JSON-RPC/read/export/report controls passed; trusted native queue exported foreign data without access checks. A reviewed fail-closed worker adapter plus PostgreSQL role/queue/revocation tests is required. |
| G3 full WMS/channel cycle | PARTIAL | Prior native stock and kit scenarios plus new authorization tests; no single full cycle covering two native competing kits, quarantine inspection, provider replay and Accounting export on PostgreSQL. |
| G4 support/security/license/upgrade/TCO | BLOCKED | Real dependency inventories/scans and architecture model added; ERPNext advisory findings need triage, core code not covered by PyPI scan, compatibility/support and migration/restore tests remain unexecuted. |

No gate was closed using a skipped, unavailable or discovery-only assertion. Neither owner research acceptance nor infrastructure provisioning changes execution authorization.

## Three architectures

| Dimension | A: Tryton WMS + ERPNext Accounting | B: ERPNext WMS + Accounting, Surooh modules | C: Continue Surooh Commerce + missing WMS functions |
|---|---|---|---|
| Stock/financial ownership | Tryton physical ledger; ERPNext GL; durable cross-engine event mapping and reconciler | Native stock and GL voucher linkage; one ERP owner per stock event | Supabase physical ledger; Accounting remains an external contract until its chosen engine is approved |
| Implemented evidence here | Tryton native stock/kit and bounded user API tests; ERPNext import only | Pinned stock controller calls GL posting for perpetual inventory; no native stock/GL runtime proof here | Existing source locks/BOM/RLS and UI/contracts; no newly executed PostgreSQL baseline |
| Shared-company boundary | Map company IDs across two auth systems; explicitly check worker contexts | Company permissions, Warehouse/Account ownership and reports must be tested; a shared site is application isolation, not separate databases | Explicit organization_id/RLS plus scoped service functions; deployed mappings and limited-role proof still missing |
| Shared core feasibility | Two engines and databases; accounting event dedupe and valuation alignment required | Technically plausible: ERPNext StockController already posts GL entries; independent Surooh apps can expose facade/UI while using shared documents. Module visibility is not security. Separate WMS clerk/accountant roles must constrain direct APIs, exports and jobs. | Highest current UI/SQL reuse, but receiving, persisted shipments, quarantine returns and transfers must be completed |
| Failure boundary | Stock may commit while accounting consumer is down; durable outbox/reconciliation and ordered corrections mandatory | Shared application/DB outage affects both. Posting transaction/valuation coupling must be verified rather than assumed. | Inventory outage separate from Accounting, but own WMS correctness and migration debt remain |
| Upgrades/maintenance | Two Python application version graphs, two release rehearsals, mapping contracts and reconciliation | One Frappe/ERPNext version graph plus Surooh app migrations; stronger coupling and wider outage blast radius | TypeScript/Supabase stack familiar; own domain tests/security upgrades and migrations carry more implementation ownership |
| API/integration | Surooh facade mediates both engines; never dual-reserve | Surooh facade over one engine; prohibit competing financial postings from legacy Accounting | Existing bol/identity facade retained; preserve disabled writes and strengthen DB contracts |
| License boundary | Tryton GPLv3, ERPNext GPLv3; Frappe MIT; extensions/distribution need review | ERPNext GPLv3, Frappe MIT; custom-app linkage/distribution obligations need explicit review | Current Surooh root licensing/ownership unresolved; dependencies need inventory; do not copy GPL code into an unlicensed app |
| Performance evidence | No comparable PostgreSQL benchmark | No ERPNext DB benchmark | No new current-engine benchmark |
| Current conclusion | Credible WMS candidate but extra stock-to-GL consistency/operations cost | Strongest shared-core **hypothesis to validate next**, not an approved winner | Preserve as the unchanged operational baseline/fallback; not demonstrated superior |

**Recommendation at this evidence boundary:** keep all adoption decisions conditional and preserve current Commerce. Test B against A before selecting the final platform. The earlier preference for Tryton does not justify choosing A before testing ERPNext's shared stock/GL behavior. C remains a real fallback if the OSS adapters/security/compliance work outweighs workflow reuse; its superiority is not established either. No final engine ranking can be supported by an ERPNext environment that has only imported successfully.

## Interface preservation and acceptance

All three options preserve Lovable React/TanStack Arabic UI and current bol identity/read-only modules. Introduce a versioned facade only after foundation approval; no UI rewrite is part of this evidence stage. Identity remains canonical product/physical components with many scoped offers/EANs, never additive offer stock. Use original order/event IDs with company/account scope; snapshot BOM at reservation; keep provider publication disabled. For B, don't run a parallel writable Supabase stock ledger or double-post financial documents. For A, commit one physical event and send one deduplicated Accounting event with replay/reconciliation. SAM receives scoped summaries or explicit delegated commands, never shared administrator credentials.

## Performance and three-year cost

No throughput/latency winner is claimed. Local SQLite API timings, Python import time and a free 0.1 CPU database cannot establish production-scale comparisons. Required common benchmark: same catalog/order fixtures, independent reservation sessions, three repeat runs, 1/8/32 concurrent requests, p50/p95/p99, lock wait/retries, committed effects, CPU/RAM, queue lag and restore/upgrade duration. Record hardware/network distance and complete result hashes. Measure no-oversell/atomicity before throughput.

The following is a **joint architecture planning estimate**, not a quote or measured cost. It is not directly comparable with the earlier WMS-only TCO table. Assumptions: two legal companies, four warehouses, 10 users, 20k SKUs, 500 orders/day, 36 months, €60/hour. Initial hours cover remaining WMS work, integration/mapping, synthetic migration and validation; reusable accounting functionality is assumed for A/B. Company-specific statutory accounting/localization requirements and current Surooh Accounting implementation have not been audited here; C's full accounting completion is therefore an unpriced addition.

Formula: labor = initial hours + 36×monthly maintenance hours + 3×annual upgrade hours; total = labor×€60 + 36×monthly infrastructure. Ranges below are scenario assumptions, not measured savings.

| Architecture | Initial hours | Maintenance h/month | Upgrade h/year | Infrastructure/month | Modeled 36-month total |
|---|---:|---:|---:|---:|---:|
| A | 1000–1800 | 30–50 | 160–280 | €220–600 | €162k–288k |
| B | 800–1500 | 24–42 | 120–220 | €160–450 | €127k–237k |
| C | 1000–1900 | 24–44 | 100–200 | €100–350 | €133k–258k + unpriced Accounting completion |

Ranges overlap; a few hundred hours of unknown integration or security work can reverse the result. Apply ±50% discovery contingency and replace assumptions with timed spikes before committing. Excludes tax, paid support, hardware/scanners, marketplace/carrier fees, statutory certification and 24×7 operations. No paid compute or purchase was authorized/created during this review.

## Phase eligibility and rollback

P00 remains open. P01 is **NOT ELIGIBLE FOR CODEX HANDOFF**. Close G1–G4 with exact-version/backend/role evidence, get owner foundation acceptance, revise P01–P09 scopes for the selected architecture, then obtain a separate explicit phase-start authorization. Current phase gate keeps all execution, automatic merge and deploy disabled.

Rollback now: application has not changed; research commits may be left as drafts. The free database is isolated, unused by apps and externally closed; leave it as a temporary test resource only and remove it after the evidence run through an approved management path. Provider expiry is recorded, not substituted for a verified cleanup. Production cutover, customer migration and production restore procedures are not authorized by this report.

Evidence files: `closure/tryton-security-sqlite-corrected.txt`, normalized advisory reports, runtime inventories, environment/provisioning metadata and bootstrap summary. `research/wms-oss/closure/tryton_security_probe.py` is the executed native test source. The failed initial queue harness used the integer ID returned by push as an object; corrected rerun wraps it in Queue(id). Initial error evidence is retained; it is a harness correction, not a hidden product failure.

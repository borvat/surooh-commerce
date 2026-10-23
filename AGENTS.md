<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- All business data is scoped by organization_id with RLS via is_org_member/has_org_role; legacy global user_roles is unused — multi-company safety.
- Stock ownership lives on listings/order lines (FBR=INTERNAL reserves BOM parts, FBB=BOL never touches internal stock); EAN is only a matching hint.
- Marketplace stock writes go only through inventory_outbox (idempotency key, one queued/sending per listing); sales_channels.live_write_enabled is CHECK-locked false until a later migration.
- bol credentials: Client Secret AES-GCM encrypted with BOL_CREDENTIALS_KEY in server functions (src/lib/bol.server.ts); channel_credentials has no browser access, UI sees only last4/status via channel_credential_status() — why: no readable secrets.
- CSV imports are SECURITY DEFINER import_* RPCs: validate-only mode first, apply is all-or-nothing in one transaction.
- run_acceptance_test() executes the brief scenario inside a subtransaction and always rolls back.
- bol-first workflow: imported offers create catalog products; stock items use hidden 1:1 components and bundles reference products — why: owner starts from bol, not abstract parts. Arabic RTL nav: الرئيسية, منتجات bol, البندلات, المخزون, الطلبات, حسابات bol, السجل, الإعدادات.
- Suggestions live on /review (same product, multipacks, variants, needs review); variants share family_key but never stock — why: distinct packs/colours are distinct stock.
- Product corrections override bol colour/pack per offer and name per product; suggestions prefer overrides and bol refresh preserves corrected names — why: marketplace metadata can be wrong.
- Direct bol links use the webshop bolProductId resolved from EAN and stored per offer during enrichment; never link to EAN search — why: the owner needs the actual product page.
- bol is READ-ONLY: BOL_WRITE_ENABLED=false in src/lib/bol.server.ts; updateOffer/updateBolOffer call assertBolWritesEnabled() before any fetch, and no UI calls them — why: owner must explicitly enable writes later.
- Product intelligence (src/lib/product-intelligence.ts) scores same/multipack/variant suggestions with evidence+conflicts; rejections persist in product_review_decisions — why: name similarity alone is unsafe.
- merge_products never sums stock (>1 stocked side needs _keep_target or _stock_value), confirms target+source active offers in one transaction, and requires ONE master_reference (keeps a single existing one, refuses overwrite, owner picks via _master_reference when none/conflicting); plan_stock_sync gives every confirmed FBR offer the same canonical target (cap 999), FBB/unconfirmed excluded, outbox never dispatched — why: one product, one stock pool, one reference.
- Product Master: structured attributes live in product_attributes (source bol|imported|inferred|manual, status confirmed|suggested|conflict|unknown) resolved by src/lib/product-master.ts with precedence manual > bol > inferred; offers disagreeing on a critical attribute become a conflict — why: future suggestions must use sourced data, not title guesses.
- Families are product_families + products.family_id (organisational only, never shared stock); relationship kind is products.relationship_type (MULTIPACK|BUNDLE|KIT|SET) + relationship_status, with bom_lines still driving availability — why: explicit relationship types without replacing the safe engine.
- Unified stock: a canonical product owns ONE stock pool and ONE master_reference; every confirmed FBR offer's target qty = canonical available (cap 999) and target ref = master_reference, computed in src/lib/unified-stock.ts; bol quantities/references are drift observations, never summed, and SUGGESTED offers are excluded — why: many EANs are sales representations of the same physical product.
- Same-product linking: compareSame hard-blocks only when both sides have confirmed non-inferred Product Master values that differ (brand, model/mpn, color, size, pack, unit qty); title-derived/unknown/offer-conflict values are warn-only — why: title guesses must never block the owner.

## Current owner mandate — 2026-10-23

The owner explicitly assigned completion of this WMS as a full engineering goal
in the current conversation on 2026-10-23. This supersedes historical preparation-only,
Codex-start and per-step permission holds for implementation and isolated testing.
Continue from the existing ERPNext direction and retained UI on independent branches.
Do not interpret this mandate as a passing technical test or accountant signoff.
Preserve the safety and source-of-truth rules above. Deliver reviewable draft PRs
with exact-source evidence; do not merge or deploy an unvalidated candidate.
See `docs/wms/completion/PLAN.md` for the delivery criteria and current work.

## Historical WMS engineering foundation — owner execution hold

- Read docs/wms/README.md, BASELINE.md, STAGES.md and STAGE_GATES.md before work.
- Preparation is authorized; Codex execution is NOT yet authorized. Do not assign, launch or trigger an agent from Issues or CI. P01 awaits explicit owner start approval; P02–P09 are locked.
- Preserve source modules and applied migration history. Use additive, scoped changes only; do not refactor the application wholesale or format unrelated business files.
- Each authorized phase stops at a draft PR with exact-SHA test evidence, known defects and rollback plan. Technical completion never automatically authorizes the next phase, main merge or deployment.
- Main, production databases, real inventory/prices and live provider mutations remain out of scope. Existing bol write-disable guards must stay disabled. No customer exports or credentials in this public repository.
- Local helper/static SQL tests do not prove DB concurrency or RLS. Database acceptance must use disposable synthetic fixtures and real limited-role sessions. Missing/blocked checks must remain visible.
- scripts/wms/phase-gate.mjs only recommends human review. Never treat self-authored evidence or Issue closure as owner approval.

## OSS architecture decision hold

- Read docs/wms/oss/ADR-0001.md and EXECUTION_PLAN.md. The recommendation is proposed, not accepted. P01 is blocked until mandatory architecture gates, owner acceptance and a revised task packet are recorded. Do not use historical Supabase phase scopes to start a Tryton migration.
- Research probes run only on separately installed upstream runtimes with disposable synthetic databases. They are not production acceptance or permission to copy upstream code into this application.


## Shared ERPNext preparation direction

Owner approved the engineering direction only: shared native accounting/stock/valuation with independent Surooh app and retained WMS UI/bol/bundles; separate company services/sites/DB/storage. Read `docs/wms/shared-core/README.md` and identical `contracts/shared-core-authority.json`. No Codex, main merge, deploy or real migration is authorized. Earlier unresolved direction language is superseded by this limited disposition, not by final adoption.


## Owner-approved alternative verification preparation

G0 = HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED. The current user authorizes local/isolated synthetic testing and preparation of `verification/` without launching Codex. Do not repair billing or repeatedly rerun Actions. Use `[skip ci]` for preparation commits. Follow `verification/README.md`; require real exit/log/artifact/SHA evidence and human review. No automatic phase completion, other-gate bypass, production change, paid service or main merge.

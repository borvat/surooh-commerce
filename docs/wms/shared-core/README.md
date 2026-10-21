# Shared Accounting/WMS preparation — direction approved only

The owner reviewed Accounting PR25 and issue24 and approved the joint ERPNext16 engineering direction and independent legal-company boundaries **for preparation only**. No Codex, functional phase start, final production adoption, merge, deployment, real migration or financial/tax action is authorized. Separate Draft PR branches leave PR23, PR25 and WMS PR16 unchanged.

Both repositories carry identical `contracts/shared-core-authority.json`. Its hash is pinned in the joint wave plan. ERPNext owns stock quantity, movements, reservation records, valuation/COGS, invoices and GL per legal company; Surooh keeps the UI/bol/product/bundle identity and orchestrates authorized commands, not another quantity or financial ledger. Current production systems remain authoritative until a separately approved reconciled cutover.

Read AUTHORITY.md, THREE_GAPS.md, ISOLATION.md, GATES.md, PHASE_ALIGNMENT.md, GITHUB_REPAIR.md and ACCOUNTANT_REVIEW.md. Evidence is synthetic, local, scoped and reviewable; hosted CI and accountant approval remain independent. The authority contract and owner transcription do not manufacture technical or production approval.

Full native evidence resides in the private Accounting repository; WMS carries only synthetic result summaries, not credentials/configs/backups.


Current independent verification: ALTERNATIVE_VERIFICATION.md explains replay; ALTERNATIVE_RESULTS.md and alternative-evidence/INDEX.json contain actual results and full archive hashes. Actions remains blocked; no phase accepted.

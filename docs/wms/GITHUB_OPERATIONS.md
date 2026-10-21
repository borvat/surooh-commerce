# GitHub development management

## Real remote objects

Foundation register: [#2](https://github.com/borvat/surooh-commerce/issues/2). Phase Issues P01–P09: [#3](https://github.com/borvat/surooh-commerce/issues/3), [#4](https://github.com/borvat/surooh-commerce/issues/4), [#5](https://github.com/borvat/surooh-commerce/issues/5), [#6](https://github.com/borvat/surooh-commerce/issues/6), [#7](https://github.com/borvat/surooh-commerce/issues/7), [#8](https://github.com/borvat/surooh-commerce/issues/8), [#9](https://github.com/borvat/surooh-commerce/issues/9), [#10](https://github.com/borvat/surooh-commerce/issues/10), [#11](https://github.com/borvat/surooh-commerce/issues/11). No Issue is assigned to Codex or another agent. `github-register.json` records confirmed identifiers only.

The preparation PR is stacked against `feature/bol-orders-warehouse`. Existing draft PR #1 to main is unchanged. Do not retarget or merge it as a shortcut. A source branch may be a development baseline without being production approved.

## Milestones — created and linked

Nine native Milestones M01–M09 were created through the authorized GitHub UI fallback because the connector has no milestone-create action. Each creation was confirmed on its milestone detail page. The existing phase Issues #3–#11 were then attached through the GitHub connector, which confirmed milestone numbers1–9. No deadlines or assignees were imposed. Native records are in github-register.json.

`python3 scripts/wms/bootstrap-milestones.py` remains an optional dry-run metadata plan for reproducibility; it was NOT used to create the live records. An authorized operator with GitHub CLI may review `--apply` to reconcile milestones by exact title and attach existing Issues; it never starts an agent or changes branches/deployments. Creation is complete, not an outstanding blocker.

## PR and Issue templates

`.github/PULL_REQUEST_TEMPLATE.md` requires scope/base/head/owner reference, separate test tiers, evidence, risk/rollback and a review hold. Issue forms separate phase tasks from integrity/security defects. Files are prepared in this branch; GitHub's default template UI may continue using main's configuration until a separately approved integration. The templates can be copied directly before then.

## CI and manual tiers

`commerce-check.yml` separates dependency-free foundation checks and four independent application jobs (unit/typecheck/build/lint). The two manual workflows are distinct: `wms-database.yml` for disposable DB acceptance and `wms-live-readonly.yml` for a future approved assessment. They deliberately report BLOCKED until actual adapters exist. No provider secrets, PR write token, dispatch-to-Codex, auto-merge or deploy job is present.

Pinned action SHAs were resolved from their official repository tags on 2026-10-21. Bun is pinned to1.3.0 with the existing lockfile and no lifecycle scripts. Verify frozen-lock compatibility in CI; local npm installation is not proof of a frozen Bun install. Action/service runtime installation and future dependency updates remain explicit maintenance tasks.

## Server-side protection — unverified administrative blocker

The connection returned403 reading branch protection. This is a permission limitation; it does not prove protections are enabled or absent. `protected:false` in branch metadata is not a complete ruleset audit. Do not claim that a PR template technically prevents an administrator from merging.

Recommended owner-reviewed settings for main: PR-only changes, no force push/deletion, required current checks after their inherited blockers are resolved, human review and dismissed stale approvals, no automatic merge/deployment, and restricted bypass. Protect the reviewed development branch similarly when chosen as the ongoing integration branch. A sole-owner repository cannot pretend to have an independent second-person PR approval. Use a real reviewer or document the owner's explicit manual review; never invent independence.

No administrative settings, environment protections, paid services or repository visibility were changed. Applying protection rules requires the owner's review and an appropriately authorized administration interface. Live credentials additionally require separately configured account allowlists and protected environment review; no such environment was created here.

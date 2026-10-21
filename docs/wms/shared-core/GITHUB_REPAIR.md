# Current confirmed admission diagnostic

New WMS [run39689565654](https://github.com/borvat/surooh-commerce/actions/runs/39689565654) produced one failed job119532094822, runner_id0 and no steps. Public GitHub check annotation explicitly states: **“The job was not started because your account is locked due to a billing issue.”** See CURRENT_CI_DIAGNOSTIC.json for verbatim public API evidence. This establishes GitHub's stated account admission reason for WMS; the underlying unpaid item/payment/account remedy is not visible or changed here. Job log retrieval returned404 because no log blob exists.

New Accounting [run39689544956](https://github.com/borvat/surooh-accounting/actions/runs/39689544956) remains startup_failure with zero jobs. Same owner account makes the same lock a supported inference; no private-run annotation independently confirms it. Both remain G0 BLOCKED. The observations below predate this new annotation; their unknown-root-cause caveat is superseded for the WMS stated admission reason only.

Owner action: inspect GitHub billing account lock or ask existing Support ticket to identify and clear it; any payment/plan/budget/admin mutation still needs separate explicit approval. A Render paid plan does not clear GitHub account billing. Do not edit workflow steps or bypass via public mirrors/self-hosted runners as a supposed fix for this lock.

---

# GitHub Actions and main protection — read-only investigation and repair steps

## Observations, separated from diagnosis

Accounting PR25 at0f5e6ece5a06f3807255d5e250705eb331189c3f produced [run39686768894](https://github.com/borvat/surooh-accounting/actions/runs/39686768894): completed/startup_failure, path BuildFailed, zero jobs. No runner/step log exists to prove a code failure. Workflow YAML/local foundation tests pass, but cannot clear hosted CI. Prior UI/billing explanation is historical evidence, not a newly proven account-side root cause. This connector cannot inspect private account billing, restrictions or support-side admission decisions. Check-suite diagnostic endpoint is unavailable through this connector. Do not assert that a particular payment or abuse flag caused this run.

Accounting main: observed protected=false and status-check enforcement off. Rulesets GET403 explicitly says upgrade to GitHub Pro or make repository public. Protection-detail GET403 says integration lacks access. These are distinct limitations: feature entitlement and connector administration scope. Commerce main: protected=false and rulesets list empty. Do not assume either repository is protected because a local gate file exists. Full available observations/errors are retained in investigation.json; no admin/billing API write occurred.

## Owner/admin repair runbook — NOT executed

1. On GitHub's account Settings→Billing/usage and Actions settings, inspect actual plan entitlement, budgets, payment status and any account warning. Record the observed banner/error; do not change cards, spending, plan, organization permissions or repository visibility without separate explicit approval. Render subscription is not a GitHub plan.
2. If admission remains unclear, append the two repositories, exact SHA/run URLs, startup_failure, zero jobs and timestamps to the existing GitHub Support ticket. Ask support to confirm account-side runner admission/restrictions and remediation. Do not open duplicate tickets or send a message automatically. No root cause is established solely from zero jobs.
3. After owner/support resolves admission, rerun read-only foundation/reference/draft-policy/shared-contract jobs on exact heads. Require actual jobs/steps/logs. Then build a reviewed disposable native CI runner; these new evidence-integrity jobs are not engine execution. Do not install a self-hosted runner or public mirror to bypass the restriction.
4. Owner chooses an eligible private-repository plan/ownership arrangement if needed; no price or purchase is assumed. Preserve private accounting data/repository visibility. Obtain explicit approval for entitlement/admin changes; current connector does not gain admin access automatically from plan upgrade.
5. An authorized admin configures effective protection/rulesets for main **in both repositories**: pull requests, at least one independent approval, dismiss stale approvals, conversation resolution, required exact observed checks, no force-push/deletion, and reviewed bypass policy including administrators/apps. With only one active developer, arrange an independent reviewer rather than silently allow self-approval. Do not require a nonexistent/skipped check; use actual successful check contexts after CI is working. Auto-merge and deployment remain disabled by policy.
6. Read back protected/enforcement/required checks/bypass from an authorized read channel, and test branch-rule rejection only in a separately approved disposable repository/branch. Never push a test commit to production main. Keep G0/G6 open until evidence exists.

Proposed controls are instructions for review, not applied configuration. Re-run cost/admission/entitlement checks after any owner change. GitHub documentation: [Troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows), [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches). Billing budgets may help billing-related failures, but increasing a budget without diagnosis/approval is not part of this mission.

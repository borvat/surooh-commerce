## Problem and behavior

Describe the concrete problem, final change and scope. Planning is not implementation or production approval.

## Phase and references

- Phase ID / Issue:
- Reviewed base SHA / tested head SHA:
- Owner start authorization reference (or `foundation preparation only`):
- Dependencies accepted at SHAs:

## Validation evidence

| Tier                               | Command / CI run | Result | Evidence artifact |
| ---------------------------------- | ---------------- | ------ | ----------------- |
| Foundation                         |                  |        |                   |
| Unit / UI / static SQL             |                  |        |                   |
| Typecheck                          |                  |        |                   |
| Build                              |                  |        |                   |
| Lint                               |                  |        |                   |
| Disposable DB integration          |                  |        |                   |
| Live read-only (separate approval) |                  |        |                   |

Use BLOCKED / NOT RUN when applicable; never count skipped DB/live checks as passed. Attach sanitized logs, SHA-256 digests, limitations and unresolved defects. Explain inherited failures.

## Risks and rollback

State compatibility, data/tenant implications and tested rollback. Inventory corrections append compensating events.

## Review hold

- [ ] No unapproved main change, production database connection, live stock/price write or deployment.
- [ ] No secrets, personal customer data or real label files in diff/evidence.
- [ ] Required acceptance assertions were executed on the tested SHA.
- [ ] Independent human technical review and owner acceptance are pending or linked explicitly.
- [ ] Next phase remains locked until separately authorized; this PR does not enable automatic merge or deploy.

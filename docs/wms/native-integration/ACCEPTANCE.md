# Native preparation acceptance gates

| Gate | Required proof | Current policy |
|---|---|---|
| NI0 source/reproduction | Exact two repository SHAs, source archives/binaries/runtime versions, fresh native sites, commands/exits/log hashes | Human review only; no self-approval |
| NI1 native stock | Native receipt/order/component reservation/ship/cancel/return/event replay, quantity/value/COGS/GL reconciliation | Actual vouchers required, no API-contract substitution |
| NI2 trusted commands | Signed/expired/revoked identity, durable request hash/result, concurrent/restart/lost-response, raw RPC/API denial and real RQ | Actor/company/source rechecked; privileged owner compromise excluded |
| NI3 full WMS workflow | Rendered retained UI, native read projections, parent-commercial mapping, atomic pick/pack reservation handoff and races | BLOCKED until implemented and executed |
| NI4 company/site/DB | Own-company positive controls, foreign read/write negative controls, separate DB credentials/keys and site paths | Shared-daemon evidence cannot close NI5 |
| NI5 operational isolation | Real non-root service identities, mounts/storage/config/files/keys/backup custody and threat tests | BLOCKED if executor cannot support it; no UID workaround acceptance |
| NI6 regressions | Current106 unit cases (original100 plus6 guard cases), typecheck/lint/build/generated-clean, PostgreSQL21+18 and foundation/gates | Exact source pair, retain failures/warnings |
| PREPARATION / P01 | All applicable gates, evidence review, fresh full build/operations/governance requirements and separate owner authorization | Remain BLOCKED; no Codex/P01–P09 start |

Further mandatory holds remain unchanged: accountant policy review, fiscal enforcement, full framework/assets upgrades and restore/off-host recovery, integration/cutover with Marketplace/Warehouse/SAM, production identities and main governance protection. Do not replace them with local test successes.

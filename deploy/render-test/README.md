# Isolated Render test environment

Owner requested separate Render test environments on 2026-10-24. This branch is independent; no main merge or production cutover.

Service: `surooh-wms-isolated-test` (Frankfurt, free). URL: https://surooh-wms-isolated-test.onrender.com/auth

Source baseline: `2a1adc7dfc531a13678498745c388e6ef2fe672a`.
Build: `npm exec --yes --package=bun@1.3.13 -- sh -c 'bun install --frozen-lockfile --ignore-scripts && bun run test:unit && bun run test:foundation && bun run build'`.
Start: `node .output/server/index.mjs`. `NITRO_PRESET=node-server`; bol writes remain disabled.

Observed on Render: 148 application tests + 25 foundation tests pass, build succeeds, service Live and `/auth` returns 200 with login UI.

Boundary: no production Supabase URL/key or bol credentials are configured. Hosted authentication and data operations are NOT ready. Existing native ERPNext UI adapter explicitly requires loopback synthetic sessions; this guard remains intact. A reviewed hosted native-session integration is required before warehouse workflows can be tested through the public UI. The existing `surooh-wms-evidence-synthetic-20261022` PostgreSQL instance is historical probe infrastructure, not an ERPNext database.

This service currently supports isolated builds and unauthenticated UI smoke checks; it is not full native WMS acceptance.

# Surooh Commerce

Development baseline imported from the existing Bundle Stock Lovable project. This GitHub repository is public; do not add confidential operational data.

Status: source snapshot for development and review; NOT production certified.

- Multi-account bol.com operation has not been end-to-end tested.
- Outbound bol.com changes are disabled by BOL_WRITE_ENABLED=false in src/lib/bol.server.ts.
- Use a separate staging database; never connect this deployment to the Lovable production database.
- Never commit .env, API keys, customer exports or marketplace credentials.
- Supabase migrations define schema, not backups of production data.
- Review database migrations and tenant isolation/RLS before applying.
- Test multi-company accounts, shared inventory, bundles, order reservations, read-only import, and reconciliation before live operations.

Delivery gates: complete source audit, clean build, isolated staging migrations, account isolation tests, bol read-only integration, and approved production readiness assessment.

Stockitup is a functional benchmark; its source code has not been copied.

## Engineering foundation (execution held)

Start with [docs/wms/README.md](docs/wms/README.md). Architecture, data/inventory rules, operation cycles, Marketplace/Accounting/SAM contracts and nine ordered phase packets are prepared there. P01 is ready for owner review, not assigned to Codex. No automatic phase start, main merge or production deployment is authorized.

Local engineering checks: `npm run check:foundation` and `npm run test:foundation`. Existing application tests use `bun run test:unit`; typecheck/build/lint remain separate. Disposable DB and live read-only entry points deliberately fail closed until their actual adapters and approvals exist. See [testing](docs/wms/TESTING.md) and [stage gates](docs/wms/STAGE_GATES.md).

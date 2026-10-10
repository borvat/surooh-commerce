# Surooh Commerce

Private development baseline imported from the existing Bundle Stock Lovable project.

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

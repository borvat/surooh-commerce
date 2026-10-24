# Hosted WMS / Accounting contract proposal — 25 October 2026

Proposal only. No Accounting/Marketplace service, schema, credentials or guard is
changed by WMS PR32. Existing services must not be restarted for this proposal.

## Verified incompatibility

WMS `507c6f509356ee8a0a971575375188e88b489916` uses an explicit
`http://127.0.0.1` TEST-A native-lab client and fixed native test site header.
`configureNativeLab` refuses external URLs; native activation requires a local
host and explicit test build flag. This is a deliberate boundary.

Accounting `f03dd2fc26fd71cee461feda7853ed3bbb5ab223` exposes the lab command
only through the signed synthetic JWT profile, actor/company/source checks and
its exact shared app/site/DB guard. A native invoice-workbench login is not this
JWT. Its persistent standalone invoice service is not thereby a deployed WMS
boundary. The synthetic command executor temporarily adopts Administrator inside
its test guard; that executor must not become a general production operator API.

The current WMS Render form is the older Supabase application login. Do not enter
an Accounting password, SAM bearer token, native JWT signing key or provider key
there. No accepted secure hosted WMS operator login exists in this candidate.
Original local acceptance creates private synthetic credentials itself, transmits
JWTs through private process input and keeps them out of Git and reports.

## Compatible next contract, for coordinated implementation

1. Retain the current local profile unchanged for reproducible evidence. Add a
   separately versioned, explicit hosted synthetic profile; default stays denied.
2. Use same-origin WMS browser sessions with Secure/HttpOnly/SameSite cookies,
   CSRF and server-side expiry/revocation. Bind a verified user to one company,
   one exact Accounting service/site and a native limited operational identity.
   No browser-supplied company, endpoint or token selects another company.
3. Keep server credentials in the deployment provider's protected secret store,
   never a VITE variable, URL, browser storage, repository or chat. Provisioning
   must specify the real identity/endpoint/secret field names after implementation;
   no nonexistent secret setting is presented as an available login mechanism.
4. Authenticate every command and read with native current permissions. Retain
   independent financial review, period/link guards and the sole native ledger.
   Do not publicly expose the existing synthetic Administrator transition.
5. Introduce a read-only command-status operation scoped to company, source,
   actor and request identity. Return unknown/completed/rejected plus a native
   reference and payload digest; never another actor's body or raw traceback.
   A trusted rejection must distinguish rollback from an idempotency conflict.
   Until that operation exists, an unresolved intent remains frozen and an
   operator must not delete its journal to issue a new command.
6. On response loss, query status before retry. Retry only the frozen request
   through native idempotency. Reload must not replace its request ID or body.
   Persisted browser metadata is intent, never stock balance or proof of commit.
7. Stage on the existing WMS service and the explicitly agreed persistent native
   TEST-A/TEST-B services only after a paired acceptance set exists. Do not attach
   SAM storage, migrate a populated service, or provision a duplicate paid stack.

## Acceptance and rollback

Freeze both application SHAs, engine commits and installed hook/app sets. Test
both companies' direct HTTP/DB/file/session denial, role revocation, duplicate
and conflicting identities, last-unit/component races, commit-before-response
failure and restart/restore. Exercise actual WMS UI at1440/390/320 with RTL and
reconcile the original native SRE/SLE/GL/voucher IDs and values. Three-app
acceptance additionally requires the exact Marketplace source and its independent
review/origin contract; previous two-app passes cannot certify it.

Keep the new profile off until acceptance. Rollback disables only its admission
and restores the prior WMS application artifact; do not roll back native data by
replacing the database or selecting the resetting Accounting image. Back up and
verify restoration in a separately owned target before any schema change.

No new cost is authorized or incurred by this proposal. Any shared prior ceiling
belongs to the same coordinated resources, not a separate WMS budget.

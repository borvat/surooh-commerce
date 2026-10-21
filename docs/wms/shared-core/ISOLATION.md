# Isolation evidence and deployment target

The selected boundary is independent legal-company site/database/storage/service identity. This phase tests what the executor permits and leaves the rest explicitly open.

| Executed | Result | Limit |
|---|---|---|
| V01–V07 replay | Own identity/invoice/private file/GL report positive; cross-site API identities, same-site company document access and foreign DB credentials denied | Same MariaDB host and shared OS/root identity; foreign GL report200 returns no financial rows rather than403 |
| A09 native backup/restore | Fresh synthetic recovery site; selected native financial/doc/file fields and counts reconcile; private file bytes equal | Not a full-table cryptographic reconciliation or RPO/RTO/load proof; new research outbox/receipt tables not included in selected-record comparison |
| A10 recovery identity | Old API key rejected; new authorized recovery identity reads private file; maintenance hold reinstated | Same-entity DR clone only; no company migration |
| A11 two dedicated application processes | Four own identity/private-file positive controls; eight foreign-token/Host/site-header/forwarded-host denials | Same UID, shared runtime/config filesystem; WSGI site-binding wrapper, not an OS sandbox or deployed TLS proxy |
| A12 backup encryption prototype | Actual native DB backup encrypted in memory with AES-GCM; own key decrypts exact bytes; wrong key/company AAD/tamper all fail | Native backup is not encrypted by default in this probe. No KMS/key custody deployed; plaintext lab backups remain local and were not uploaded |
| OS identity capability probe | setgroups denied EPERM; setgid/setuid to distinct test identities rejected EINVAL | Distinct UID/mount/namespace tests BLOCKED by executor, not PASS |

Prior result field `encryption_key_in_secure_local_config_only` means the native restore key remained local and out of git. It does not establish secure KMS storage against the shared root/service threat. The application/header guards likewise do not prove isolation if service code is compromised and can read sibling configs.

Future isolated deployment acceptance: separate non-root identities, company-only config/mount permissions, independent DB identities with no cross grants, private object storage and signed URLs bound to company/document/expiry, backup service identity distinct from application identities, separate encryption keys and company-associated metadata. Central secrets/backup operators are privileged and audited; a compromised company service must not fetch another company key. Strip routing headers at the trusted edge, bind routing from authenticated registry, terminate TLS, and deny direct native write/export/admin endpoints to client tokens. Test file traversal/symlinks, prepared reports/exports/cache, search/download/attachments, signed-URL replay, queue/service compromise, key revocation and off-host restore. Use real limited users/processes in hosted CI; no root-based success claim.

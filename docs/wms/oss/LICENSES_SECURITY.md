# License and security due diligence

Primary license texts inspected at source pins in `source-pins.json`. Commercial use and modification are permitted by the identified licenses; obligations depend on the exact distribution/integration. This table is a license inventory, not approval to redistribute combined Surooh/upstream code.

| Project | Inspected license | Practical condition before adoption |
|---|---|---|
| ERPNext | GPL version 3, `license.txt` | Preserve notices and comply with corresponding-source/copyleft obligations when conveying covered binaries/derivatives. Keep separate integration service boundary; a separate process alone is not a universal license exemption. |
| Tryton modules | GPL version 3, installed distribution license/COPYRIGHT | Same distribution obligations; inventory each module and any distributed extension. Internal use is distinct from distributing covered software. |
| Odoo core/Community | LGPL version 3, root LICENSE | Preserve notices; changes to covered LGPL code and relinking requirements matter when conveying. Check every addon manifest; third-party OCA/Enterprise code can have different terms and was not granted blanket approval. |
| InvenTree | MIT, root LICENSE | Retain copyright/permission notice in copied software/substantial portions. Dependencies retain their own licenses. |
| OpenBoxes | EPL version 1.0, LICENSE.md | Review source availability/notice obligations for distributed covered modifications and EPL commercial-contributor provisions. Separate new modules are not automatically covered or automatically exempt without examining their relationship. |
| Surooh | No root license file in inspected branch | Verify code ownership, exported/generated code rights and commercial distribution policy. Do not label existing project MIT or copy GPL core into it. |

References: pinned repository license paths; [GNU FAQ](https://www.gnu.org/licenses/gpl-faq.html), [LGPLv3](https://www.gnu.org/licenses/lgpl-3.0.html), [EPL 1.0](https://www.eclipse.org/legal/epl-v10.html). No OSS source was copied into the Surooh application in this PR; probes import separately installed products.

Security work performed: source inspection of locking/permission paths and upstream test guards, release/security-policy review, synthetic model/API tests, source/dependency pin capture. Not performed: full dependency advisory reconciliation, signed artifact verification, container scan, penetration test, real limited-user cross-company exfiltration, PostgreSQL race/load tests or backup-restore certification. None is marked passed by absence of a finding.

Before accepting an implementation foundation require: SBOM plus advisory report with dated exceptions/owners, supported OS/Python/JDK/database versions, authorization tests for direct IDs/list/search/export/report/attachments, server-derived tenant context, worker credential scoping, role revocation, safe error messages and audited admin bypass. Application rules do not equal PostgreSQL RLS. Avoid superuser-only isolation tests.

A movement history or ORM audit trail does not by itself prove protection against privileged SQL edits. Define service-role permissions, reversal-only commands, external append-only evidence retention and reconciliation; exercise unauthorized mutation attempts and correction events. Preserve existing bol disabled-write guards throughout.

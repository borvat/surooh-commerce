# Dutch accountant review path — ready to arrange, not performed

Status: **NO ACCOUNTANT APPOINTED, NO SIGNOFF, NO TAX READINESS CLAIM**. No message/contact, paid engagement or filing is authorized by creating this packet. Owner chooses the Dutch accountant/fiscal specialist and approves scope/cost separately. Verify the relevant experience and professional registration where claimed; do not infer expertise from a generic bookkeeping title.

## Review sequence and responsibility

1. Owner selects reviewer and confirms engagement; record reviewer name/organization/qualification, conflicts, agreed scope and date. Engineering supplies synthetic pack only; no production credentials/data.
2. Accountant determines per-legal-entity tax regime, fiscal unity/group treatment, invoice versus cash basis, reporting periods/currencies, chart/control accounts, rounding, correction and valuation policies. Group reporting must not silently merge VAT entities or legal ledgers.
3. Accountant reviews matrix below and returns approved/rejected/deferred decisions with effective dates, primary sources, exclusions and expected journal/return/invoice goldens.
4. Engineering implements only an authorized future packet, runs native engine tests and reconciles GL/tax/ICP/document outputs against the signed goldens. Accountant reviews results and unresolved differences.
5. Owner reviews exact code/policy/evidence revisions. Fiscal-policy approval is distinct from deployment/cutover authority. Any policy/code/source change invalidating coverage requires renewed review. Store no fabricated reviewer name or signature.

| Review item | Required accountant output / tests | Official reference |
|---|---|---|
| Standard/reduced/zero/exempt, domestic reverse charge, purchases/import/Article23, margin/OSS/IOSS applicability | Per-case classification/effective date, rates, output/input boxes, deduction rights and native GL goldens; unsupported cases fail closed | Belastingdienst BTW rules, regime-specific sources selected by accountant |
| ICP/3b and periods/corrections | Goods invoice period versus service supply period; exempt/zero-in-customer-country service exceptions; own-goods/call-off stock applicability; signed credit/correction goldens; same-period ICP=3b tie-out | [ICP](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/zakendoen_met_het_buitenland/goederen_en_diensten_naar_andere_eu_landen/opgaaf_icp/opgaaf_icp) |
| Invoice/credit document | Applicable legal names/addresses/VAT/KvK, unique sequential invoice numbering/date/supply detail/net/rate/tax and special wording; exemptions/self-billing/cross-border exceptions reviewed | [Invoice requirements](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/factuureisen) |
| Retention/archive | Data category and retention start,7-year baseline and10-year immovable/OSS/IOSS cases, original document/evidence retrieval, legal holds and backup lifecycle | [Retention](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/administratie_bewaren/administratie_bewaren) |
| Peppol/e-invoice | Applicability by customer/contract; B2G obligation, structured XML versus PDF, identifiers/transport and acceptance tests; domestic future policy is not assumed enacted duty | [RVO e-invoice](https://www.rvo.nl/onderwerpen/e-factureren-aan-rvo), [Peppol](https://www.rvo.nl/onderwerpen/digitaliseren-en-e-commerce/peppol) |
| Inventory/COGS/IC | Approved valuation method, landed/backdated cost, returns/quarantine, write-offs, intercompany margin/eliminations and period locks | Accountant-selected accounting/fiscal policy references with effective date |

The prior prototype covers only seven illustrative native sales treatments and eight draft-policy checks. It does not cover the full matrix, verify real VAT IDs/VIES evidence or block invalid direct native posting. No real returns/tax filing, Peppol delivery, payment or bank settings are tested. All currently unreviewed fields remain null in REVIEW_RECORD.template.json.

## Review package index

Supply ADR0002, authority contract, Dutch draft policy/source/tests, seven native-case evidence from PR25, intended invoice/credit samples, BTW/ICP reconciliation by synthetic legal entity, valuation/GL tie-outs, retention/recovery design and unresolved-scope register. The reviewer marks each scenario approved/rejected/deferred and signs the exact package digest; engineering adds real native evidence later. Do not send the pack automatically.

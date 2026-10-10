# Order finance and audit controls (draft, no production writes)

## Source-of-truth boundaries
- bol.com is source for marketplace order/shipment/commission data.
- The inventory system is source for physical stock movements and reserved quantities.
- QNAN accounting stays in e-Boekhouden; this app must NOT silently create a second general ledger.
- Prices and fees must have legal entity, sales account, currency, origin, effective date and evidence reference.
- The current order schema has no verified monetary ledger or invoice reconciliation. No profit figures should be displayed as factual yet.

## Profit formula, per item and account
Revenue excluding Dutch VAT, after discounts/refunds
minus cost of goods sold excluding recoverable input VAT
minus allocated marketplace commission and fixed fees excluding recoverable VAT
minus delivery/fulfillment and packaging excluding recoverable VAT
minus return costs and other allocable expenses
= contribution margin (not final net profit).

Shipping paid by the buyer is revenue; seller-paid shipping is expense. Distinguish FBR and FBB charges. Ensure fee VAT does not get double counted and explicitly model any nonrecoverable VAT. Handle mixed VAT rates and cross-border destinations using actual tax classification, not a blanket 21%.
Return/reversal entries must link to original order item and preserve historical valuation. No negative-cost or zero-cost assumptions when values are unknown.

## Controls and evidence
1. Import using channel_id + provider order ID + item ID unique keys.
2. Separate seller accounts even if the same EAN appears in both.
3. Reconcile marketplace daily totals, fee invoice, payouts, refunds and chargebacks to accounting.
4. Record pricing, COGS, tax, marketplace fees and shipments in dated, versioned source records.
5. Show profitability status as VERIFIED, ESTIMATED or MISSING_INPUT per line.
6. No automatic customer invoice or accounting postings from order printing.
7. Exports and labels require verified company membership, warehouse role and audit record.
8. Report variances instead of silently balancing unmatched values.

## Warehouse work
Order pick list and carrier-issued shipping label are distinct. Printing must never mark shipment as completed, change stock, purchase a new label or create a duplicate carrier booking.

## Release requirements
Run isolated database migration, tenant isolation tests, financial rounding/VAT tests, refund tests, bulk print duplication tests and real carrier document retrieval (read-only) before permitting production orders.

> Current direction: owner approved shared ERPNext16 accounting/stock/valuation for preparation only. [Shared authority](shared-core/AUTHORITY.md) and [phase alignment](shared-core/PHASE_ALIGNMENT.md) supersede any historical Supabase/Tryton writable-ledger instructions below. Current source/production remains unchanged. Codex, merge, deploy and real migration remain held.

# Versioned integration contracts (target, not deployed endpoints)

Use `/inventory/v1` with server-verified company/account scope, stable source IDs, correlation ID, JSON schema version, exact decimal quantity strings when necessary and cursor pagination with an ID tie-breaker. Mutations require `Idempotency-Key`, canonical request hash and `expected_version`. Errors: 401 unauthenticated,403 scope denied,409 insufficient stock/state/version/hash conflict,422 invalid command,429 bounded retry-after. Error details/logs never contain secrets or unnecessary customer data.

## Shared event envelope

`event_id, schema_version, organization_id, aggregate_type, aggregate_id, aggregate_version, event_type, occurred_at, recorded_at, correlation_id, causation_id, source_system, payload`.

Record provider occurred_at separately from trusted ingestion time. Inbox dedupes org+provider+account+event ID and rejects conflicting payload hashes. Old events do not regress current state. Ledger+state+outbox commit together. Delivery is at-least-once with idempotent effects, not a claim of network exactly-once.

| Consumer           | Reads                                                                     | Commands/events                                                                           | Ownership and restrictions                                                                                            |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| BORVAT Marketplace | GET availability scoped to site/offer with as_of and version              | reserve/release order line; shipping/return observations                                  | WMS owns quantities; marketplace confirms order only after accepted reservation; no direct balance writes             |
| bol.com            | paginated orders/listings/fulfillment observations for authorized account | normalized provider order/line events through inbox                                       | Read-only throughout this work; FBR internal versus FBB/BOL enforced; no price/stock/shipment mutation                |
| Accounting         | durable receipt/dispatch/return/adjustment cost events, cursor export     | ACK(event_id, external_journal_ref, export_version)                                       | Inventory source references retained; no second physical movement from invoice; missing cost stays pending            |
| SAM                | scoped stock/shortage/aging/reconciliation/task status read models        | proposals with actor/delegation/expiry, intended command, evidence and approval reference | No service-role key, arbitrary SQL or generic MCP passthrough; no autonomous stock/price/purchase/send/payment writes |

## Core command payloads

Reservation: `{source_system, account_id, external_order_id, lines:[{external_line_id,product_id,quantity,fulfillment_method}], warehouse_id, expected_version}` → `{order_id,reservation_id,allocations,bom_version,status,version}`. Derive actor/company from verified session; supplied company must match scope. Reject unknown product/line or mismatched listing ownership.

Receipt: `{purchase_order_line_id,item_id,quantity,receiving_location_id,source_document_ref,expected_version}`. Returns ledger transaction and pending inspection state as policy requires. Return receipt references original shipment line and quarantine site; inspection is a separate command.

Warehouse command: `{order_id,kind,scans,evidence_refs,expected_version}`; trusted server resolves actor and authorized account and validates state inside transaction. Provider label verification cannot be asserted by arbitrary URL in the browser.

Accounting event: `{source_document,source_line,event_id,item_id,quantity,base_uom,currency,cost_amount,cost_policy_version,valuation_status}`. Avoid customer PII. Dispatch consumes valuation layers, not purchase-order forecasts. Same-company transfer creates no sale; intercompany requires explicit sales/purchase documents. Existing e-Boekhouden integration remains read-only; no journal posting in this foundation.

SAM proposal: `{proposal_id,requested_by,delegation_id,expires_at,organization_id,account_id,capability,intended_command,evidence_refs,approval_ref}`. Revalidate identity and scope at execution, never trust old approval for a changed command/hash. Future authorized commands pass the same WMS gateway and idempotency rules; SAM cannot bypass phase gates or operate production through this project.

## Connector capability discipline

Each connector declares supported read/write operations and account scope. Read retries honor quotas/backoff and max attempts; failed pages preserve checkpoints and reconciliation gaps rather than reporting a complete import. Write capabilities default false. Outbox claims use leases, request IDs and provider read-back for ambiguous outcomes. Redacted dead letters have operator replay controls. No integration is connected live by this foundation PR.

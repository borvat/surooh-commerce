# Availability, reservations and bundles

## Scope and formula

Compute ATP at an executable fulfillment site and eligible stock condition. `ATP_i = max(0, eligible_physical_i - active_reservations_i - safety_i - external_commitments_not_converted_to_reservations_i)`. Commitments and reservations must be mutually classified to avoid double subtraction. Define safety once per item/site scope; aggregation and reservation must use the same policy.

`capacity(product) = min_i floor(ATP_i / required_base_qty_i)` after flattening an approved BOM version and aggregating every alias of the same physical component. No BOM, inactive component or unconfirmed mapping means unavailable. V1 rejects nested bundles as current code does; later flattening needs cycle/overflow tests.

A product family does not share stock. Confirmed same-product offers share one component pool. Distinct colors/sizes are distinct physical stock. A virtual bundle has no independent physical balance. Preassembled kits require an assembly/disassembly transaction consuming components and creating the kit SKU; both cannot be counted at once.

Example: 100 GAS and 20 STOVE; A=4 GAS+1 STOVE, B=10 GAS. Reserving 2 A consumes reservation capacity GAS8/STOVE2; reserving 9 B raises reserved GAS to98. Another A fails. Initial A capacity20 plus B capacity10 is not 30 independently sellable units.

## Reservation transaction

Validate session, selected organization, role, account and site. Resolve stable source order/line IDs; normalize each positive quantity before aggregation (negative lines must not cancel positive lines). Check operation key and request hash. Lock order and balances in a deterministic shared order, validate state/version and per-component availability, then commit order lines, BOM snapshot, allocations, reservations, balance deltas, ledger and outbox atomically. A rejected reservation has no partial stock/order/outbox effects; a rejection audit record is allowed.

Retries use the same operation key. Same key+same payload returns the previous business result; different payload returns `IDEMPOTENCY_CONFLICT`. Unique external order IDs alone prevent duplicate inserts but are insufficient for stable replay semantics. Deadlock/serialization retries are bounded, not infinite. Dispatch consumes only still-reserved allocated quantity; cancellation releases only unshipped remainder; return is a separate flow.

Current SQL `place_order` already groups needs and uses `FOR UPDATE`; preserve it while testing real independent sessions. Current aggregated availability can advertise a bundle whose components are split across warehouses although an order reserves one warehouse. Resolve this in P03; do not promise aggregate quantity as a feasible single-site shipment.

## External channel quotas

Internal locks cannot prevent an external platform from accepting an order before its event arrives. Do not publish all ATP to every EAN or channel. Future quotas must obey, for every component i: `sum_j(offer_quota_j * BOM_ij) <= unreserved_eligible_i - safety_i`. Convert a channel commitment to reservation atomically on order import. Confirm a quota reduction on the old channel before reallocating it elsewhere; pause on synchronization lag/drift. Without provider-enforced quotas or a synchronous reservation API, absolute cross-channel oversell prevention cannot be guaranteed.

All live writes remain disabled now. P08 tests quotas in simulation only; a later live-write activation is a separate owner decision. FBB/BOL stock never reserves or decrements internal warehouse components. External fulfillment status requires provider evidence, not an internal click.

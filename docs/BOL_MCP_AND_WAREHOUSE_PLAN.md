# Surooh Commerce — bol.com MCP and warehouse implementation contract

Status: Development proposal / partially implemented local order UI. Not production validated.

## Existing MCP source
- Private repo: borvat/sam-bol-commerce-mcp
- Pinned upstream: bol-mcp v0.3.0, originally reported 76 tools in 17 groups.
- **76 is a source-inventory claim, not evidence that 76 tools have passed tests or are connected.**
- Upstream MIT attribution/license retained in the MCP repository.
- Surooh Commerce must consume a versioned server-side gateway, not import credentials or expose MCP tools directly to browser clients.

## Mandatory scope
Each server action must derive company, marketplace account and current user permissions from a verified session, then resolve the tool and scope server-side. Never accept marketplace account or legal entity from browser input without validating membership.
Read tools may be retried with rate-limit backoff. Mutations require role approval, idempotency key, audit record and provider read-back before marking completion.
Start with only approved read capabilities: accounts / products / orders / fulfillment status / official shipment labels, subject to upstream tool availability and live API permissions. No general passthrough to all 76 tools.
Do not connect SAM Greenfield or call Replit until separately approved.

## Warehouse flow
1. Import external orders into durable account-scoped records with stable provider IDs.
2. Deduplicate each order and line by account + provider order and item identifiers; distinguish FBR and FBB.
3. Filter server-side across all pages: company/account, status, dates, SKU/EAN, order number, fulfillment, shipping urgency, warehouse, missing label, carrier and exceptions.
4. Generate printable pick list (internal document) with clear status; printing must not change order fulfillment status.
5. Retrieve carrier-issued label for the exact shipment via approved bol/carrier API; store its official document reference and link it to order/account/shipper, verify content type and expiry. A packing list is NOT a shipping label.
6. Create print batch and support reprint without duplicating label purchase or shipment registration.
7. Warehouse scanning/packing and handoff remain explicit, audited actions. No auto-ship from printing.
8. Do not expose personal addresses in logs; restrict label read to authorized warehouse staff; apply short retention.

## Evidence required before release
- Typecheck/build/lint/tests green for Surooh Commerce and bol MCP independently.
- Two test bol accounts: no cross-account leakage in order search, downloads, or label retrieval.
- Valid label only for shipping method where bol/carrier supplies it; no fake label when unavailable.
- Zero duplicate reservations/shipments on replay, failure or double-click.
- Print pick-list and official label on supported A4/thermal layouts in browser/device tests.
- Server-side scoped pagination/filter tests and authorization/RLS tests.
- Read-only bol smoke test before any mutation, with all outbound updates disabled initially.

Current implementation on feature branch: filtering only the currently loaded page and internal printable warehouse pick list. No carrier label fetching or MCP live calls have been implemented yet.

# Surooh Commerce Copilot — architecture decision (2026-10-10)

Status: DESIGN APPROVED FOR DEVELOPMENT ONLY. No model provider, secrets, live actions or deployments are enabled.

## Decision
Build an embedded commerce-specialist conversational assistant (“Commerce Copilot”), **not a second autonomous executive agent**. SAM Executive remains the enterprise-level orchestrator, authority/policy and memory owner. Both use a shared verified tool gateway; no two separate inventories, ledgers or approval systems.

## User experience
Arabic-first chat within commerce platform, scoped by authenticated company and accessible bol seller accounts. Explain all answers in business terms with source, time window, account and confidence. Useful tasks:
- "What unshipped orders are due today in account A?"
- "Prepare warehouse pick lists for selected FBR orders" (draft only, no fulfill side effect)
- "Which orders lack an official carrier label?" (read-only)
- "Why did margin drop this week?" (require verified COGS, VAT, shipping, fees, refunds)
- "Show shared inventory conflicts across two bol seller accounts"
- "Suggest SKU/EAN matching candidates" (human confirmation)
Support explainable saved filters, proposed warehouse batches, CSV/PDF exports where authorized.

## Isolation, authority and cost
- Authentication and authorization enforced on server, **not delegated to prompts**. Each tool call derives legal_entity_id / org_id / account_id from verified session and user membership; fail closed.
- Read-only by default, no generic access to all 76 MCP tools. Per-role allowlists and data minimization.
- Never buy labels, change prices/stock, fulfill/cancel orders, issue invoices, initiate payment, email customers or post ledgers from chat without an explicit approved authority gate. Do not let a conversation itself grant persistent authority.
- Official carrier labels only retrieved from the shipping provider / bol API; a pick list is not a label.
- Responses cite record IDs and show estimated vs verified accounting inputs; no fabricated numbers or PII leaks.
- Provider-agnostic model interface with explicit per-call and per-day cost ceilings; short-context summarization, redaction and response cache for non-sensitive aggregations.
- Versioned tool schemas, idempotency keys for writes, audit trail, timeout and retry policies, independent read-back of asynchronous provider operations.
- Never place LLM or bol credentials in client JS. Server-side proxy only; secrets held out of GitHub.
- SAM integration is optional initially: design gateway contract now; enable only after SAM is stable and verified. Commerce remains useful without SAM being online.

## Implementation phases
P0: verify commerce build/CI, database tenancy, shipping/order data model. No LLM API cost.
P1: deterministic commerce tool gateway (read-only) + documented API schemas; verify multi-account, org-scoped access.
P2: embedded UI for chat, data-backed summaries, saved filters and draft pick lists. First tests with fixtures and mocked model responses.
P3: model-backed analysis with spend ceiling, citations and evaluation of factual accuracy; explicit owner approval before enabling usage.
P4: controlled agent actions gated by roles, legal entity, audit and independent verification; integrate with SAM rather than competing.
## Acceptance
Two-account and multi-company isolation; no cross-account label leaks; ambiguous account prompts require scope clarification; unverified margin displays MISSING_INPUT; no writes by read tools; 0 external side effects during unit tests; audit and cost usage attributable per session.
## Out of scope
Replit handoff, production deployment, live bol data writes and attaching SAM credentials at this stage.

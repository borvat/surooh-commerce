# WMS source diagnostics and minimum repair packet

Tested source: e0ba96bab66a43ba580fb13aec3675ea36def932. Actual commands are `bun run typecheck` (tsc --noEmit, exit2) and `bun run lint` (eslint ., exit1), with pinned Bun1.3.13/Node24.19.0. See alternative-evidence/wms-run-02.tar.gz logs/typecheck.log and logs/lint.log. This is a diagnosis, not a source fix or stage-start approval.

## All seven TypeScript diagnostics

| File / line:column | Code | Minimum repair to review |
|---|---|---|
| src/routes/_authenticated/assistant.tsx 7:38 | TS2345 | Reconcile generated FileRoutesByPath with the existing assistant route using the pinned router generator |
| same file 15:17 | TS2345 | Omit suggestedPath when undefined, or narrow the value before constructing Message; retain exactOptionalPropertyTypes |
| src/routes/_authenticated/orders.tsx 42:116 | TS2379 | Conditionally include accountId/from/to/externalRef only when defined; preserve all-account and empty-filter semantics |
| same file 56:38 | TS2379 | Apply the same typed optional-filter construction to the fresh re-read used before batch printing |
| src/routes/_authenticated/route.tsx 51:28 | TS2322 | Regenerate/reconcile route union to include existing /assistant; do not cast away route validation |
| same file 64:26 | TS2322 | Same generated route union affects this navigation target |
| src/routes/_authenticated/stockitup-review.tsx 9:38 | TS2345 | Reconcile generator output with existing stockitup-review route |

The actual build rewrote tracked src/routeTree.gen.ts by 44 additions/1 deletion. Its patch is retained in artifacts/tracked-source.patch. Review generator/version/input determinism and commit only reviewed generated output in a future source-fix packet; then ensure generation produces zero diff. Do not claim that regeneration alone fixes the three optional-property diagnostics. Do not weaken tsconfig, remove routes or add blanket assertions/ignores.

## Lint inventory

Actual ESLint summary: **3540 diagnostics =3525 errors +15 warnings**, 3524 errors potentially autofixable. There are 3538 fully parseable diagnostic rows across 133 files. Two additional formatting diagnostic lines were truncated by log redaction at Authorization headers, at source lines32:15 and44:15; their sensitive text is deliberately not reconstructed. The aggregate summary and original redacted log remain authoritative. The parsed rows contain3522 prettier/prettier errors, one prefer-const error,14 react-refresh warnings and one hooks dependency warning. The two redacted formatting errors account for the remaining two errors.

Minimum fixes: use const for the never-reassigned timer in src/integrations/supabase/previewAuthStorage.ts:38:11; perform formatter-only edits in small reviewed file groups under the existing Prettier config; retain rule severities and ignore scope. No broad formatting has been applied. Review each patch for semantic changes and rerun full lint after groups are complete. The warning at src/routes/_authenticated/products_.$productId.tsx:45:50 requires assessing row?.name in useEffect dependencies and edit-reset behavior, not blindly suppressing the warning. The14 fast-refresh warnings require extracting shared constants/functions to separate modules where appropriate; changing exports requires checking import consumers.

### Every non-format diagnostic

| File | Location | Rule / severity |
|---|---|---|
| src/components/app/bundle-view.tsx | 6:17 | react-refresh/only-export-components / warning |
| src/components/app/catalog.tsx | 21:17 | react-refresh/only-export-components / warning |
| src/components/app/forms.tsx | 22:17 | react-refresh/only-export-components / warning |
| src/components/app/merchant.tsx | 15:14 | react-refresh/only-export-components / warning |
| src/components/app/offer-card.tsx | 12:17 | react-refresh/only-export-components / warning |
| src/components/app/offer-card.tsx | 55:17 | react-refresh/only-export-components / warning |
| src/components/app/ui-bits.tsx | 98:14 | react-refresh/only-export-components / warning |
| src/components/app/ui-bits.tsx | 108:17 | react-refresh/only-export-components / warning |
| src/components/ui/badge.tsx | 32:17 | react-refresh/only-export-components / warning |
| src/components/ui/button.tsx | 49:18 | react-refresh/only-export-components / warning |
| src/components/ui/form.tsx | 163:3 | react-refresh/only-export-components / warning |
| src/components/ui/navigation-menu.tsx | 111:3 | react-refresh/only-export-components / warning |
| src/components/ui/sidebar.tsx | 743:3 | react-refresh/only-export-components / warning |
| src/components/ui/toggle.tsx | 42:18 | react-refresh/only-export-components / warning |
| src/integrations/supabase/previewAuthStorage.ts | 38:11 | prefer-const / error |
| src/routes/_authenticated/products_.$productId.tsx | 45:50 | react-hooks/exhaustive-deps / warning |

### Per-file parsed diagnostic counts

Counts below cover3538 parseable rows; the two redacted formatting entries remain only in the original log.

| File | Count |
|---|---|
| eslint.config.js | 1 |
| scripts/wms/phase-gate.mjs | 7 |
| src/components/app/acceptance.tsx | 10 |
| src/components/app/account-health.tsx | 31 |
| src/components/app/bundle-view.tsx | 31 |
| src/components/app/catalog.tsx | 119 |
| src/components/app/forms.tsx | 35 |
| src/components/app/merchant.tsx | 79 |
| src/components/app/offer-card.tsx | 49 |
| src/components/app/page.tsx | 6 |
| src/components/app/product-dialogs.tsx | 26 |
| src/components/app/product-master.tsx | 95 |
| src/components/app/review-cards.tsx | 80 |
| src/components/app/ui-bits.tsx | 19 |
| src/components/app/unified-offers.tsx | 38 |
| src/components/app/warehouse-batch-print.tsx | 24 |
| src/components/app/warehouse-print.tsx | 26 |
| src/components/ui/accordion.tsx | 1 |
| src/components/ui/alert-dialog.tsx | 1 |
| src/components/ui/alert.tsx | 1 |
| src/components/ui/aspect-ratio.tsx | 1 |
| src/components/ui/avatar.tsx | 1 |
| src/components/ui/badge.tsx | 2 |
| src/components/ui/breadcrumb.tsx | 1 |
| src/components/ui/button.tsx | 2 |
| src/components/ui/calendar.tsx | 1 |
| src/components/ui/card.tsx | 1 |
| src/components/ui/carousel.tsx | 1 |
| src/components/ui/chart.tsx | 1 |
| src/components/ui/checkbox.tsx | 1 |
| src/components/ui/collapsible.tsx | 1 |
| src/components/ui/command.tsx | 1 |
| src/components/ui/context-menu.tsx | 1 |
| src/components/ui/dialog.tsx | 1 |
| src/components/ui/drawer.tsx | 1 |
| src/components/ui/dropdown-menu.tsx | 1 |
| src/components/ui/form.tsx | 2 |
| src/components/ui/hover-card.tsx | 1 |
| src/components/ui/input-otp.tsx | 1 |
| src/components/ui/input.tsx | 1 |
| src/components/ui/label.tsx | 1 |
| src/components/ui/menubar.tsx | 1 |
| src/components/ui/navigation-menu.tsx | 2 |
| src/components/ui/pagination.tsx | 1 |
| src/components/ui/popover.tsx | 1 |
| src/components/ui/progress.tsx | 1 |
| src/components/ui/radio-group.tsx | 1 |
| src/components/ui/resizable.tsx | 1 |
| src/components/ui/scroll-area.tsx | 1 |
| src/components/ui/select.tsx | 1 |
| src/components/ui/separator.tsx | 1 |
| src/components/ui/sheet.tsx | 1 |
| src/components/ui/sidebar.tsx | 2 |
| src/components/ui/skeleton.tsx | 1 |
| src/components/ui/slider.tsx | 1 |
| src/components/ui/sonner.tsx | 1 |
| src/components/ui/switch.tsx | 1 |
| src/components/ui/table.tsx | 1 |
| src/components/ui/tabs.tsx | 1 |
| src/components/ui/textarea.tsx | 1 |
| src/components/ui/toggle-group.tsx | 1 |
| src/components/ui/toggle.tsx | 2 |
| src/components/ui/tooltip.tsx | 1 |
| src/hooks/use-mobile.tsx | 1 |
| src/integrations/lovable/index.ts | 1 |
| src/integrations/supabase/auth-attacher.ts | 7 |
| src/integrations/supabase/auth-middleware.ts | 42 |
| src/integrations/supabase/client.server.ts | 14 |
| src/integrations/supabase/client.ts | 15 |
| src/integrations/supabase/cron-auth.ts | 15 |
| src/integrations/supabase/previewAuthStorage.ts | 26 |
| src/integrations/supabase/types.ts | 1369 |
| src/lib/auth.ts | 2 |
| src/lib/bol.functions.ts | 67 |
| src/lib/bol.server.ts | 33 |
| src/lib/channels/adapter.ts | 1 |
| src/lib/commerce-copilot.ts | 11 |
| src/lib/csv.ts | 10 |
| src/lib/error-capture.ts | 1 |
| src/lib/error-page.ts | 1 |
| src/lib/inventory.ts | 71 |
| src/lib/lovable-error-reporting.ts | 1 |
| src/lib/order-economics.ts | 9 |
| src/lib/order-filters.ts | 7 |
| src/lib/product-family-reference.ts | 5 |
| src/lib/product-intelligence.ts | 52 |
| src/lib/product-master.ts | 29 |
| src/lib/shipping-label-contract.ts | 2 |
| src/lib/stockitup-identity.ts | 12 |
| src/lib/stockitup-review-queue.ts | 10 |
| src/lib/unified-stock.ts | 9 |
| src/lib/utils.ts | 1 |
| src/lib/warehouse-audit.ts | 12 |
| src/lib/warehouse-batch.ts | 14 |
| src/lib/warehouse-command-contract.ts | 19 |
| src/router.tsx | 1 |
| src/routes/__root.tsx | 2 |
| src/routes/_authenticated/assistant.tsx | 17 |
| src/routes/_authenticated/bundles.tsx | 12 |
| src/routes/_authenticated/channels.tsx | 3 |
| src/routes/_authenticated/components.tsx | 21 |
| src/routes/_authenticated/dashboard.tsx | 16 |
| src/routes/_authenticated/diagnostics.tsx | 5 |
| src/routes/_authenticated/import.tsx | 26 |
| src/routes/_authenticated/mappings.tsx | 58 |
| src/routes/_authenticated/movements.tsx | 21 |
| src/routes/_authenticated/orders.tsx | 75 |
| src/routes/_authenticated/products.tsx | 112 |
| src/routes/_authenticated/products_.$productId.tsx | 184 |
| src/routes/_authenticated/review.tsx | 93 |
| src/routes/_authenticated/route.tsx | 10 |
| src/routes/_authenticated/settings.tsx | 52 |
| src/routes/_authenticated/setup.tsx | 2 |
| src/routes/_authenticated/stockitup-review.tsx | 29 |
| src/routes/auth.tsx | 18 |
| src/routes/index.tsx | 6 |
| src/routes/reset-password.tsx | 4 |
| src/server.ts | 1 |
| src/start.ts | 1 |
| tests/foundation/architecture-decision.test.mjs | 10 |
| tests/order-economics.test.ts | 12 |
| tests/order-filters.test.ts | 7 |
| tests/product-family-reference.test.ts | 9 |
| tests/shipping-label-contract.test.ts | 6 |
| tests/stockitup-identity.test.ts | 11 |
| tests/stockitup-review-queue.test.ts | 6 |
| tests/warehouse-audit.test.ts | 35 |
| tests/warehouse-batch.test.ts | 20 |
| tests/warehouse-command-contract.test.ts | 9 |
| tests/warehouse-flow.test.ts | 36 |
| tests/warehouse-migration.test.ts | 1 |
| tests/warehouse-print.test.ts | 9 |
| vite.config.ts | 1 |

## Acceptance after a separately authorized bounded fix

From a clean new source SHA: frozen dependency install; route generation yields no tracked diff; tsc exits0; full eslint exits0 with all residual warnings disclosed;91 unit cases and existing gate/authority tests remain passing; actual build exits0 with artifacts and no tracked drift. Capture all actual exit codes/log hashes under the independent runner. Implement and exercise the isolated legacy DB adapter in a separate reviewed packet; unit tests cannot replace DB/RLS/concurrency tests. No financial ledger/valuation duplication, live provider writes, production operations or Codex start are authorized by this diagnosis.

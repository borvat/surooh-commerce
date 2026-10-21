# Existing React warnings — reviewed, not suppressed

The bounded acceptance requirement is lint with zero errors and all remaining warnings disclosed. Existing rule severities/ignore settings are preserved. No eslint-disable annotation was added and no warning was converted to information or removed by excluding a file.

| Warning | Existing locations before formatting | Review and disposition |
|---|---|---|
| react-hooks/exhaustive-deps (1) | routes/_authenticated/products_.$productId.tsx:45 | The effect resets the editable name when row.id changes. Adding row.name would also reset an unsaved edit when background product data refreshes. Preserve behavior in this cleanup; a separate UX decision should choose dirty-draft preservation vs automatic synchronization, then test rename/refetch/product-switch cases. Residual warning remains visible. |
| react-refresh/only-export-components (14) | app/bundle-view, catalog, forms, merchant, offer-card (2), ui-bits (2); ui/badge, button, form, navigation-menu, sidebar, toggle | Shared hooks/constants/helpers coexist with React component exports. These are development HMR-boundary warnings. Extraction changes public import boundaries and is not necessary for the zero-error source gate. Preserve exports/consumer behavior and document the warnings; a separate small extraction packet can keep compatibility re-exports and test callers before removing them. No hot-reload guarantee is claimed. |

Final locations/counts must come from the exact-SHA run's lint.log (formatting shifts line numbers). The original diagnostic inventory remains in shared-core/WMS_DIAGNOSTICS.md as historical evidence, not the current outcome.

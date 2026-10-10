/** Read-only, fail-closed identity matching for Stockitup imports.
 * Surooh owns the logical product. Stockitup SKU/EAN may suggest but NEVER bind or merge.
 * No network, database, or inventory side effects.
 */
export type ExternalProduct = {
  sellerId: string;
  productId: string;
  sku?: string | null;
  ean?: string | null;
  extraEans?: string[] | null;
};
export type ExternalMap = {
  organizationId: string;
  sellerId: string;
  productId: string;
  suroohProductId: string;
};
export type IdentityDecision =
  | { status: "MATCHED"; suroohProductId: string; evidence: "EXPLICIT_MAP" }
  | { status: "NEEDS_REVIEW"; reason: "UNMAPPED" | "AMBIGUOUS_MAP" | "INVALID_EXTERNAL_ID"; suggestedEans: string[] };

export function resolveStockitupIdentity(
  organizationId: string,
  source: ExternalProduct,
  mappings: ExternalMap[]
): IdentityDecision {
  const suggestedEans = [...new Set([source.ean, ...(source.extraEans ?? [])]
    .filter((v): v is string => typeof v === "string" && /^\d{8,14}$/.test(v.trim()))
    .map(v => v.trim()))];
  const org = organizationId.trim();
  const seller = source.sellerId.trim();
  const product = source.productId.trim();
  if (!org || !seller || !product)
    return { status: "NEEDS_REVIEW", reason: "INVALID_EXTERNAL_ID", suggestedEans };
  const matches = mappings.filter(m =>
    m.organizationId.trim() === org &&
    m.sellerId.trim() === seller &&
    m.productId.trim() === product
  );
  const targets = [...new Set(matches.map(m => m.suroohProductId.trim()))];
  // Duplicate mapping rows are not verified evidence, even if the target agrees.
  // Require exactly one explicit association for an automatic MATCHED preview.
  if (matches.length > 1 || (matches.length === 1 && !matches[0].suroohProductId.trim())) return { status: "NEEDS_REVIEW", reason: "AMBIGUOUS_MAP", suggestedEans };
  if (targets.length > 1) return { status: "NEEDS_REVIEW", reason: "AMBIGUOUS_MAP", suggestedEans };
  if (targets.length === 1) return { status: "MATCHED", suroohProductId: targets[0], evidence: "EXPLICIT_MAP" };
  return { status: "NEEDS_REVIEW", reason: "UNMAPPED", suggestedEans };
}

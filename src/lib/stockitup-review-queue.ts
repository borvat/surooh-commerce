/** Preview-only Stockitup reconciliation queue.
 * Never creates products, mappings or inventory changes.
 */
import {
  resolveStockitupIdentity,
  type ExternalMap,
  type ExternalProduct,
} from "./stockitup-identity";

export type ReviewRow = {
  key: string;
  sellerId: string;
  productId: string;
  sku: string | null;
  eans: string[];
  status: "MATCHED" | "NEEDS_REVIEW";
  reason:
    | "EXPLICIT_MAP"
    | "UNMAPPED"
    | "AMBIGUOUS_MAP"
    | "INVALID_EXTERNAL_ID"
    | "DUPLICATE_EXTERNAL_KEY";
  suroohProductId: string | null;
};
export type ReviewPreview = {
  rows: ReviewRow[];
  totals: { seen: number; matched: number; needsReview: number };
};
export function previewStockitupMappings(
  organizationId: string,
  externalProducts: ExternalProduct[],
  mappings: ExternalMap[],
): ReviewPreview {
  const counts = new Map<string, number>();
  for (const product of externalProducts) {
    const key = JSON.stringify([product.sellerId.trim(), product.productId.trim()]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows: ReviewRow[] = [];
  for (const product of externalProducts) {
    const key = JSON.stringify([product.sellerId.trim(), product.productId.trim()]);
    // Every row sharing an external key is ambiguous, including the first one.
    const duplicate = (counts.get(key) ?? 0) > 1;
    const decision = resolveStockitupIdentity(organizationId, product, mappings);
    const eans = [
      ...new Set(
        [product.ean, ...(product.extraEans ?? [])]
          .filter((v): v is string => typeof v === "string" && /^\d{8,14}$/.test(v.trim()))
          .map((v) => v.trim()),
      ),
    ];
    rows.push({
      key,
      sellerId: product.sellerId,
      productId: product.productId,
      sku: product.sku ?? null,
      eans,
      status: duplicate ? "NEEDS_REVIEW" : decision.status,
      reason: duplicate
        ? "DUPLICATE_EXTERNAL_KEY"
        : decision.status === "MATCHED"
          ? "EXPLICIT_MAP"
          : decision.reason,
      suroohProductId: duplicate
        ? null
        : decision.status === "MATCHED"
          ? decision.suroohProductId
          : null,
    });
  }
  const matched = rows.filter((row) => row.status === "MATCHED").length;
  return { rows, totals: { seen: rows.length, matched, needsReview: rows.length - matched } };
}

import { describe, expect, test } from "bun:test";
import { previewStockitupMappings } from "../src/lib/stockitup-review-queue";

const item = { sellerId:"seller-1", productId:"prod-21", sku:"old-sku", ean:"8711252955193", extraEans:["8711252459424"] };
const mapping = { organizationId:"org-a", sellerId:"seller-1", productId:"prod-21", suroohProductId:"surooh-master-1" };

describe("Stockitup review queue (preview only)", () => {
  test("recognizes explicit mappings and records counts", () => {
    const r = previewStockitupMappings("org-a", [item], [mapping]);
    expect(r.totals).toEqual({ seen:1, matched:1, needsReview:0 });
    expect(r.rows[0].suroohProductId).toBe("surooh-master-1");
  });
  test("unmapped item goes to review without changing identity", () => {
    const r = previewStockitupMappings("org-a", [item], []);
    expect(r.rows[0].reason).toBe("UNMAPPED");
    expect(r.rows[0].suroohProductId).toBeNull();
    expect(r.rows[0].eans).toHaveLength(2);
  });
  test("same external product twice is flagged", () => {
    const r = previewStockitupMappings("org-a", [item, item], [mapping]);
    expect(r.rows[0].reason).toBe("DUPLICATE_EXTERNAL_KEY");
    expect(r.rows[1].reason).toBe("DUPLICATE_EXTERNAL_KEY");
    expect(r.rows.every(row => row.suroohProductId === null)).toBe(true);
    expect(r.totals.needsReview).toBe(2);
  });
  test("cross-seller mapping cannot match", () => {
    const r = previewStockitupMappings("org-a", [{...item,sellerId:"seller-2"}], [mapping]);
    expect(r.rows[0].status).toBe("NEEDS_REVIEW");
  });
});

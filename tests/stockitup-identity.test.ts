import { describe, expect, test } from "bun:test";
import { resolveStockitupIdentity } from "../src/lib/stockitup-identity";
const source = { sellerId: "seller-1", productId: "product-21", sku: "EAN-AS-SKU", ean: "8711252955193", extraEans: ["8711252459424"] };
const map = { organizationId: "org-a", sellerId: "seller-1", productId: "product-21", suroohProductId: "master-a" };
describe("Stockitup product identity", () => {
  test("only explicit mapping is authoritative", () => {
    expect(resolveStockitupIdentity("org-a", source, [map])).toEqual({ status:"MATCHED", suroohProductId:"master-a", evidence:"EXPLICIT_MAP" });
  });
  test("same EAN or SKU never auto-matches without a map", () => {
    const result=resolveStockitupIdentity("org-a", source, []);
    expect(result.status).toBe("NEEDS_REVIEW");
    if(result.status==="NEEDS_REVIEW") expect(result.suggestedEans).toHaveLength(2);
  });
  test("seller and organization must both match", () => {
    expect(resolveStockitupIdentity("org-b",source,[map]).status).toBe("NEEDS_REVIEW");
    expect(resolveStockitupIdentity("org-a",{...source,sellerId:"seller-2"},[map]).status).toBe("NEEDS_REVIEW");
  });
  test("duplicate identical mappings require review rather than assuming confirmation", () => {
    const result = resolveStockitupIdentity("org-a", source, [map, { ...map }]);
    expect(result.status).toBe("NEEDS_REVIEW");
    if (result.status === "NEEDS_REVIEW") expect(result.reason).toBe("AMBIGUOUS_MAP");
  });
  test("conflicting mappings fail closed", () => {
    expect(resolveStockitupIdentity("org-a",source,[map,{...map,suroohProductId:"master-b"}]).status).toBe("NEEDS_REVIEW");
  });
});

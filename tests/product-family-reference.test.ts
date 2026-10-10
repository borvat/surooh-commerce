import { describe, expect, test } from "bun:test";
import { resolveFamilyReference, masterReferenceForPrint, type MasterChild } from "../src/lib/product-family-reference";
const a: MasterChild = { id:"p1", organizationId:"org-A", familyId:"f1", sku:"SKU1", ean:"8711252955193", masterReference:"MASTER-100" };
const b: MasterChild = { ...a, id:"p2", sku:"SKU2", ean:"8711252459424", masterReference:null };
describe("product master shared reference", () => {
  test("two EANs in one family resolve to the same master reference", () => {
    expect(resolveFamilyReference(a,[a,b])).toBe("MASTER-100");
    expect(resolveFamilyReference(b,[a,b])).toBe("MASTER-100");
  });
  test("rejects conflicting references within a family", () => {
    expect(() => resolveFamilyReference(b,[a,{ ...b,masterReference:"OTHER" }])).toThrow();
  });
  test("cannot borrow a reference from another company", () => {
    expect(resolveFamilyReference(b,[a,{...b,organizationId:"org-B"}])).toThrow();
  });
  test("printed reference falls back to SKU, but never rewrites EAN", () => {
    expect(masterReferenceForPrint({master_reference:"MASTER-100",sku:"SKU2"})).toBe("MASTER-100");
    expect(masterReferenceForPrint({sku:"SKU2"})).toBe("SKU2");
  });
});

import { describe, expect, test } from "bun:test";
import { planWarehouseBatch, type PickOrder } from "../src/lib/warehouse-batch";
const base = (id: string): PickOrder => ({
  id, organizationId: "company-Q", channelId: "bol-1", externalOrderId: id, status: "placed",
  lines: [{ sku: "STOVE", quantity: 2, fulfillment: "FBR" }, { sku: "BOL-HANDLED", quantity: 3, fulfillment: "FBB" }]
});
const scope = { organizationId: "company-Q", channelId: "bol-1" };
describe("warehouse batch planner", () => {
  test("groups only physically shipped pieces", () => {
    const r = planWarehouseBatch([base("A"), base("B")], scope);
    expect(r.totals).toEqual({ orders: 2, pieces: 4, distinctSku: 1 });
    expect(r.skuTotals).toEqual([{ sku: "STOVE", pieces: 4 }]);
  });
  test("rejects another seller account or company", () => {
    const r = planWarehouseBatch([{ ...base("A"), channelId: "bol-2" }, { ...base("B"), organizationId: "company-X" }], scope);
    expect(r.eligible).toHaveLength(0);
    expect(r.rejected.map(x=>x.reason)).toEqual(["UNAUTHORIZED_SCOPE", "UNAUTHORIZED_SCOPE"]);
  });
  test("rejects duplicate, cancelled, fulfilled and FBB-only order", () => {
    const a=base("A");
    const result = planWarehouseBatch([a, a, { ...base("B"), status: "fulfilled" }, { ...base("C"), status: "cancelled" },
      { ...base("D"), lines: [{ sku: "BOL", quantity: 1, fulfillment: "FBB" }] }], scope);
    expect(result.totals.orders).toBe(1);
    expect(result.rejected).toHaveLength(4);
  });
  test("rejects totals that exceed safe integer precision", () => {
    const huge = base("A");
    huge.lines = [{ sku: "STOVE", quantity: Number.MAX_SAFE_INTEGER, fulfillment: "FBR" }];
    expect(() => planWarehouseBatch([huge, base("B")], scope)).toThrow("Unsafe warehouse SKU total");
  });
  test("rejects invalid quantity and missing authorization", () => {
    const bad = base("A"); bad.lines[0].quantity = 0;
    expect(planWarehouseBatch([bad], scope).rejected[0].reason).toBe("INVALID_LINE");
    expect(() => planWarehouseBatch([], { organizationId: "", channelId: "bol-1" })).toThrow();
  });
});

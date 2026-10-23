import { describe, expect, test } from "bun:test";
import { scanPlan, scannedCounts } from "../src/lib/native-scanner";
import type { NativeSnapshot } from "../src/lib/native-projection";

// Fabricated read model only; native HTTP cases separately verify server authority.
function fixture(): NativeSnapshot {
  return {
    items: [
      { id: "C1", name: "One", stock: true, barcodes: ["000001"] },
      { id: "C2", name: "Two", stock: true, barcodes: ["000002"] },
    ],
    orders: [
      {
        id: "ORDER",
        status: "placed",
        pick_list: null,
        delivery_note: null,
        lines: [
          { item: "C1", quantity: 1 },
          { item: "C2", quantity: 2 },
        ],
      },
    ],
  } as unknown as NativeSnapshot;
}
describe("operator scan plan", () => {
  test("barcode leading zeros survive and mixed SKU/barcode scans share one item count", () => {
    const plan = scanPlan(fixture(), "ORDER");
    expect(
      scannedCounts(plan, [
        { code: "000001", qty: 1 },
        { code: "C2", qty: 1 },
        { code: "000002", qty: 1 },
      ]),
    ).toEqual({ C1: 1, C2: 2 });
  });
  test("unknown code cannot advance scan progress", () => {
    expect(() =>
      scannedCounts(scanPlan(fixture(), "ORDER"), [{ code: "UNKNOWN", qty: 1 }]),
    ).toThrow("غير معروف");
  });
  test("SKU versus another item's barcode collision is ambiguous", () => {
    const data = fixture();
    data.items[0].barcodes!.push("C2");
    expect(() => scannedCounts(scanPlan(data, "ORDER"), [{ code: "C2", qty: 1 }])).toThrow("ملتبس");
  });
  test("excess units fail without mutating earlier scan input", () => {
    const scans = [{ code: "C1", qty: 2 }];
    expect(() => scannedCounts(scanPlan(fixture(), "ORDER"), scans)).toThrow("تتجاوز");
    expect(scans).toEqual([{ code: "C1", qty: 2 }]);
  });
  test("partial progress cannot look complete", () => {
    const plan = scanPlan(fixture(), "ORDER");
    const counts = scannedCounts(plan, [{ code: "C1", qty: 1 }]);
    expect(plan.every((line) => counts[line.item] === line.quantity)).toBe(false);
  });
  test("duplicate component lines fold before quantity verification", () => {
    const data = fixture();
    data.orders[0].lines.push({ item: "C1", quantity: 2 });
    expect(scanPlan(data, "ORDER").find((line) => line.item === "C1")?.quantity).toBe(3);
  });
  test("cancelled and already picked orders cannot start a scan plan", () => {
    const data = fixture();
    data.orders[0].status = "cancelled";
    expect(() => scanPlan(data, "ORDER")).toThrow("غير متاح");
    data.orders[0].status = "placed";
    data.orders[0].pick_list = "PICK";
    expect(() => scanPlan(data, "ORDER")).toThrow("غير متاح");
  });
  test("fractional quantities do not produce an unfinishable whole-unit scan plan", () => {
    const data = fixture();
    data.orders[0].lines[0].quantity = 0.5;
    expect(() => scanPlan(data, "ORDER")).toThrow("بوحدات كاملة");
  });
});

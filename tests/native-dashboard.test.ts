import { describe, expect, test } from "bun:test";
import { nativeDashboardMetrics } from "../src/lib/native-dashboard";
import type { NativeOrder, NativeSnapshot } from "../src/lib/native-projection";
import type { LocationStock } from "../src/lib/native-stock-operations";

const order = (extra: Partial<NativeOrder> = {}): NativeOrder => ({
  id: "O",
  status: "placed",
  created_at: "",
  updated_at: "",
  pick_list: null,
  packing_slip: null,
  delivery_note: null,
  lines: [],
  ...extra,
});
const snapshot = (orders: NativeOrder[] = []): NativeSnapshot => ({
  company: "TEST-A",
  warehouse: "BASE",
  items: [],
  movements: [],
  orders,
});
const locations = (): LocationStock => ({
  company: "TEST-A",
  fulfillment_warehouse: "BASE",
  locations: [
    { name: "BASE", warehouse_name: "Base", is_rejected_warehouse: 0 },
    { name: "Q", warehouse_name: "Quarantine", is_rejected_warehouse: 1 },
    { name: "Q2", warehouse_name: "Other quarantine", is_rejected_warehouse: 1 },
  ],
  bins: [],
});
const batch = (extra = {}) => ({
  pick_list: "P",
  shipped: false,
  cancelled: false,
  delivery_note: null,
  packing_slip: null,
  return_note: null,
  lines: [],
  ...extra,
});

describe("native dashboard read metrics", () => {
  test("closed legacy placed orders and terminal orders leave every active queue", () => {
    const result = nativeDashboardMetrics(
      snapshot([
        order(),
        order({ remainder_closed: true, pick_list: "OLD" }),
        order({ status: "fulfilled" }),
        order({ status: "cancelled" }),
      ]),
      locations(),
    );
    expect(result.pending_orders).toBe(1);
    expect(result.awaiting_pick).toBe(1);
    expect(result.awaiting_pack).toBe(0);
    expect(result.ready_to_ship).toBe(0);
    expect(result.closed_remainders).toBe(1);
  });
  test("a shipped/cancelled batch history with a remaining order still needs a new pick", () => {
    const result = nativeDashboardMetrics(
      snapshot([
        order({
          pick_list: "OLD-PICK",
          shipment_plan: { total_units: 3, remaining_units: 2, lines: [] },
          shipment_batches: [
            batch({ shipped: true }),
            batch({ pick_list: "CANCELLED", cancelled: true }),
          ],
        }),
      ]),
      locations(),
    );
    expect(result.pending_orders).toBe(1);
    expect(result.awaiting_pick).toBe(1);
    expect(result.awaiting_pack).toBe(0);
    expect(result.ready_to_ship).toBe(0);
  });
  test("only active tasks count; completed batches and legacy pointers are not double-counted", () => {
    const result = nativeDashboardMetrics(
      snapshot([
        order({
          id: "B1",
          pick_list: "LEGACY",
          shipment_batches: [batch(), batch({ pick_list: "DONE", shipped: true })],
        }),
        order({
          id: "B2",
          shipment_batches: [
            batch({ packing_slip: "PACK" }),
            batch({ pick_list: "CANCELLED", cancelled: true }),
          ],
        }),
        order({ id: "L", pick_list: "P", packing_slip: "PACK" }),
      ]),
      locations(),
    );
    expect(result.pending_orders).toBe(3);
    expect(result.awaiting_pack).toBe(1);
    expect(result.ready_to_ship).toBe(2);
    expect(result.awaiting_pick).toBe(0);
  });
  test("quarantine counts distinct positive SKUs, value includes all native bins, and inputs stay unchanged", () => {
    const s = snapshot();
    s.items = [0, 1].map((i) => ({
      id: String(i),
      name: "Synthetic",
      stock: !i,
      physical: 2,
      reserved: 2,
      value: 20,
      uom: "Nos",
      created_at: "",
      updated_at: "",
      parts: [],
    }));
    const l = locations();
    l.bins = [
      {
        warehouse: "BASE",
        item_code: "BASE-ONLY",
        actual_qty: 9,
        reserved_stock: 0,
        valuation_rate: 10,
        stock_value: 90,
        movement_version: "v1",
      },
      {
        warehouse: "Q",
        item_code: "C",
        actual_qty: 2,
        reserved_stock: 0,
        valuation_rate: 10,
        stock_value: 20,
        movement_version: "v2",
      },
      {
        warehouse: "Q2",
        item_code: "C",
        actual_qty: 3,
        reserved_stock: 0,
        valuation_rate: 10,
        stock_value: 30,
        movement_version: "v3",
      },
      {
        warehouse: "Q",
        item_code: "EMPTY",
        actual_qty: 0,
        reserved_stock: 0,
        valuation_rate: 0,
        stock_value: 0,
        movement_version: "v4",
      },
    ];
    const before = JSON.stringify([s, l]);
    const result = nativeDashboardMetrics(s, l);
    expect(result.stock_skus).toBe(1);
    expect(result.zero_available_skus).toBe(1);
    expect(result.quarantine_skus).toBe(1);
    expect(result.inventory_value).toBe(140);
    expect(JSON.stringify([s, l])).toBe(before);
  });
  test("cannot combine companies into one dashboard or value total", () => {
    const other = { ...locations(), company: "TEST-B" } as unknown as LocationStock;
    expect(() => nativeDashboardMetrics(snapshot(), other)).toThrow("Dashboard company mismatch");
  });
});

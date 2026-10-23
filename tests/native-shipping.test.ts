import { describe, expect, test } from "bun:test";
import { shipmentRequest } from "../src/lib/native-shipping";
import type { NativeOrder } from "../src/lib/native-projection";

const order: NativeOrder = {
  id: "SO-1",
  status: "placed",
  created_at: "",
  updated_at: "",
  pick_list: null,
  packing_slip: null,
  delivery_note: null,
  lines: [
    { item: "C1", quantity: 3 },
    { item: "C2", quantity: 6 },
  ],
  shipment_plan: {
    total_units: 3,
    remaining_units: 3,
    lines: [
      { id: "r1", item: "C1", quantity: 1 },
      { id: "r2", item: "C2", quantity: 2 },
    ],
  },
  shipment_batches: [],
};
describe("native shipment request", () => {
  test("uses native immutable order plan and a stable explicit batch identity", () => {
    expect(shipmentRequest(order, 1, "batch-1")).toEqual({
      order_id: "SO-1",
      batch_id: "batch-1",
      units: 1,
      expected_picks: [],
    });
  });
  test("rejects invalid or excessive quantities", () => {
    for (const qty of [0, -1, 1.5, 4, NaN, Infinity])
      expect(() => shipmentRequest(order, qty, "b")).toThrow();
  });
  test("requires a fresh eligible order without active full or partial pick", () => {
    expect(() => shipmentRequest({ ...order, pick_list: "P" }, 1, "b")).toThrow();
    expect(() => shipmentRequest({ ...order, status: "fulfilled" }, 1, "b")).toThrow();
    expect(() => shipmentRequest({ ...order, shipment_plan: null }, 1, "b")).toThrow();
    expect(() =>
      shipmentRequest(
        {
          ...order,
          shipment_batches: [
            {
              pick_list: "P",
              shipped: false,
              delivery_note: null,
              packing_slip: null,
              return_note: null,
              lines: [],
            },
          ],
        },
        1,
        "b",
      ),
    ).toThrow();
  });
  test("binds next batch to sorted native pick history", () => {
    const shipped = (pick_list: string) => ({
      pick_list,
      shipped: true,
      delivery_note: "D",
      packing_slip: "S",
      return_note: null,
      lines: [],
    });
    expect(
      shipmentRequest({ ...order, shipment_batches: [shipped("P2"), shipped("P1")] }, 1, "b")
        .expected_picks,
    ).toEqual(["P1", "P2"]);
  });
});

test("cancelled batch stays in history without blocking its replacement", () => {
  const cancelled = {
    pick_list: "P-CANCELLED",
    shipped: false,
    cancelled: true,
    delivery_note: null,
    packing_slip: null,
    return_note: null,
    lines: [],
  };
  expect(
    shipmentRequest({ ...order, shipment_batches: [cancelled] }, 1, "replacement").expected_picks,
  ).toEqual(["P-CANCELLED"]);
});

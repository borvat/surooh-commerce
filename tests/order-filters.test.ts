import { describe, expect, test } from "bun:test";
import { filterLoadedOrders } from "../src/lib/order-filters";
const rows = [
  { order_number: 12, external_ref: "BOL-12", created_at: "2026-10-09T11:00:00Z", status: "placed", sales_channels: { name: "QNAN bol" }, order_lines: [{ fulfillment_method: "FBR", products: { sku: "SKU-A", name: "Camping stove" } }] },
  { order_number: 13, external_ref: "BOL-13", created_at: "2026-10-10T11:00:00Z", status: "fulfilled", sales_channels: { name: "NAN bol" }, order_lines: [{ fulfillment_method: "FBB", products: { sku: "SKU-B", name: "Storage box" } }] }
];
describe("loaded page order filters", () => {
  test("searches SKU and names on the currently loaded rows", () => {
    expect(filterLoadedOrders(rows, { query: "sku-a" }).map(o => o.order_number)).toEqual([12]);
    expect(filterLoadedOrders(rows, { query: "Storage" }).map(o => o.order_number)).toEqual([13]);
  });
  test("filters by fulfillment without pretending to cover all server pages", () => {
    expect(filterLoadedOrders(rows, { fulfillment: "FBR" }).map(o => o.order_number)).toEqual([12]);
    expect(filterLoadedOrders(rows, { fulfillment: "FBB" }).map(o => o.order_number)).toEqual([13]);
  });
  test("includes date boundaries and does not mutate source", () => {
    expect(filterLoadedOrders(rows, { from: "2026-10-10", to: "2026-10-10" }).map(o => o.order_number)).toEqual([13]);
    expect(rows).toHaveLength(2);
  });
});

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { WarehousePrint, type WarehouseOrder } from "../src/components/app/warehouse-print";
import { WarehouseBatchPrint } from "../src/components/app/warehouse-batch-print";
import type { PickBatchResult } from "../src/lib/warehouse-batch";

// 100% fabricated data — no real orders, accounts, or products.
const fakeOrder: WarehouseOrder = {
  id: "fake-order-1",
  order_number: 9001,
  external_ref: "FAKE-EXT-1",
  created_at: "2026-10-10T10:00:00Z",
  sales_channels: { name: "حساب تجريبي" },
  order_lines: [
    { quantity: 2, fulfillment_method: "FBR", products: { sku: "FAKE-SKU-1", name: "منتج وهمي", ean: "0000000000001", master_reference: "MASTER-FAKE-1" } },
    { quantity: 3, fulfillment_method: "FBB", products: { sku: "FBB-SKU-EXCLUDED", name: "منتج بول", ean: "0000000000002", master_reference: "MASTER-FBB" } },
  ],
};

const fakeBatch: PickBatchResult = {
  eligible: [
    { id: "fake-1", organizationId: "org-fake", channelId: "ch-fake", externalOrderId: "EXT-FAKE-1", status: "placed", lines: [{ sku: "FAKE-SKU-1", quantity: 2, fulfillment: "FBR" }] },
  ],
  rejected: [{ id: "fake-2", reason: "FBB only" }],
  totals: { orders: 1, pieces: 2, distinctSku: 1 },
  skuTotals: [{ sku: "FAKE-SKU-1", pieces: 2 }],
};

describe("WarehousePrint (synthetic render)", () => {
  const html = renderToStaticMarkup(createElement(WarehousePrint, { order: fakeOrder, onClose: () => {} }));

  test("includes internal master reference, SKU and EAN", () => {
    expect(html).toContain("MASTER-FAKE-1");
    expect(html).toContain("FAKE-SKU-1");
    expect(html).toContain("0000000000001");
  });

  test("carries the pick-list-not-shipping disclaimer", () => {
    expect(html).toContain("ورقة اختيار وتجهيز داخلية، وليست إثبات شحن أو تسليم");
    expect(html).toContain("ملصق الشحن:");
  });

  test("excludes FBB lines from the pick list", () => {
    expect(html).not.toContain("FBB-SKU-EXCLUDED");
    expect(html).not.toContain("MASTER-FBB");
    expect(html).toContain("إجمالي قطع المستودع: 2"); // 2 FBR pieces, not 5
  });

  test("renders nothing when only FBB lines exist", () => {
    const fbbOnly: WarehouseOrder = { ...fakeOrder, order_lines: [fakeOrder.order_lines![1]] };
    expect(renderToStaticMarkup(createElement(WarehousePrint, { order: fbbOnly, onClose: () => {} }))).toBe("");
  });
});

describe("WarehouseBatchPrint (synthetic render)", () => {
  const html = renderToStaticMarkup(createElement(WarehouseBatchPrint, { batch: fakeBatch, accountName: "حساب تجريبي", onClose: () => {} }));

  test("includes SKU totals and eligible order refs", () => {
    expect(html).toContain("FAKE-SKU-1");
    expect(html).toContain("EXT-FAKE-1");
    expect(html).toContain("حساب تجريبي");
  });

  test("carries the internal-only disclaimer and rejection note", () => {
    expect(html).toContain("مستند داخلي للتجهيز فقط؛ ليس ملصق شحن ولا إثبات تسليم أو شحن");
    expect(html).toContain("تم استبعاد 1 طلب غير مؤهل");
  });
});

describe("print controls are local-only", () => {
  const sources = [
    readFileSync(new URL("../src/components/app/warehouse-print.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../src/components/app/warehouse-batch-print.tsx", import.meta.url), "utf8"),
  ];

  test("print/close controls call window.print and onClose only — no network, fulfillment, or backend calls", () => {
    for (const src of sources) {
      expect(src).toContain("window.print()");
      expect(src).toContain("onClose");
      expect(src).not.toMatch(/fetch\(|XMLHttpRequest|supabase|\.rpc\(|\.insert\(|\.update\(|\.delete\(|fulfillOrder|createServerFn/);
    }
  });
});
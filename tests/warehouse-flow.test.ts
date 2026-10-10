/**
 * Synthetic-only integration tests composing pure warehouse helpers.
 * All data is fabricated. No network, database, or fulfillment side effects.
 */
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { planWarehouseBatch, type PickOrder } from "../src/lib/warehouse-batch";
import { reviewWarehouseEvents, type WarehouseEvent, type WarehouseEventKind } from "../src/lib/warehouse-audit";
import { resolveStockitupIdentity, type ExternalMap } from "../src/lib/stockitup-identity";
import { resolveFamilyReference, type MasterChild } from "../src/lib/product-family-reference";
import { filterLoadedOrders } from "../src/lib/order-filters";
import { WarehouseBatchPrint } from "../src/components/app/warehouse-batch-print";

const SCOPE = { organizationId: "org-A", channelId: "ch-A" } as const;

function order(id: string, overrides: Partial<PickOrder> = {}): PickOrder {
  return {
    id,
    organizationId: SCOPE.organizationId,
    channelId: SCOPE.channelId,
    externalOrderId: `EXT-${id}`,
    status: "placed",
    lines: [{ sku: "SKU-1", quantity: 1, fulfillment: "FBR" }],
    ...overrides,
  };
}

function event(n: number, kind: WarehouseEventKind, extra: Partial<WarehouseEvent> = {}): WarehouseEvent {
  return {
    eventId: `ev-${n}`,
    orgId: "org-A",
    channelId: "ch-A",
    orderId: "o-1",
    actorUserId: "user-1",
    kind,
    recordedAt: new Date(Date.UTC(2026, 9, 10, 10, n)).toISOString(),
    ...extra,
  };
}
const EVENT_SCOPE = { orgId: "org-A", channelId: "ch-A", orderId: "o-1" };

describe("batch scope and eligibility", () => {
  const result = planWarehouseBatch(
    [
      order("ok-1", { lines: [{ sku: "SKU-1", quantity: 2, fulfillment: "FBR" }] }),
      order("other-org", { organizationId: "org-B" }),
      order("other-channel", { channelId: "ch-B" }),
      order("fbb-only", { lines: [{ sku: "SKU-BOL", quantity: 5, fulfillment: "FBB" }] }),
      order("mixed", { lines: [{ sku: "SKU-2", quantity: 1, fulfillment: "FBR" }, { sku: "SKU-BOL", quantity: 9, fulfillment: "FBB" }] }),
      order("dup", { externalOrderId: "EXT-ok-1" }),
    ],
    SCOPE,
  );
  const reasons = Object.fromEntries(result.rejected.map(r => [r.id, r.reason]));

  test("cross-organization and cross-channel orders are rejected", () => {
    expect(reasons["other-org"]).toBe("UNAUTHORIZED_SCOPE");
    expect(reasons["other-channel"]).toBe("UNAUTHORIZED_SCOPE");
  });
  test("FBB-only orders are rejected and FBB lines never reach SKU totals", () => {
    expect(reasons["fbb-only"]).toBe("NO_WAREHOUSE_ITEMS");
    expect(result.skuTotals.map(s => s.sku)).not.toContain("SKU-BOL");
    expect(result.totals).toEqual({ orders: 1, pieces: 1, distinctSku: 1 });
  });
  test("duplicate external order within the same scope is rejected", () => {
    expect(reasons["dup"]).toBe("DUPLICATE_ORDER");
    expect(reasons["ok-1"]).toBe("DUPLICATE_ORDER");
    expect(result.eligible.map(o => o.id)).toEqual(["mixed"]);
  });
  test("missing authorized scope fails closed", () => {
    expect(() => planWarehouseBatch([order("x")], { organizationId: "", channelId: "ch-A" })).toThrow();
  });
  test("eligible mixed orders carry only their FBR lines", () => {
    const mixed = result.eligible.find(o => o.id === "mixed")!;
    expect(mixed.lines).toEqual([{ sku: "SKU-2", quantity: 1, fulfillment: "FBR" }]);
  });
  test("a duplicate is rejected even if its first occurrence was ineligible", () => {
    const r = planWarehouseBatch([order("a", { status: "cancelled" }), order("b", { externalOrderId: "EXT-a" })], SCOPE);
    expect(r.eligible).toHaveLength(0);
    expect(r.rejected.map(x => x.reason)).toEqual(["DUPLICATE_ORDER", "DUPLICATE_ORDER"]);
  });
  test("duplicate detection trims whitespace but stays case-sensitive", () => {
    const trimmed = planWarehouseBatch([order("a", { externalOrderId: "X-1" }), order("b", { externalOrderId: " X-1 " })], SCOPE);
    expect(trimmed.eligible).toHaveLength(0);
    const cased = planWarehouseBatch([order("a", { externalOrderId: "X-1" }), order("b", { externalOrderId: "x-1" })], SCOPE);
    expect(cased.eligible).toHaveLength(2);
  });
});

describe("loaded-page filter composed with batch planning", () => {
  test("FBR filter then plan keeps only warehouse work", () => {
    const rows = [
      { order_number: 1, created_at: "2026-10-10T08:00:00Z", sales_channels: { name: "A" }, order_lines: [{ fulfillment_method: "FBR", quantity: 1, products: { sku: "SKU-1" } }] },
      { order_number: 2, created_at: "2026-10-10T09:00:00Z", sales_channels: { name: "A" }, order_lines: [{ fulfillment_method: "FBB", quantity: 1, products: { sku: "SKU-BOL" } }] },
    ];
    const filtered = filterLoadedOrders(rows, { fulfillment: "FBR", account: "A" });
    expect(filtered.map(r => r.order_number)).toEqual([1]);
    const plan = planWarehouseBatch(
      filtered.map(r => order(String(r.order_number), {
        lines: r.order_lines.map(l => ({ sku: l.products.sku, quantity: l.quantity, fulfillment: l.fulfillment_method as "FBR" | "FBB" })),
      })),
      SCOPE,
    );
    expect(plan.totals).toEqual({ orders: 1, pieces: 1, distinctSku: 1 });
    expect(rows).toHaveLength(2);
  });
});

describe("Stockitup identity is never implicitly confirmed", () => {
  const maps: ExternalMap[] = [{ organizationId: "org-A", sellerId: "s1", productId: "p1", suroohProductId: "prod-1" }];
  test("unmapped product needs review even with a valid EAN", () => {
    const d = resolveStockitupIdentity("org-A", { sellerId: "s1", productId: "p2", ean: "8712345678901" }, maps);
    expect(d.status).toBe("NEEDS_REVIEW");
    if (d.status === "NEEDS_REVIEW") {
      expect(d.reason).toBe("UNMAPPED");
      expect(d.suggestedEans).toEqual(["8712345678901"]);
    }
  });
  test("a mapping from another organization does not confirm", () => {
    expect(resolveStockitupIdentity("org-B", { sellerId: "s1", productId: "p1" }, maps).status).toBe("NEEDS_REVIEW");
  });
  test("only an explicit single mapping matches", () => {
    expect(resolveStockitupIdentity("org-A", { sellerId: "s1", productId: "p1" }, maps)).toEqual({ status: "MATCHED", suroohProductId: "prod-1", evidence: "EXPLICIT_MAP" });
  });
});

describe("family reference across multiple EANs", () => {
  const child = (id: string, ean: string, ref: string | null, org = "org-A"): MasterChild =>
    ({ id, organizationId: org, familyId: "fam-1", sku: `SKU-${id}`, ean, masterReference: ref });
  const family = [child("a", "8710000000001", "MASTER-1"), child("b", "8710000000002", null), child("c", "8710000000003", " MASTER-1 ")];

  test("every EAN in an authorized family resolves to the same reference", () => {
    expect(family.map(c => resolveFamilyReference(c, family))).toEqual(["MASTER-1", "MASTER-1", "MASTER-1"]);
  });
  test("a sibling in another organization cannot lend its reference", () => {
    const foreign = child("x", "8710000000009", "FOREIGN", "org-B");
    expect(resolveFamilyReference(family[1]!, [family[1]!, foreign])).toBeNull();
  });
  test("conflicting references fail closed", () => {
    expect(() => resolveFamilyReference(family[0]!, [...family, child("d", "8710000000004", "MASTER-2")])).toThrow();
  });
});

describe("handoff readiness", () => {
  const full: WarehouseEvent[] = [
    event(1, "PICK_LIST_PRINTED"),
    event(2, "PICKING_STARTED"),
    event(3, "PICKING_COMPLETED"),
    event(4, "PACKING_CHECKED"),
    event(5, "CARRIER_LABEL_VERIFIED", { evidenceRef: "label-scan-1" }),
  ];
  test("sequential pick, pack and label evidence is ready", () => {
    expect(reviewWarehouseEvents(full, EVENT_SCOPE)).toEqual({ valid: true, errors: [], readyForHandoff: true, handedOff: false });
  });
  test("printing a pick list alone is never ready or dispatched", () => {
    const r = reviewWarehouseEvents([event(1, "PICK_LIST_PRINTED")], EVENT_SCOPE);
    expect(r.valid).toBe(true);
    expect(r.readyForHandoff).toBe(false);
  });
  test("packing before picking is invalid", () => {
    const r = reviewWarehouseEvents([event(1, "PICKING_STARTED"), event(2, "PACKING_CHECKED"), event(3, "PICKING_COMPLETED"), event(4, "CARRIER_LABEL_VERIFIED", { evidenceRef: "l" })], EVENT_SCOPE);
    expect(r.errors).toContain("PACKING_BEFORE_PICKING");
    expect(r.readyForHandoff).toBe(false);
  });
  test("label without evidence is invalid", () => {
    const r = reviewWarehouseEvents([...full.slice(0, 4), event(5, "CARRIER_LABEL_VERIFIED")], EVENT_SCOPE);
    expect(r.errors).toContain("MISSING_EVIDENCE");
    expect(r.readyForHandoff).toBe(false);
  });
  test("out-of-order timestamps and cross-scope events are invalid", () => {
    const r = reviewWarehouseEvents([event(5, "PICKING_STARTED"), event(1, "PICKING_COMPLETED", { orderId: "o-2" })], EVENT_SCOPE);
    expect(r.errors).toEqual(expect.arrayContaining(["OUT_OF_ORDER_EVENTS", "CROSS_SCOPE_EVENT"]));
  });
  test("after handoff is recorded the order is no longer 'ready'", () => {
    const r = reviewWarehouseEvents([...full, event(6, "HANDOFF_RECORDED", { evidenceRef: "carrier-receipt" })], EVENT_SCOPE);
    expect(r.valid).toBe(true);
    expect(r.readyForHandoff).toBe(false);
    expect(r.handedOff).toBe(true);
  });
});

describe("simulated pick list never implies dispatch", () => {
  const batch = planWarehouseBatch([order("p1"), order("p2", { organizationId: "org-B" })], SCOPE);
  const html = renderToStaticMarkup(createElement(WarehouseBatchPrint, { batch, accountName: "حساب تجريبي", onClose: () => {} }));
  test("rendered batch carries the not-a-shipping-label disclaimer", () => {
    expect(html).toContain("ليس ملصق شحن");
    expect(html).toContain("SKU-1");
  });
  test("planning and printing produce no handoff evidence", () => {
    expect(reviewWarehouseEvents([event(1, "PICK_LIST_PRINTED")], EVENT_SCOPE).readyForHandoff).toBe(false);
    expect(batch.eligible.every(o => o.status === "placed")).toBe(true);
  });
});
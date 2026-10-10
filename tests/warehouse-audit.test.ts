import { describe, expect, test } from "bun:test";
import { reviewWarehouseEvents, type WarehouseEvent } from "../src/lib/warehouse-audit";
const scope = { orgId: "company-1", channelId: "bol-A", orderId: "order-1" };
const event = (kind: WarehouseEvent["kind"], suffix: string): WarehouseEvent => ({
  eventId: suffix, ...scope, actorUserId: "warehouse-user-1",
  kind, recordedAt: "2026-10-10T12:00:00Z",
  ...(kind === "CARRIER_LABEL_VERIFIED" || kind === "HANDOFF_RECORDED" ? { evidenceRef: "official-doc-1" } : {})
});
describe("warehouse audit prerequisites", () => {
  test("print event alone never permits dispatch", () => {
    const r=reviewWarehouseEvents([event("PICK_LIST_PRINTED","1")],scope);
    expect(r.valid).toBe(true); expect(r.readyForHandoff).toBe(false);
  });
  test("picking, packing, and verified label permits handoff readiness", () => {
    const r=reviewWarehouseEvents([event("PICKING_COMPLETED","1"),event("PACKING_CHECKED","2"),event("CARRIER_LABEL_VERIFIED","3")],scope);
    expect(r.readyForHandoff).toBe(true);
  });
  test("cross-account or missing actor is invalid", () => {
    const other={...event("PICKING_COMPLETED","1"),channelId:"bol-B",actorUserId:""};
    expect(reviewWarehouseEvents([other],scope).valid).toBe(false);
  });
  test("duplicate event and missing carrier evidence fail closed", () => {
    const a=event("PACKING_CHECKED","1");
    expect(reviewWarehouseEvents([a,a],scope).valid).toBe(false);
    expect(reviewWarehouseEvents([{...event("CARRIER_LABEL_VERIFIED","2"),evidenceRef:""}],scope).valid).toBe(false);
  });
});

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
    const r=reviewWarehouseEvents([event("PICKING_STARTED","0"),event("PICKING_COMPLETED","1"),event("PACKING_CHECKED","2"),event("CARRIER_LABEL_VERIFIED","3")],scope);
    expect(r.readyForHandoff).toBe(true);
  });
  test("rejects handoff before verification and duplicate handoff", () => {
    const premature = reviewWarehouseEvents([event("HANDOFF_RECORDED","1")], scope);
    expect(premature.valid).toBe(false);
    const events = [event("PICKING_STARTED","1"),event("PICKING_COMPLETED","2"),event("PACKING_CHECKED","3"),event("CARRIER_LABEL_VERIFIED","4"),event("HANDOFF_RECORDED","5")];
    expect(reviewWarehouseEvents(events, scope).readyForHandoff).toBe(false);
    expect(reviewWarehouseEvents([...events,event("HANDOFF_RECORDED","6")], scope).valid).toBe(false);
  });
  test("requires picking started before picking completed", () => {
    const r=reviewWarehouseEvents([event("PICKING_COMPLETED","1"),event("PACKING_CHECKED","2"),event("CARRIER_LABEL_VERIFIED","3")],scope);
    expect(r.valid).toBe(false);
  });
  test("cross-account or missing actor is invalid", () => {
    const other={...event("PICKING_COMPLETED","1"),channelId:"bol-B",actorUserId:""};
    expect(reviewWarehouseEvents([other],scope).valid).toBe(false);
  });
  test("repeating a picking milestone with a new event ID is invalid", () => {
    const r = reviewWarehouseEvents([
      event("PICKING_STARTED","1"), event("PICKING_STARTED","2"),
      event("PICKING_COMPLETED","3"), event("PACKING_CHECKED","4"),
      event("CARRIER_LABEL_VERIFIED","5")
    ], scope);
    expect(r.valid).toBe(false);
    expect(r.readyForHandoff).toBe(false);
    expect(r.errors).toContain("DUPLICATE_WORKFLOW_STEP");
  });
  test("repeating carrier verification with another ID is invalid", () => {
    const r = reviewWarehouseEvents([
      event("PICKING_STARTED","1"), event("PICKING_COMPLETED","2"),
      event("PACKING_CHECKED","3"), event("CARRIER_LABEL_VERIFIED","4"),
      event("CARRIER_LABEL_VERIFIED","5")
    ], scope);
    expect(r.valid).toBe(false);
    expect(r.readyForHandoff).toBe(false);
    expect(r.errors).toContain("DUPLICATE_WORKFLOW_STEP");
  });
  test("reprinting a pick list is allowed without claiming shipment", () => {
    const r = reviewWarehouseEvents([
      event("PICK_LIST_PRINTED","1"), event("PICK_LIST_PRINTED","2")
    ], scope);
    expect(r.valid).toBe(true);
    expect(r.readyForHandoff).toBe(false);
  });
  test("distinguishes handoff readiness from an evidenced completed handoff", () => {
    const checked = [
      event("PICKING_STARTED","1"), event("PICKING_COMPLETED","2"),
      event("PACKING_CHECKED","3"), event("CARRIER_LABEL_VERIFIED","4")
    ];
    const ready = reviewWarehouseEvents(checked, scope);
    expect(ready).toMatchObject({ valid: true, readyForHandoff: true, handedOff: false });
    const handedOff = reviewWarehouseEvents([...checked, event("HANDOFF_RECORDED","5")], scope);
    expect(handedOff).toMatchObject({ valid: true, readyForHandoff: false, handedOff: true });
    const duplicate = reviewWarehouseEvents([...checked, event("HANDOFF_RECORDED","5"), event("HANDOFF_RECORDED","6")], scope);
    expect(duplicate).toMatchObject({ valid: false, readyForHandoff: false, handedOff: false });
  });
  test("handoff with missing evidence cannot be marked completed", () => {
    const events = [
      event("PICKING_STARTED","1"), event("PICKING_COMPLETED","2"),
      event("PACKING_CHECKED","3"), event("CARRIER_LABEL_VERIFIED","4"),
      { ...event("HANDOFF_RECORDED","5"), evidenceRef: "" }
    ];
    expect(reviewWarehouseEvents(events, scope).handedOff).toBe(false);
  });
  test("duplicate event and missing carrier evidence fail closed", () => {
    const a=event("PACKING_CHECKED","1");
    expect(reviewWarehouseEvents([a,a],scope).valid).toBe(false);
    expect(reviewWarehouseEvents([{...event("CARRIER_LABEL_VERIFIED","2"),evidenceRef:""}],scope).valid).toBe(false);
  });
});

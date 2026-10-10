/** Warehouse audit event contract. Records are append-only and server-authored.
 * This pure validator does NOT persist events or verify identity: server auth and RLS are required.
 */
export type WarehouseEventKind = "PICK_LIST_PRINTED" | "PICKING_STARTED" | "PICKING_COMPLETED" | "PACKING_CHECKED" | "CARRIER_LABEL_VERIFIED" | "HANDOFF_RECORDED";
export type WarehouseEvent = {
  eventId: string;
  orgId: string;
  channelId: string;
  orderId: string;
  actorUserId: string;
  kind: WarehouseEventKind;
  recordedAt: string;
  evidenceRef?: string;
};
export type WarehouseReview = { valid: boolean; errors: string[]; readyForHandoff: boolean };
const kinds: WarehouseEventKind[] = ["PICK_LIST_PRINTED","PICKING_STARTED","PICKING_COMPLETED","PACKING_CHECKED","CARRIER_LABEL_VERIFIED","HANDOFF_RECORDED"];
export function reviewWarehouseEvents(events: WarehouseEvent[], scope: { orgId: string; channelId: string; orderId: string }): WarehouseReview {
  const errors: string[] = [];
  if (!scope.orgId || !scope.channelId || !scope.orderId) return { valid: false, errors: ["MISSING_SCOPE"], readyForHandoff: false };
  const ids = new Set<string>(), done = new Set<WarehouseEventKind>();
  for (const e of events) {
    if (!e.eventId || ids.has(e.eventId)) errors.push("DUPLICATE_OR_MISSING_EVENT_ID");
    ids.add(e.eventId);
    if (e.orgId !== scope.orgId || e.channelId !== scope.channelId || e.orderId !== scope.orderId) errors.push("CROSS_SCOPE_EVENT");
    if (!e.actorUserId) errors.push("MISSING_ACTOR");
    if (!Number.isFinite(Date.parse(e.recordedAt))) errors.push("INVALID_TIMESTAMP");
    if (!kinds.includes(e.kind)) errors.push("UNKNOWN_EVENT");
    if ((e.kind === "CARRIER_LABEL_VERIFIED" || e.kind === "HANDOFF_RECORDED") && !e.evidenceRef?.trim()) errors.push("MISSING_EVIDENCE");
    done.add(e.kind);
  }
  const valid = errors.length === 0;
  // Printing alone never represents packing, dispatch, or official shipment.
  return { valid, errors, readyForHandoff: valid && done.has("PICKING_COMPLETED") && done.has("PACKING_CHECKED") && done.has("CARRIER_LABEL_VERIFIED") };
}

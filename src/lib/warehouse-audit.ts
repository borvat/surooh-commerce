/** Warehouse audit event contract. Records are append-only and server-authored.
 * This pure validator does NOT persist events or verify identity: server auth and RLS are required.
 */
export type WarehouseEventKind =
  | "PICK_LIST_PRINTED"
  | "PICKING_STARTED"
  | "PICKING_COMPLETED"
  | "PACKING_CHECKED"
  | "CARRIER_LABEL_VERIFIED"
  | "HANDOFF_RECORDED";
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
export type WarehouseReview = {
  valid: boolean;
  errors: string[];
  readyForHandoff: boolean;
  handedOff: boolean;
};
const kinds: WarehouseEventKind[] = [
  "PICK_LIST_PRINTED",
  "PICKING_STARTED",
  "PICKING_COMPLETED",
  "PACKING_CHECKED",
  "CARRIER_LABEL_VERIFIED",
  "HANDOFF_RECORDED",
];
export function reviewWarehouseEvents(
  events: WarehouseEvent[],
  scope: { orgId: string; channelId: string; orderId: string },
): WarehouseReview {
  const errors: string[] = [];
  if (!scope.orgId || !scope.channelId || !scope.orderId)
    return { valid: false, errors: ["MISSING_SCOPE"], readyForHandoff: false, handedOff: false };
  const ids = new Set<string>(),
    done = new Set<WarehouseEventKind>();
  let latestTime = -Infinity;
  let handoffSeen = false;
  for (const e of events) {
    if (!e.eventId || ids.has(e.eventId)) errors.push("DUPLICATE_OR_MISSING_EVENT_ID");
    ids.add(e.eventId);
    if (e.orgId !== scope.orgId || e.channelId !== scope.channelId || e.orderId !== scope.orderId)
      errors.push("CROSS_SCOPE_EVENT");
    if (!e.actorUserId) errors.push("MISSING_ACTOR");
    const time = Date.parse(e.recordedAt);
    if (!Number.isFinite(time)) errors.push("INVALID_TIMESTAMP");
    else if (time < latestTime) errors.push("OUT_OF_ORDER_EVENTS");
    else latestTime = time;
    if (!kinds.includes(e.kind)) errors.push("UNKNOWN_EVENT");
    if (
      (e.kind === "CARRIER_LABEL_VERIFIED" || e.kind === "HANDOFF_RECORDED") &&
      !e.evidenceRef?.trim()
    )
      errors.push("MISSING_EVIDENCE");
    if (handoffSeen) errors.push("EVENT_AFTER_HANDOFF");
    // Each workflow milestone is unique; only pick-list reprints may repeat.
    if (e.kind !== "PICK_LIST_PRINTED" && done.has(e.kind)) errors.push("DUPLICATE_WORKFLOW_STEP");
    if (e.kind === "HANDOFF_RECORDED") {
      if (
        !done.has("PICKING_COMPLETED") ||
        !done.has("PACKING_CHECKED") ||
        !done.has("CARRIER_LABEL_VERIFIED")
      )
        errors.push("HANDOFF_BEFORE_CHECKS");
      handoffSeen = true;
    }
    if (e.kind === "PACKING_CHECKED" && !done.has("PICKING_COMPLETED"))
      errors.push("PACKING_BEFORE_PICKING");
    if (e.kind === "PICKING_COMPLETED" && !done.has("PICKING_STARTED"))
      errors.push("PICKING_WITHOUT_START");
    done.add(e.kind);
  }
  const valid = errors.length === 0;
  // Printing alone never represents packing, dispatch, or official shipment.
  return {
    valid,
    errors,
    readyForHandoff:
      valid &&
      !handoffSeen &&
      done.has("PICKING_COMPLETED") &&
      done.has("PACKING_CHECKED") &&
      done.has("CARRIER_LABEL_VERIFIED"),
    handedOff: valid && handoffSeen,
  };
}

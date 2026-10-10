/** Pure warehouse batch planner. No label purchase, fulfillment, or inventory writes. */
export type PickLine = { sku: string; quantity: number; fulfillment: "FBR" | "FBB" };
export type PickOrder = {
  id: string;
  organizationId: string;
  channelId: string;
  externalOrderId: string;
  status: "placed" | "fulfilled" | "cancelled";
  lines: PickLine[];
};
export type PickBatchResult = {
  /** Copies of eligible orders containing ONLY FBR lines. Inputs are never mutated. */
  eligible: PickOrder[];
  rejected: { id: string; reason: string }[];
  totals: { orders: number; pieces: number; distinctSku: number };
  skuTotals: { sku: string; pieces: number }[];
};
export function planWarehouseBatch(
  orders: PickOrder[],
  authorizedScope: { organizationId: string; channelId: string }
): PickBatchResult {
  if (!authorizedScope.organizationId || !authorizedScope.channelId) throw new Error("Missing authorized scope");
  const inScope = (o: PickOrder) =>
    o.organizationId === authorizedScope.organizationId && o.channelId === authorizedScope.channelId;
  const externalKey = (o: PickOrder) => (typeof o.externalOrderId === "string" ? o.externalOrderId.trim() : "");
  // Fail closed on ambiguity: count every in-scope submission per external ID (eligible or not)
  // and reject ALL occurrences when an ID appears more than once, instead of picking one.
  const occurrences = new Map<string, number>();
  for (const o of orders) {
    const key = externalKey(o);
    if (key && inScope(o)) occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  const eligible: PickOrder[] = [], rejected: PickBatchResult["rejected"] = [];
  const sku = new Map<string, number>();
  for (const order of orders) {
    let reason = "";
    if (!order.id?.trim() || !externalKey(order)) reason = "MISSING_ORDER_ID";
    else if (!inScope(order)) reason = "UNAUTHORIZED_SCOPE";
    else if ((occurrences.get(externalKey(order)) ?? 0) > 1) reason = "DUPLICATE_ORDER";
    else if (order.status !== "placed") reason = "NOT_OPEN";
    else if (!order.lines.some(l => l.fulfillment === "FBR")) reason = "NO_WAREHOUSE_ITEMS";
    else if (order.lines.some(l => !l.sku.trim() || !Number.isSafeInteger(l.quantity) || l.quantity < 1)) reason = "INVALID_LINE";
    if (reason) { rejected.push({ id: order.id, reason }); continue; }
    const fbrLines = order.lines.filter(l => l.fulfillment === "FBR").map(l => ({ ...l }));
    eligible.push({ ...order, lines: fbrLines });
    for (const line of fbrLines) {
      const next = (sku.get(line.sku) ?? 0) + line.quantity;
      if (!Number.isSafeInteger(next)) throw new Error("Unsafe warehouse SKU total");
      sku.set(line.sku, next);
    }
  }
  const skuTotals = [...sku].map(([sku, pieces]) => ({ sku, pieces })).sort((a,b) => a.sku.localeCompare(b.sku));
  const pieces = skuTotals.reduce((n,v) => {
    const next = n + v.pieces;
    if (!Number.isSafeInteger(next)) throw new Error("Unsafe warehouse batch total");
    return next;
  }, 0);
  return { eligible, rejected, skuTotals,
    totals: { orders: eligible.length, pieces, distinctSku: skuTotals.length } };
}
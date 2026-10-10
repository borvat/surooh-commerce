/** Pure warehouse batch planner. No label purchase, fulfillment, or inventory writes. */
export type PickOrder = {
  id: string;
  organizationId: string;
  channelId: string;
  externalOrderId: string;
  status: "placed" | "fulfilled" | "cancelled";
  lines: { sku: string; quantity: number; fulfillment: "FBR" | "FBB" }[];
};
export type PickBatchResult = {
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
  const eligible: PickOrder[] = [], rejected: PickBatchResult["rejected"] = [];
  const seen = new Set<string>(), sku = new Map<string, number>();
  for (const order of orders) {
    const key = [order.organizationId, order.channelId, order.externalOrderId].join("|");
    let reason = "";
    if (!order.id || !order.externalOrderId) reason = "MISSING_ORDER_ID";
    else if (order.organizationId !== authorizedScope.organizationId || order.channelId !== authorizedScope.channelId) reason = "UNAUTHORIZED_SCOPE";
    else if (seen.has(key)) reason = "DUPLICATE_ORDER";
    else if (order.status !== "placed") reason = "NOT_OPEN";
    else if (!order.lines.some(l => l.fulfillment === "FBR")) reason = "NO_WAREHOUSE_ITEMS";
    else if (order.lines.some(l => !l.sku.trim() || !Number.isSafeInteger(l.quantity) || l.quantity < 1)) reason = "INVALID_LINE";
    if (reason) { rejected.push({ id: order.id, reason }); continue; }
    seen.add(key); eligible.push(order);
    for (const line of order.lines) if (line.fulfillment === "FBR") sku.set(line.sku, (sku.get(line.sku) ?? 0) + line.quantity);
  }
  const skuTotals = [...sku].map(([sku, pieces]) => ({ sku, pieces })).sort((a,b) => a.sku.localeCompare(b.sku));
  return { eligible, rejected, skuTotals,
    totals: { orders: eligible.length, pieces: skuTotals.reduce((n,v) => n+v.pieces, 0), distinctSku: skuTotals.length } };
}

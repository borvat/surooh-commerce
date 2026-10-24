import type { NativeSnapshot } from "./native-projection";
import type { LocationStock } from "./native-stock-operations";

/** Read-only metrics over native documents; no independent counters or balances. */
export function nativeDashboardMetrics(snapshot: NativeSnapshot, locations: LocationStock) {
  if (snapshot.company !== locations.company) throw new Error("Dashboard company mismatch");
  const pending = snapshot.orders.filter(
    (order) => order.status === "placed" && !order.remainder_closed,
  );
  let awaitingPick = 0,
    awaitingPack = 0,
    readyToShip = 0;
  for (const order of pending) {
    if (order.shipment_batches?.length) {
      const active = order.shipment_batches.filter((batch) => !batch.cancelled && !batch.shipped);
      awaitingPack += active.filter((batch) => !batch.packing_slip).length;
      readyToShip += active.filter((batch) => !!batch.packing_slip).length;
      if (!active.length && (order.shipment_plan?.remaining_units ?? 0) > 0) awaitingPick++;
    } else if (!order.pick_list && !order.delivery_note) awaitingPick++;
    else if (order.pick_list && !order.packing_slip && !order.delivery_note) awaitingPack++;
    else if (order.packing_slip && !order.delivery_note) readyToShip++;
  }
  const quarantine = new Set(
    locations.locations
      .filter((location) => location.is_rejected_warehouse)
      .map((location) => location.name),
  );
  return {
    pending_orders: pending.length,
    awaiting_pick: awaitingPick,
    awaiting_pack: awaitingPack,
    ready_to_ship: readyToShip,
    closed_remainders: snapshot.orders.filter((order) => order.remainder_closed).length,
    stock_skus: snapshot.items.filter((item) => item.stock).length,
    zero_available_skus: snapshot.items.filter(
      (item) => item.stock && item.physical - item.reserved <= 0,
    ).length,
    quarantine_skus: new Set(
      locations.bins
        .filter((bin) => quarantine.has(bin.warehouse) && bin.actual_qty > 0)
        .map((bin) => bin.item_code),
    ).size,
    inventory_value: locations.bins.reduce((sum, bin) => sum + bin.stock_value, 0),
  };
}

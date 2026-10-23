import { nativeLabCommand } from "./native-lab-client";
import type { NativeOrder } from "./native-projection";

export function shipmentRequest(order: NativeOrder, units: number, batchId: string) {
  const plan = order.shipment_plan;
  if (
    order.status !== "placed" ||
    order.remainder_closed ||
    !plan ||
    !Number.isSafeInteger(units) ||
    units < 1 ||
    units > plan.remaining_units ||
    order.shipment_batches?.some((batch) => !batch.shipped && !batch.cancelled) ||
    (!order.shipment_batches?.length && !!order.pick_list)
  )
    throw new Error("حدّث الطلب واختر كمية صالحة من الدفعة المتبقية.");
  return {
    order_id: order.id,
    batch_id: batchId,
    units,
    expected_picks: (order.shipment_batches ?? []).map((batch) => batch.pick_list).sort(),
  };
}

export function pickShipment(payload: ReturnType<typeof shipmentRequest>, requestId: string) {
  return nativeLabCommand("batch_pick", payload, requestId);
}

export function shipmentAction(
  operation: "batch_pack" | "batch_ship" | "batch_cancel",
  orderId: string,
  pickList: string,
) {
  return nativeLabCommand(
    operation,
    { order_id: orderId, pick_list: pickList },
    `${operation}:${pickList}`,
  );
}

/** Freeze this payload and its request ID until the result is known. */
export function remainderCloseRequest(order: NativeOrder, reason: string) {
  const batches = order.shipment_batches ?? [];
  if (
    order.status !== "placed" ||
    order.remainder_closed ||
    !order.shipment_plan ||
    order.shipment_plan.remaining_units < 1 ||
    !batches.some((batch) => batch.shipped) ||
    batches.some((batch) => !batch.shipped && !batch.cancelled) ||
    reason !== reason.trim() ||
    reason.length < 3 ||
    reason.length > 500
  )
    throw new Error("حدّث الطلب وألغِ تجهيز الدفعة النشطة، ثم أدخل سبب إغلاق الباقي.");
  return {
    order_id: order.id,
    expected_picks: batches.map((batch) => batch.pick_list).sort(),
    expected_remaining_units: order.shipment_plan.remaining_units,
    reason,
  };
}

export function closeRemainder(
  payload: ReturnType<typeof remainderCloseRequest>,
  requestId: string,
) {
  return nativeLabCommand("close_remainder", payload, requestId);
}

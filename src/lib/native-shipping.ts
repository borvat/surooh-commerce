import { nativeLabCommand } from "./native-lab-client";
import type { NativeOrder } from "./native-projection";

export function shipmentRequest(order: NativeOrder, units: number, batchId: string) {
  const plan = order.shipment_plan;
  if (
    order.status !== "placed" ||
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

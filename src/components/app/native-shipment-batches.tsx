import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { NativeOrder } from "@/lib/native-projection";
import {
  closeRemainder,
  pickShipment,
  remainderCloseRequest,
  shipmentAction,
  shipmentRequest,
} from "@/lib/native-shipping";
import { quarantineReturn, stockLocations } from "@/lib/native-stock-operations";

export function NativeShipmentBatches({
  order,
  refreshing,
}: {
  order: NativeOrder;
  refreshing: boolean;
}) {
  const qc = useQueryClient();
  const [units, setUnits] = useState(1);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const closing = useRef<{
    payload: ReturnType<typeof remainderCloseRequest>;
    request: string;
  } | null>(null);
  const sent = useRef<{ payload: ReturnType<typeof shipmentRequest>; request: string } | null>(
    null,
  );
  const returns = useRef(new Map<string, string>());
  const locations = useQuery({ queryKey: ["native-locations"], queryFn: stockLocations });
  const mutation = useMutation({
    mutationFn: async (action: {
      kind: "pick" | "close" | "batch_pack" | "batch_ship" | "batch_cancel" | "return";
      id?: string;
    }) => {
      if (closing.current && !order.remainder_closed && action.kind !== "close")
        throw new Error("تحقق من نتيجة الإغلاق بإعادة محاولة نفس الإجراء أولاً.");
      if (action.kind === "pick") {
        sent.current ??= {
          payload: shipmentRequest(order, units, crypto.randomUUID()),
          request: `batch:${crypto.randomUUID()}`,
        };
        return pickShipment(sent.current.payload, sent.current.request);
      }
      if (action.kind === "close") {
        closing.current ??= {
          payload: remainderCloseRequest(order, reason),
          request: `close:${crypto.randomUUID()}`,
        };
        return closeRemainder(closing.current.payload, closing.current.request);
      }
      if (!action.id) throw new Error("مستند الدفعة مطلوب.");
      if (action.kind === "return") {
        if (!returns.current.has(action.id)) returns.current.set(action.id, target);
        return quarantineReturn(action.id, returns.current.get(action.id)!);
      }
      return shipmentAction(action.kind, order.id, action.id);
    },
    onSuccess: () => {
      sent.current = null;
      closing.current = null;
      qc.invalidateQueries();
    },
    onError: (error) => {
      qc.invalidateQueries({ queryKey: ["native-progress"] });
      toast.error(error.message);
    },
  });
  const batches = order.shipment_batches ?? [];
  const active = batches.some((batch) => !batch.shipped && !batch.cancelled);
  const frozen = !!sent.current;
  const closeFrozen = !!closing.current && !order.remainder_closed;
  const disabled = refreshing || mutation.isPending;
  return (
    <div className="space-y-2 rounded border p-2 text-xs" data-native-batches={order.id}>
      <p>
        دفعات شحن متناسبة · كل وحدة تشمل{" "}
        {order.shipment_plan?.lines.map((line) => `${line.quantity} × ${line.item}`).join("، ")}
      </p>
      <p>الوحدات المتبقية: {order.shipment_plan?.remaining_units ?? "تحتاج مراجعة"}</p>
      {order.remainder_closed && (
        <p role="status">أُغلق باقي الطلب وتحرر حجزه. الشحنات السابقة محفوظة.</p>
      )}
      {batches.map((batch) => (
        <div key={batch.pick_list} className="flex flex-wrap items-center gap-2">
          <span>
            {batch.pick_list} ·{" "}
            {batch.cancelled
              ? "ألغيت الدفعة"
              : batch.shipped
                ? "تم الشحن"
                : batch.packing_slip
                  ? "معبأة"
                  : "مجهزة"}
          </span>
          <span>{batch.delivery_note}</span>
          {!order.remainder_closed && !batch.shipped && !batch.cancelled && (
            <Button
              size="sm"
              disabled={disabled}
              onClick={() =>
                mutation.mutate({
                  kind: batch.packing_slip ? "batch_ship" : "batch_pack",
                  id: batch.pick_list,
                })
              }
            >
              {batch.packing_slip ? "شحن الدفعة" : "تعبئة الدفعة"}
            </Button>
          )}
          {!order.remainder_closed && !batch.shipped && !batch.cancelled && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => mutation.mutate({ kind: "batch_cancel", id: batch.pick_list })}
            >
              إلغاء تجهيز الدفعة
            </Button>
          )}
          {batch.return_note ? (
            <span>مرتجع مستلم · {batch.return_note}</span>
          ) : (
            batch.shipped && (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || closeFrozen || !target || locations.isFetching || locations.isError}
                onClick={() => mutation.mutate({ kind: "return", id: batch.delivery_note! })}
              >
                مرتجع هذه الشحنة
              </Button>
            )
          )}
        </div>
      ))}
      {batches.some((batch) => batch.shipped && !batch.return_note) && (
        <label>
          موقع حجر المرتجع
          <select
            aria-label="موقع حجر مرتجع الدفعة"
            value={target}
            disabled={disabled}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">اختر موقع الحجر</option>
            {locations.data?.locations
              .filter((row) => row.is_rejected_warehouse)
              .map((row) => (
                <option key={row.name} value={row.name}>
                  {row.warehouse_name}
                </option>
              ))}
          </select>
          {locations.isError && (
            <Button
              size="sm"
              variant="outline"
              disabled={locations.isFetching}
              onClick={() => locations.refetch()}
            >
              إعادة تحميل المواقع
            </Button>
          )}
        </label>
      )}
      {!order.remainder_closed && !active && (order.shipment_plan?.remaining_units ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <label>
            وحدات هذه الدفعة{" "}
            <input
              aria-label="وحدات دفعة الشحن"
              type="number"
              min={1}
              max={order.shipment_plan?.remaining_units}
              value={units}
              className="w-16 rounded border p-1"
              disabled={disabled || frozen || closeFrozen}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
          </label>
          <Button
            size="sm"
            disabled={
              disabled ||
              closeFrozen ||
              !Number.isSafeInteger(units) ||
              units < 1 ||
              units > (order.shipment_plan?.remaining_units ?? 0)
            }
            onClick={() => mutation.mutate({ kind: "pick" })}
          >
            {frozen ? "إعادة محاولة نفس الدفعة" : "تجهيز دفعة"}
          </Button>
        </div>
      )}
      {!order.remainder_closed &&
        !active &&
        (order.shipment_plan?.remaining_units ?? 0) > 0 &&
        batches.some((batch) => batch.shipped) && (
          <div className="flex flex-wrap items-center gap-2">
            <label>
              سبب إغلاق باقي الطلب
              <input
                aria-label="سبب إغلاق باقي الطلب"
                value={reason}
                maxLength={500}
                disabled={disabled || closeFrozen || frozen}
                className="rounded border p-1"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={
                disabled ||
                frozen ||
                reason !== reason.trim() ||
                reason.length < 3 ||
                reason.length > 500
              }
              onClick={() => mutation.mutate({ kind: "close" })}
            >
              {closeFrozen ? "إعادة محاولة نفس الإغلاق" : "إغلاق الباقي وتحرير الحجز"}
            </Button>
          </div>
        )}
      {active && !order.remainder_closed && (
        <p>اشحن الدفعة الحالية أو ألغِ تجهيزها قبل تجهيز دفعة أخرى أو إغلاق الباقي.</p>
      )}
    </div>
  );
}

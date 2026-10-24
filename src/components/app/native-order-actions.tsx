/** Synthetic native actions used by the existing orders screen; no legacy writes. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { nativeOrderAction } from "@/lib/native-lab-client";
import { stockLocations, quarantineReturn } from "@/lib/native-stock-operations";
import { useRef, useState } from "react";
import { nativeSnapshot } from "@/lib/native-projection";
import { NativeShipmentBatches } from "./native-shipment-batches";
import { NativeScannerPick } from "./native-scanner-pick";

export function NativeOrderActions({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["native-progress"], queryFn: nativeSnapshot });
  const order = query.data?.orders.find((x) => x.id === orderId);
  const [quarantine, setQuarantine] = useState("");
  const returnTarget = useRef<string | null>(null);
  const locations = useQuery({
    queryKey: ["native-locations"],
    queryFn: stockLocations,
    enabled: !!order?.delivery_note && !order.return_note,
  });
  const mutation = useMutation({
    mutationFn: (operation: string) => {
      if (operation !== "return")
        return nativeOrderAction(operation, orderId, order?.delivery_note);
      returnTarget.current ??= quarantine;
      return quarantineReturn(order?.delivery_note ?? "", returnTarget.current);
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (error) => {
      // A lost response is not proof of rollback. Re-read before offering another transition.
      qc.invalidateQueries({ queryKey: ["native-progress"] });
      toast.error(error.message);
    },
  });
  if (query.isError)
    return (
      <div role="alert" className="flex items-center gap-2 text-sm">
        <span>تعذّر تحديث حالة الطلب.</span>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          إعادة المحاولة
        </Button>
      </div>
    );
  if (!order || order.status === "cancelled") return null;
  if (order.shipment_batches?.length)
    return <NativeShipmentBatches order={order} refreshing={query.isFetching} />;
  if (order.remainder_closed) return <span className="text-xs">أُغلق باقي الطلب وتحرر حجزه.</span>;
  if (order.return_note)
    return <span className="text-xs">تم استلام المرتجع · {order.return_note}</span>;
  const next = order.delivery_note
    ? "return"
    : order.packing_slip
      ? "ship"
      : order.pick_list
        ? "pack"
        : "pick";
  const labels: Record<string, string> = {
    pick: "تجهيز",
    pack: "تعبئة",
    ship: "شحن",
    return: "مرتجع",
  };
  return (
    <div className="flex gap-1" data-native-order={orderId}>
      {next === "pick" && (order.shipment_plan?.total_units ?? 0) > 1 && (
        <NativeShipmentBatches order={order} refreshing={query.isFetching || mutation.isPending} />
      )}
      {next === "pick" && query.data && (
        <NativeScannerPick
          snapshot={query.data}
          orderId={orderId}
          disabled={mutation.isPending || query.isFetching}
        />
      )}
      {next === "return" && (
        <label className="text-xs">
          موقع حجر المرتجع
          <select
            aria-label="موقع حجر المرتجع"
            value={quarantine}
            disabled={
              mutation.isPending ||
              mutation.isError ||
              mutation.isSuccess ||
              locations.isFetching ||
              locations.isError
            }
            onChange={(e) => setQuarantine(e.target.value)}
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
          {locations.isError && <span role="alert">تعذّر تحديث المواقع</span>}
          {locations.isSuccess &&
            !locations.data.locations.some((row) => row.is_rejected_warehouse) && (
              <span>أضف موقع حجر من شاشة المخزون أولاً.</span>
            )}
        </label>
      )}
      {next === "return" && locations.isError && (
        <Button
          size="sm"
          variant="outline"
          disabled={locations.isFetching}
          onClick={() => locations.refetch()}
        >
          تحديث المواقع
        </Button>
      )}
      <Button
        size="sm"
        disabled={
          mutation.isPending ||
          query.isFetching ||
          (next === "return" && (!quarantine || locations.isFetching || locations.isError))
        }
        onClick={() => mutation.mutate(next)}
      >
        {labels[next]}
      </Button>
      {!order.delivery_note && (
        <Button
          size="sm"
          variant="ghost"
          disabled={mutation.isPending || query.isFetching}
          onClick={() => mutation.mutate("cancel")}
        >
          إلغاء
        </Button>
      )}
    </div>
  );
}

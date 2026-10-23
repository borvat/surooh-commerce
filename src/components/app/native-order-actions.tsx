/** Synthetic native actions used by the existing orders screen; no legacy writes. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { nativeOrderAction } from "@/lib/native-lab-client";
import { nativeSnapshot } from "@/lib/native-projection";

export function NativeOrderActions({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["native-progress"], queryFn: nativeSnapshot });
  const order = query.data?.orders.find((x) => x.id === orderId);
  const mutation = useMutation({
    mutationFn: (operation: string) => nativeOrderAction(operation, orderId, order?.delivery_note),
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
      <Button
        size="sm"
        disabled={mutation.isPending || query.isFetching}
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

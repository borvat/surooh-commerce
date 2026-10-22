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
    onError: (error) => toast.error(error.message),
  });
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
        disabled={mutation.isPending || query.isError}
        onClick={() => mutation.mutate(next)}
      >
        {labels[next]}
      </Button>
      {!order.delivery_note && (
        <Button
          size="sm"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("cancel")}
        >
          إلغاء
        </Button>
      )}
    </div>
  );
}

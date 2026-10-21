import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  allComponents,
  allProducts,
  errMsg,
  postMovement,
  placeOrder,
  listChannels,
  type MovementType,
} from "@/lib/inventory";

export const selectCls =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function useInvalidateStock() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function MovementDialog({
  open,
  onOpenChange,
  componentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  componentId?: string | undefined;
}) {
  const comps = useQuery({ queryKey: ["components-all"], queryFn: allComponents, enabled: open });
  const inv = useInvalidateStock();
  const [cid, setCid] = useState(componentId ?? "");
  const [type, setType] = useState<MovementType>("receipt");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const m = useMutation({
    mutationFn: () =>
      postMovement({
        componentId: cid || componentId!,
        type,
        quantity: parseInt(qty, 10),
        reason,
        reference: ref,
      }),
    onSuccess: () => {
      toast.success("Stock movement posted");
      inv();
      setQty("");
      setReason("");
      setRef("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post stock movement</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Component">
            <select
              className={selectCls}
              value={cid || componentId || ""}
              onChange={(e) => setCid(e.target.value)}
            >
              <option value="">Select…</option>
              {(comps.data ?? [])
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id!}>
                    {c.sku} — {c.name} (phys {c.physical_qty}, res {c.reserved_qty})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as MovementType)}
            >
              <option value="receipt">Receipt (+)</option>
              <option value="return">Return (+)</option>
              <option value="damaged">Damaged (−)</option>
              <option value="adjustment">Manual adjustment (±)</option>
            </select>
          </Field>
          <Field label={type === "adjustment" ? "Quantity (use negative to reduce)" : "Quantity"}>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Reason (required)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label="Reference (optional)">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={m.isPending || !(cid || componentId) || !qty || !reason.trim()}
            onClick={() => m.mutate()}
          >
            Post movement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const prods = useQuery({ queryKey: ["products-all"], queryFn: allProducts, enabled: open });
  const chans = useQuery({ queryKey: ["channels"], queryFn: listChannels, enabled: open });
  const inv = useInvalidateStock();
  const [lines, setLines] = useState<{ product_id: string; quantity: string; fm: "FBR" | "FBB" }[]>(
    [{ product_id: "", quantity: "1", fm: "FBR" }],
  );
  const [channel, setChannel] = useState("");
  const [ext, setExt] = useState("");
  const m = useMutation({
    mutationFn: () =>
      placeOrder({
        lines: lines
          .filter((l) => l.product_id)
          .map((l) => ({
            product_id: l.product_id,
            quantity: parseInt(l.quantity, 10),
            fulfillment_method: l.fm,
          })),
        channelId: channel,
        externalRef: ext,
      }),
    onSuccess: () => {
      toast.success(
        "Order placed — FBR lines reserved parts; FBB lines left internal stock untouched",
      );
      inv();
      setLines([{ product_id: "", quantity: "1", fm: "FBR" }]);
      setExt("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const active = (prods.data ?? []).filter((p) => p.active);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New test order</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          <b>FBR</b> lines reserve parts from your warehouse. <b>FBB</b> lines are fulfilled by bol
          from bol&apos;s own stock and never touch your internal stock.
        </p>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel">
              <select
                className={selectCls}
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="">Manual / none</option>
                {(chans.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="External reference">
              <Input value={ext} onChange={(e) => setExt(e.target.value)} />
            </Field>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={`Line ${i + 1}`}>
                  <select
                    className={selectCls + " w-full"}
                    value={l.product_id}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)),
                      )
                    }
                  >
                    <option value="">Select product…</option>
                    {active.map((p) => (
                      <option key={p.id} value={p.id!}>
                        {p.sku} — available {p.available_qty}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <select
                title="FBR = you ship from your own stock (reserves parts). FBB = bol ships from its own stock (internal stock untouched)."
                className={selectCls}
                value={l.fm}
                onChange={(e) =>
                  setLines(
                    lines.map((x, j) =>
                      j === i ? { ...x, fm: e.target.value as "FBR" | "FBB" } : x,
                    ),
                  )
                }
              >
                <option value="FBR">FBR · own stock</option>
                <option value="FBB">FBB · bol stock</option>
              </select>
              <Input
                className="h-8 w-20"
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))
                }
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setLines([...lines, { product_id: "", quantity: "1", fm: "FBR" }])}
          >
            Add line
          </Button>
        </div>
        <DialogFooter>
          <Button
            disabled={m.isPending || !lines.some((l) => l.product_id)}
            onClick={() => m.mutate()}
          >
            Place order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

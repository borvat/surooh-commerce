import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, selectCls, useInvalidateStock } from "@/components/app/forms";
import {
  saveProduct,
  getBom,
  setBom,
  allComponents,
  errMsg,
  type ProductRow,
} from "@/lib/inventory";

export function ProductDialog({
  initial,
  onClose,
}: {
  initial: Partial<ProductRow>;
  onClose: () => void;
}) {
  const inv = useInvalidateStock();
  const [f, setF] = useState({
    sku: initial.sku ?? "",
    name: initial.name ?? "",
    ean: initial.ean ?? "",
    product_type: (initial.product_type ?? "BUNDLE") as "SIMPLE" | "BUNDLE",
    active: initial.active ?? true,
  });
  const m = useMutation({
    mutationFn: () =>
      saveProduct({
        id: initial.id ?? undefined,
        sku: f.sku.trim(),
        name: f.name.trim(),
        ean: f.ean.trim() || null,
        product_type: f.product_type,
        active: f.active,
      }),
    onSuccess: () => {
      toast.success("Product saved");
      inv();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial.id ? `Edit ${initial.sku}` : "New sellable product"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} />
          </Field>
          <Field label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="EAN">
            <Input value={f.ean} onChange={(e) => setF({ ...f, ean: e.target.value })} />
          </Field>
          <Field label="Type">
            <select
              className={selectCls}
              value={f.product_type}
              onChange={(e) => setF({ ...f, product_type: e.target.value as "SIMPLE" | "BUNDLE" })}
            >
              <option value="BUNDLE">BUNDLE</option>
              <option value="SIMPLE">SIMPLE (1× one component)</option>
            </select>
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Active
          </label>
        </div>
        <DialogFooter>
          <Button
            disabled={m.isPending || !f.sku.trim() || !f.name.trim()}
            onClick={() => m.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BomDialog({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const inv = useInvalidateStock();
  const comps = useQuery({ queryKey: ["components-all"], queryFn: allComponents });
  const cur = useQuery({ queryKey: ["bom", product.id], queryFn: () => getBom(product.id!) });
  const [lines, setLines] = useState<{ component_id: string; quantity_required: string }[] | null>(
    null,
  );
  const rows =
    lines ??
    (cur.data ?? []).map((l) => ({
      component_id: l.component_id,
      quantity_required: String(l.quantity_required),
    }));
  const m = useMutation({
    mutationFn: () =>
      setBom(
        product.id!,
        rows
          .filter((r) => r.component_id)
          .map((r) => ({
            component_id: r.component_id,
            quantity_required: parseInt(r.quantity_required, 10) || 0,
          })),
      ),
    onSuccess: () => {
      toast.success("BOM saved");
      inv();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>BOM — {product.sku}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <select
                className={selectCls + " flex-1"}
                value={r.component_id}
                onChange={(e) =>
                  setLines(
                    rows.map((x, j) => (j === i ? { ...x, component_id: e.target.value } : x)),
                  )
                }
              >
                <option value="">Select component…</option>
                {(comps.data ?? [])
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id!}>
                      {c.sku} — {c.name}
                    </option>
                  ))}
              </select>
              <Input
                className="h-8 w-20"
                type="number"
                min={1}
                value={r.quantity_required}
                onChange={(e) =>
                  setLines(
                    rows.map((x, j) => (j === i ? { ...x, quantity_required: e.target.value } : x)),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLines(rows.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setLines([...rows, { component_id: "", quantity_required: "1" }])}
          >
            Add component
          </Button>
        </div>
        <DialogFooter>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>
            Save BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

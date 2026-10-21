import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  allComponents,
  allProducts,
  errMsg,
  getBom,
  listChannels,
  placeOrder,
  postMovement,
  saveComponent,
  saveProduct,
  setBom,
  type ComponentRow,
  type ProductRow,
  type FulfillmentMethod,
} from "@/lib/inventory";

export const sel =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
export const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-US");

export function F({
  label,
  help,
  children,
}: {
  label: string;
  help?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

export function Photo({
  name,
  src,
  size = "h-22 w-22",
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ""}
        loading="lazy"
        className={`${size} shrink-0 rounded-lg border bg-white object-contain p-1`}
      />
    );
  }
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-muted text-2xl font-semibold text-muted-foreground`}
      title="لا توجد صورة بعد"
    >
      {(name ?? "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function SharedNote() {
  return (
    <div className="flex gap-2 rounded-lg border border-primary/30 bg-accent/40 p-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        كل هذه المنتجات تسحب من نفس مخزون القطع في المستودع. بيع منتج واحد يغيّر الكمية المتاحة
        لبقية المنتجات تلقائياً — لذلك لا تجمع هذه الأرقام معاً.
      </span>
    </div>
  );
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ---------- Add / edit stock item ----------
export function ItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item?: ComponentRow | null | undefined;
}) {
  const refresh = useRefresh();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [safety, setSafety] = useState("0");
  const [low, setLow] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setSku(item?.sku ?? "");
    setQty("");
    setSafety(String(item?.safety_stock ?? 0));
    setLow(String(item?.low_stock_threshold ?? 0));
    setBarcode(item?.barcode ?? "");
    setActive(item?.active ?? true);
  }, [open, item]);
  const m = useMutation({
    mutationFn: async () => {
      const id = await saveComponent({
        id: item?.id ?? undefined,
        sku: sku.trim() || autoSku(name),
        name: name.trim(),
        barcode: barcode.trim() || null,
        unit_of_measure: item?.unit_of_measure ?? "pcs",
        safety_stock: parseInt(safety || "0", 10),
        low_stock_threshold: parseInt(low || "0", 10),
        active,
      });
      const q = parseInt(qty || "0", 10);
      if (!item && q > 0)
        await postMovement({
          componentId: id,
          type: "receipt",
          quantity: q,
          reason: "الكمية الأولى عند الإضافة",
        });
    },
    onSuccess: () => {
      toast.success(item ? "تم حفظ التغييرات" : "تمت إضافة القطعة");
      refresh();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{item ? "تعديل القطعة" : "إضافة قطعة إلى المستودع"}</DialogTitle>
          <DialogDescription>
            قطعة حقيقية موجودة على رفوفك، مثل: زجاجة غاز، موقد، شعلة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <F label="اسم القطعة">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gas Bottle"
            />
          </F>
          {!item && (
            <F label="كم قطعة لديك الآن؟" help="يمكنك تركها فارغة وإضافة البضاعة لاحقاً.">
              <Input
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="3000"
              />
            </F>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label="كمية احتياطية لا تُباع" help="تبقى في المستودع دائماً.">
              <Input
                type="number"
                min={0}
                value={safety}
                onChange={(e) => setSafety(e.target.value)}
              />
            </F>
            <F label="نبّهني عندما يصل المتاح إلى">
              <Input type="number" min={0} value={low} onChange={(e) => setLow(e.target.value)} />
            </F>
          </div>
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">خيارات إضافية</summary>
            <div className="mt-3 grid gap-3">
              <F label="الرمز الداخلي (SKU)" help="يُنشأ تلقائياً إذا تركته فارغاً.">
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="GAS-001"
                  dir="ltr"
                />
              </F>
              <F label="الباركود (اختياري)">
                <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} dir="ltr" />
              </F>
              {item && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />{" "}
                  قطعة نشطة
                </label>
              )}
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button size="lg" disabled={!name.trim() || m.isPending} onClick={() => m.mutate()}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function autoSku(name: string) {
  const base =
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 16) || "ITEM";
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ---------- Receive / adjust stock ----------
type StockMode = "receive" | "adjust";
export function StockDialog({
  open,
  onOpenChange,
  mode,
  itemId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: StockMode;
  itemId?: string | undefined;
}) {
  const comps = useQuery({ queryKey: ["components-all"], queryFn: allComponents, enabled: open });
  const refresh = useRefresh();
  const [cid, setCid] = useState("");
  const [kind, setKind] = useState<"count" | "damaged" | "return">("count");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setCid(itemId ?? "");
      setQty("");
      setNote("");
      setKind("count");
    }
  }, [open, itemId]);
  const item = (comps.data ?? []).find((c) => c.id === cid);
  const q = parseInt(qty || "0", 10);
  const delta = mode === "adjust" && kind === "count" && item ? q - (item.physical_qty ?? 0) : 0;
  const m = useMutation({
    mutationFn: async () => {
      if (mode === "receive")
        return postMovement({
          componentId: cid,
          type: "receipt",
          quantity: q,
          reason: note || "استلام بضاعة",
        });
      if (kind === "damaged")
        return postMovement({
          componentId: cid,
          type: "damaged",
          quantity: q,
          reason: note || "بضاعة تالفة",
        });
      if (kind === "return")
        return postMovement({
          componentId: cid,
          type: "return",
          quantity: q,
          reason: note || "مرتجع من عميل",
        });
      if (delta === 0) throw new Error("الكمية مطابقة بالفعل، لا يوجد تغيير");
      return postMovement({
        componentId: cid,
        type: "adjustment",
        quantity: delta,
        reason: note || "جرد المستودع",
      });
    },
    onSuccess: () => {
      toast.success("تم تحديث المخزون");
      refresh();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{mode === "receive" ? "استلام بضاعة" : "تعديل المخزون"}</DialogTitle>
          <DialogDescription>
            {mode === "receive"
              ? "وصلتك بضاعة جديدة؟ أضفها هنا."
              : "صحّح الكمية بعد الجرد، أو سجّل قطعاً تالفة أو مرتجعة."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <F label="القطعة">
            <select className={sel} value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">اختر…</option>
              {(comps.data ?? [])
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id!}>
                    {c.name} — في المستودع {n(c.physical_qty)}
                  </option>
                ))}
            </select>
          </F>
          {mode === "adjust" && (
            <F label="ماذا حدث؟">
              <select
                className={sel}
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="count">قمت بالجرد — هذه هي الكمية الصحيحة</option>
                <option value="damaged">قطع تالفة (تُخصم)</option>
                <option value="return">قطع مرتجعة (تُضاف)</option>
              </select>
            </F>
          )}
          <F
            label={
              mode === "receive"
                ? "كم قطعة وصلت؟"
                : kind === "count"
                  ? "الكمية الموجودة فعلاً على الرف"
                  : "عدد القطع"
            }
            help={
              mode === "adjust" && kind === "count" && item && qty
                ? `الفرق: ${delta > 0 ? "+" : ""}${n(delta)}`
                : undefined
            }
          >
            <Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
          </F>
          <F label="ملاحظة (اختياري)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: شحنة المورّد رقم 42"
            />
          </F>
        </div>
        <DialogFooter>
          <Button
            size="lg"
            disabled={!cid || !qty || q < 0 || m.isPending}
            onClick={() => m.mutate()}
          >
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Add / edit product ----------
export function ProductDialog({
  open,
  onOpenChange,
  product,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: ProductRow | null | undefined;
  onCreated?: (id: string) => void;
}) {
  const refresh = useRefresh();
  const [name, setName] = useState("");
  const [ean, setEan] = useState("");
  const [sku, setSku] = useState("");
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setEan(product?.ean ?? "");
      setSku(product?.sku ?? "");
      setActive(product?.active ?? true);
    }
  }, [open, product]);
  const m = useMutation({
    mutationFn: () =>
      saveProduct({
        id: product?.id ?? undefined,
        name: name.trim(),
        ean: ean.trim() || null,
        sku: sku.trim() || autoSku(name),
        product_type: product?.product_type ?? "BUNDLE",
        active,
      }),
    onSuccess: (id) => {
      toast.success(product ? "تم حفظ المنتج" : "تمت إضافة المنتج — الآن حدّد ما يحتويه");
      refresh();
      onOpenChange(false);
      if (!product) onCreated?.(id);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{product ? "تعديل المنتج" : "إضافة منتج للبيع"}</DialogTitle>
          <DialogDescription>
            المنتج هو ما يراه العميل على bol.com، مثل «عبوة 10 زجاجات غاز».
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <F label="اسم المنتج">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="10 Gas Bottles"
            />
          </F>
          <F label="EAN (الباركود على bol.com)" help="8 إلى 14 رقماً.">
            <Input value={ean} onChange={(e) => setEan(e.target.value)} dir="ltr" />
          </F>
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">خيارات إضافية</summary>
            <div className="mt-3 grid gap-3">
              <F label="الرمز الداخلي (SKU)" help="يُنشأ تلقائياً إذا تركته فارغاً.">
                <Input value={sku} onChange={(e) => setSku(e.target.value)} dir="ltr" />
              </F>
              {product && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />{" "}
                  منتج نشط
                </label>
              )}
            </div>
          </details>
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            لا تُدخل كمية هنا — الكمية المتاحة للبيع تُحسب تلقائياً من مخزون القطع.
          </p>
        </div>
        <DialogFooter>
          <Button size="lg" disabled={!name.trim() || m.isPending} onClick={() => m.mutate()}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- "What does this product contain?" ----------
export function ContentsDialog({
  productId,
  onOpenChange,
}: {
  productId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const open = !!productId;
  const refresh = useRefresh();
  const comps = useQuery({ queryKey: ["components-all"], queryFn: allComponents, enabled: open });
  const bom = useQuery({
    queryKey: ["bom", productId],
    queryFn: () => getBom(productId!),
    enabled: open,
  });
  const prods = useQuery({ queryKey: ["products-all"], queryFn: allProducts, enabled: open });
  const product = (prods.data ?? []).find((p) => p.id === productId);
  const [lines, setLines] = useState<{ cid: string; qty: string }[]>([]);
  useEffect(() => {
    if (!open || !bom.data) return;
    setLines(
      bom.data.length
        ? bom.data.map((l) => ({ cid: l.component_id, qty: String(l.quantity_required) }))
        : [{ cid: "", qty: "1" }],
    );
  }, [open, bom.data]);
  const valid = lines.filter((l) => l.cid && parseInt(l.qty, 10) > 0);
  const preview = valid.length
    ? Math.min(
        ...valid.map((l) => {
          const c = (comps.data ?? []).find((x) => x.id === l.cid);
          return Math.floor(Math.max(c?.available_qty ?? 0, 0) / parseInt(l.qty, 10));
        }),
      )
    : 0;
  const m = useMutation({
    mutationFn: () =>
      setBom(
        productId!,
        valid.map((l) => ({ component_id: l.cid, quantity_required: parseInt(l.qty, 10) })),
      ),
    onSuccess: () => {
      toast.success("تم حفظ محتويات المنتج");
      refresh();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ما الذي يحتويه هذا المنتج؟</DialogTitle>
          <DialogDescription>
            {product?.name} — اختر القطع من مستودعك وعدد كل منها في علبة واحدة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="text-sm font-medium">هذا المنتج يحتوي على:</div>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="h-10 w-24 text-center text-base"
                value={l.qty}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))
                }
              />
              <span className="text-muted-foreground">×</span>
              <select
                className={sel}
                value={l.cid}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, cid: e.target.value } : x)))
                }
              >
                <option value="">اختر قطعة…</option>
                {(comps.data ?? [])
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id!}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
                aria-label="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setLines([...lines, { cid: "", qty: "1" }])}
          >
            <Plus className="h-4 w-4" /> إضافة قطعة أخرى
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="text-muted-foreground">بحسب مخزونك الحالي يمكنك بيع:</div>
          <div className="mt-1 text-2xl font-semibold text-stock-available num">{n(preview)}</div>
        </div>
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">أمثلة:</div>
          <div>عبوة 10 غاز = 10 × زجاجة غاز</div>
          <div>4 غاز + شعلة = 4 × زجاجة غاز + 1 × شعلة</div>
          <div className="mt-2" title="Bill of Materials">
            يُسمّى هذا تقنياً «قائمة المواد» (BOM).
          </div>
        </div>
        <DialogFooter>
          <Button size="lg" disabled={!valid.length || m.isPending} onClick={() => m.mutate()}>
            حفظ المحتويات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Test / manual order ----------
export function NewOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const refresh = useRefresh();
  const prods = useQuery({ queryKey: ["products-all"], queryFn: allProducts, enabled: open });
  const chans = useQuery({ queryKey: ["channels"], queryFn: listChannels, enabled: open });
  const [channel, setChannel] = useState("");
  const [lines, setLines] = useState<{ pid: string; qty: string; fm: FulfillmentMethod }[]>([
    { pid: "", qty: "1", fm: "FBR" },
  ]);
  useEffect(() => {
    if (open) {
      setLines([{ pid: "", qty: "1", fm: "FBR" }]);
      setChannel("");
    }
  }, [open]);
  const valid = lines.filter((l) => l.pid && parseInt(l.qty, 10) > 0);
  const m = useMutation({
    mutationFn: () =>
      placeOrder({
        lines: valid.map((l) => ({
          product_id: l.pid,
          quantity: parseInt(l.qty, 10),
          fulfillment_method: l.fm,
        })),
        ...(channel ? { channelId: channel } : {}),
      }),
    onSuccess: () => {
      toast.success("تم إنشاء الطلب — القطع محجوزة الآن");
      refresh();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>طلب اختبار (بيئة الاختبار)</DialogTitle>
          <DialogDescription>جرّب كيف يتغيّر المخزون عند البيع.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <F label="الحساب">
            <select className={sel} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">طلب يدوي</option>
              {(chans.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </F>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[5rem_1fr] gap-2 rounded-md border p-2">
              <Input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))
                }
              />
              <select
                className={sel}
                value={l.pid}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, pid: e.target.value } : x)))
                }
              >
                <option value="">اختر منتجاً…</option>
                {(prods.data ?? [])
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id!}>
                      {p.name} — متاح {n(p.available_qty)}
                    </option>
                  ))}
              </select>
              <select
                className={`${sel} col-span-2`}
                value={l.fm}
                onChange={(e) =>
                  setLines(
                    lines.map((x, j) =>
                      j === i ? { ...x, fm: e.target.value as FulfillmentMethod } : x,
                    ),
                  )
                }
              >
                <option value="FBR">يُشحن من مستودعنا (يحجز من مخزوننا)</option>
                <option value="FBB">تشحنه bol.com (لا يغيّر مخزوننا)</option>
              </select>
            </div>
          ))}
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setLines([...lines, { pid: "", qty: "1", fm: "FBR" }])}
          >
            <Plus className="h-4 w-4" /> منتج آخر
          </Button>
        </div>
        <DialogFooter>
          <Button size="lg" disabled={!valid.length || m.isPending} onClick={() => m.mutate()}>
            إنشاء الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

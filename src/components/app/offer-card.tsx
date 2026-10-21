import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Eye, Loader2, Truck, Warehouse } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/inventory";
import type { CatalogRow } from "@/components/app/catalog";

type Listing = CatalogRow["listings"][number];

export function listingTraits(l: Listing) {
  return {
    color: l.variant_color || l.bol_colour || null,
    pack: l.variant_pack ?? l.bol_pack ?? null,
    label: l.variant_label || null,
  };
}

export function TraitBadges({
  listings,
  compact = false,
}: {
  listings: Listing[];
  compact?: boolean;
}) {
  const details = listings
    .map((l) => ({ l, ...listingTraits(l) }))
    .filter((x) => x.color || x.pack || x.label);
  if (!details.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="اللون وعدد القطع">
      {details.map(({ l, color, pack, label }) => (
        <span
          key={l.id}
          className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border bg-accent/50 px-2 py-1 text-xs"
        >
          {!compact && listings.length > 1 && (
            <span className="num text-muted-foreground" dir="ltr">
              {l.external_ean ?? l.external_offer_id}
            </span>
          )}
          {label && <span>{label}</span>}
          {color && (
            <span>
              اللون: <b>{color}</b>
              {!l.variant_color && l.bol_colour && (
                <small className="ms-1 text-muted-foreground">من bol</small>
              )}
            </span>
          )}
          {pack && (
            <span>
              العبوة: <b className="num">{pack}</b> قطعة
              {!l.variant_pack && l.bol_pack && (
                <small className="ms-1 text-muted-foreground">من bol</small>
              )}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function Field({
  label,
  locked,
  children,
}: {
  label: string;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {label}
        {locked && <Lock className="h-3 w-3 opacity-60" />}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function ReadOnlyNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className}`}
    >
      <Eye className="h-3 w-3" />
      قراءة فقط حالياً
    </div>
  );
}

export function ReadOnlyBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        وضع القراءة فقط — لن يرسل النظام أي تعديل إلى bol.com حتى يتم تفعيل المزامنة لاحقاً.
      </span>
    </div>
  );
}

export function fulfilLabel(m: string | null | undefined) {
  return m === "FBB" ? "تشحنه bol.com" : "نشحن نحن";
}

/** One bol offer (per account), READ ONLY — bol.com writes are disabled. */
export function OfferStrip({ l, account }: { l: Listing; account: string; canEdit?: boolean }) {
  const fbb = l.fulfillment_method === "FBB";
  const forSale = l.for_sale !== false;
  return (
    <div className="grid grid-cols-2 items-start gap-x-5 gap-y-3 rounded-lg border bg-muted/25 p-3 md:grid-cols-5">
      <Field label="الحساب" locked>
        <div className="font-medium">{account}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          {fbb ? <Truck className="h-3 w-3" /> : <Warehouse className="h-3 w-3" />}
          {fulfilLabel(l.fulfillment_method)}
        </div>
      </Field>
      <Field label="حالة العرض" locked>
        <span
          className={forSale ? "font-medium text-success" : "font-medium text-warning-foreground"}
        >
          {forSale ? "معروض للبيع" : "معلّق"}
        </span>
      </Field>
      <Field label="المرجع على bol" locked>
        {l.reference ? (
          <span className="font-mono text-xs" dir="ltr">
            {l.reference}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Field>
      <Field label="السعر على bol" locked>
        <span className="num font-semibold" dir="ltr">
          {l.unit_price != null ? `€ ${Number(l.unit_price).toFixed(2)}` : "—"}
        </span>
      </Field>
      <Field label="الكمية على bol" locked>
        <span className="num text-lg font-semibold">{l.bol_stock ?? "—"}</span>
      </Field>
      <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
        <ReadOnlyNote />
        <span className="text-[10px] text-muted-foreground">
          {l.last_synced_at ? `آخر قراءة: ${new Date(l.last_synced_at).toLocaleString("ar")}` : ""}
        </span>
      </div>
      <details className="col-span-full text-[10px] text-muted-foreground">
        <summary className="cursor-pointer">تفاصيل متقدمة</summary>
        <div className="mt-1 flex flex-wrap gap-x-4" dir="ltr">
          <span>
            Offer ID: <span className="font-mono">{l.external_offer_id}</span>
          </span>
          <span>{l.fulfillment_method}</span>
          {l.condition && <span>{l.condition}</span>}
          <span>{l.mapping_status}</span>
        </div>
      </details>
    </div>
  );
}

/** "Our card" for a merged product: internal name only. bol fields are read-only. */
export function ProductMasterPanel({ row, canEdit }: { row: CatalogRow; canEdit: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState(row.name ?? "");
  const [busy, setBusy] = useState(false);
  const fbr = row.listings.filter((l) => l.fulfillment_method !== "FBB");
  const ours = row.comp ? (row.comp.available_qty ?? 0) : null;
  const bolQtys = [...new Set(fbr.map((l) => l.bol_stock ?? 0))];
  const refs = [...new Set(row.listings.map((l) => l.reference).filter(Boolean))];
  const prices = row.listings
    .map((l) => l.unit_price)
    .filter((x): x is number => typeof x === "number" && x > 0);
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  async function saveName() {
    setBusy(true);
    try {
      const { setProductMaster } = await import("@/lib/inventory");
      await setProductMaster(row.id, name, row.masterReference ?? "");
      toast.success("تم حفظ اسم البطاقة");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-primary">
          بطاقتنا — تجمع {row.listings.length} عروض على bol
        </div>
        <ReadOnlyNote />
      </div>
      {canEdit ? (
        <div className="mb-3 flex gap-2">
          <Input
            className="h-10 text-base font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="اسم البطاقة"
          />
          <Button
            variant="outline"
            disabled={busy || !name.trim() || name.trim() === (row.name ?? "")}
            onClick={saveName}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الاسم"}
          </Button>
        </div>
      ) : (
        <div className="mb-3 text-base font-semibold">{row.name}</div>
      )}
      <div className="-mt-2 mb-3 text-[11px] text-muted-foreground">
        اسم البطاقة عندنا فقط — لا يُرسل شيء إلى bol.
      </div>
      <div className="mb-3 border-b pb-3">
        <TraitBadges listings={row.listings} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="المراجع على bol" locked>
          <div className="font-mono text-xs" dir="ltr">
            {refs.join(" · ") || "—"}
          </div>
        </Field>
        <Field label="المتاح عندنا / على bol" locked>
          <div className="num text-lg font-semibold">
            {ours ?? "—"}{" "}
            <span className="text-sm text-muted-foreground">/ {bolQtys.join(" / ") || "—"}</span>
          </div>
        </Field>
        <Field label="السعر (متوسط العروض)" locked>
          <div className="num text-lg font-semibold" dir="ltr">
            {avg === null ? "—" : `€ ${avg.toFixed(2)}`}
          </div>
        </Field>
      </div>
    </div>
  );
}

/** Internal notes per offer: what makes this EAN different (colour, pack size, label). Not sent to bol. */
export function VariantRow({ l, canEdit }: { l: Listing; canEdit: boolean }) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    label: l.variant_label ?? "",
    color: l.variant_color ?? "",
    pack: l.variant_pack ? String(l.variant_pack) : "",
  });
  const colour = listingTraits(l).color;
  const pack = listingTraits(l).pack;
  const dirty =
    v.label !== (l.variant_label ?? "") ||
    v.color !== (l.variant_color ?? "") ||
    v.pack !== (l.variant_pack ? String(l.variant_pack) : "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const { setListingVariant } = await import("@/lib/inventory");
      await setListingVariant(
        l.id!,
        v.label,
        v.color,
        v.pack ? Math.max(1, Math.floor(+v.pack)) : null,
      );
      toast.success("تم حفظ تفاصيل النسخة");
      await qc.invalidateQueries({ queryKey: ["catalog-listings"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  if (!canEdit) {
    const bits = [l.variant_label, colour, pack && `${pack} قطعة`].filter(Boolean);
    return bits.length ? (
      <div className="text-xs text-muted-foreground">النسخة: {bits.join(" · ")}</div>
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">هذه النسخة:</span>
      <Input
        className="h-7 w-40 text-xs"
        placeholder="وصف (مثلاً: نسخة 2023)"
        value={v.label}
        onChange={(e) => setV({ ...v, label: e.target.value })}
      />
      <Input
        className="h-7 w-28 text-xs"
        placeholder={l.bol_colour ? `${l.bol_colour} (bol)` : "اللون"}
        value={v.color}
        onChange={(e) => setV({ ...v, color: e.target.value })}
      />
      <Input
        className="h-7 w-28 text-xs num"
        type="number"
        min={1}
        placeholder={l.bol_pack ? `${l.bol_pack} قطع (bol)` : "عدد القطع"}
        value={v.pack}
        onChange={(e) => setV({ ...v, pack: e.target.value })}
      />
      {dirty && (
        <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={save}>
          حفظ
        </Button>
      )}
      {(l.bol_colour || l.bol_pack) && (
        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px]">
          من bol: {[l.bol_colour, l.bol_pack && `${l.bol_pack} قطع`].filter(Boolean).join(" · ")}
        </span>
      )}
      {l.bol_contents && (
        <span className="text-[10px] text-muted-foreground" title={l.bol_contents}>
          في العلبة: {l.bol_contents.slice(0, 40)}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground">تعديلك داخلي فقط</span>
    </div>
  );
}

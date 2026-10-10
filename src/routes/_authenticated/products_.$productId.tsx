import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, ExternalLink, Lock, Store, Package, Truck, Warehouse, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Tag } from "@/components/app/page";
import { Photo } from "@/components/app/merchant";
import { BundleEditor, useCatalog } from "@/components/app/catalog";
import { listingTraits, TraitBadges, ReadOnlyBanner, ReadOnlyNote, fulfilLabel } from "@/components/app/offer-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BundleExplain, bundleParts } from "@/components/app/bundle-view";
import { UnifiedOffers } from "@/components/app/unified-offers";
import { unified } from "@/lib/unified-stock";
import { MasterTable, HealthPanel, IdentityPanel, InventoryIdentity, RelationshipPanel, FamilyPanel } from "@/components/app/product-master";
import { features, colorOf, packOf } from "@/lib/product-intelligence";
import { errMsg, listMovements, postMovement, setListingVariant, setProductMaster, setStockItem } from "@/lib/inventory";
import { usePermissions } from "@/lib/auth";
import { getBolProductPage } from "@/lib/bol.functions";
import { n } from "@/components/app/merchant";
import type { CatalogRow } from "@/components/app/catalog";

export const Route = createFileRoute("/_authenticated/products_/$productId")({
  head: () => ({ meta: [
    { title: "تفاصيل المنتج · QNAN" }, { name: "description", content: "تصحيح بيانات المنتج الداخلية ومراجعة اقتراحات الربط والبندلات." },
    { property: "og:title", content: "تفاصيل المنتج · QNAN" }, { property: "og:description", content: "تصحيح بيانات المنتج الداخلية ومراجعة اقتراحات الربط والبندلات." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ProductDetails,
});

const MV: Record<string, string> = { receipt: "استلام بضاعة", adjustment: "تعديل جرد", reservation: "حجز لطلب", release: "إلغاء حجز", sale: "بيع", return: "مرتجع", damaged: "تالف" };

function ProductDetails() {
  const { productId } = Route.useParams();
  const cat = useCatalog();
  const perm = usePermissions();
  const qc = useQueryClient();
  const row = cat.catalog.find((r) => r.id === productId);
  const [name, setName] = useState("");
  const [busyName, setBusyName] = useState(false);
  const [editingContents, setEditingContents] = useState(false);
  useEffect(() => { setName(row?.name ?? ""); }, [row?.id]);
  const history = useQuery({ queryKey: ["movements", "product", row?.comp?.id], queryFn: () => listMovements({ componentId: row!.comp!.id!, limit: 50 }), enabled: !!row?.comp?.id });

  const f = row ? features(row) : null;
  const eans = row ? [...new Set(row.listings.map((l) => l.external_ean).filter((ean): ean is string => !!ean))] : [];
  const prices = row?.listings.map((l) => l.unit_price).filter((p): p is number => p != null) ?? [];
  const priceText = prices.length ? `€ ${Math.min(...prices).toFixed(2)}${Math.min(...prices) !== Math.max(...prices) ? ` – ${Math.max(...prices).toFixed(2)}` : ""}` : "غير متوفر";
  const dependents = row?.comp ? cat.rows.filter((p) => p.id !== row.id && p.isBundle && p.contents.some((c) => c.component_id === row.comp?.id)) : [];
  const bp = row?.isBundle ? bundleParts(row, cat.rows) : null;
  const variants = row && f ? cat.catalog.filter((r) => r.id !== row.id && !r.isBundle && ((row.familyKey && r.familyKey === row.familyKey) || (features(r).family === f.family && f.family.split(" ").length >= 2 && (colorOf(r) !== f.color || features(r).size !== f.size) && packOf(r) === f.pack))) : [];
  const alerts: string[] = [];
  if (row) {
    if (row.listings.some((l) => l.for_sale !== false && (l.bol_stock ?? 0) === 0)) alerts.push("عرض معروض بكمية صفر على bol");
    if (row.listings.some((l) => l.for_sale === false)) alerts.push("يوجد عرض معلّق على bol");
    if (row.needsReview) alerts.push("ربط أحد العروض بحاجة مراجعة");
    if (bp && !bp.parts.length) alerts.push("لم تُحدَّد مكوّنات البندل");
    const avail = row.isBundle ? bp?.total ?? 0 : row.comp?.available_qty ?? 0;
    const u = unified(row, cat.rows);
    if (u.state === "NO_STOCK") alerts.push("المخزون الأساسي غير محدد — حدّد العدد الفعلي الحقيقي (لا نخمّن من أرقام bol)");
    if (u.remoteMismatch || u.qtyDrift) alerts.push("عروض bol غير متطابقة مع الكمية الموحدة");
    if (u.refDrift || !u.masterRef) alerts.push(u.masterRef ? "المرجع على bol مختلف عن المرجع الموحّد" : "المرجع الموحّد غير محدد");
  }

  async function saveName() {
    if (!row || !name.trim() || busyName) return;
    setBusyName(true);
    try {
      await setProductMaster(row.id, name.trim(), row.masterReference ?? "");
      await qc.invalidateQueries({ queryKey: ["products-all"] });
      toast.success("حُفظ الاسم عندنا فقط — اسم bol لم يتغير");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusyName(false); }
  }

  if (!row || !f) return <Page title="تفاصيل المنتج" actions={<Button asChild variant="outline"><Link to="/products"><ArrowRight className="h-4 w-4" /> المنتجات</Link></Button>}>
    <p className="text-muted-foreground">{cat.loaded ? "لم نجد هذا المنتج." : "جارٍ تحميل المنتج…"}</p>
  </Page>;

  const avail = row.isBundle ? bp?.total ?? null : row.comp?.available_qty ?? null;
  return <Page title="تفاصيل المنتج" actions={<Button asChild variant="outline"><Link to="/products"><ArrowRight className="h-4 w-4" /> منتجات bol</Link></Button>}>
    <div className="flex flex-col gap-5 border-b pb-5 sm:flex-row sm:items-center">
      <Photo name={row.name} src={row.imageUrl} size="h-32 w-32" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">{row.isBundle && <Tag tone="warning">بندل / طقم</Tag>}<h2 className="text-xl font-semibold">{row.name}</h2></div>
        <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground"><span dir="ltr">EAN <span className="num">{eans.join(" · ") || "—"}</span></span><span>{[...new Set(row.listings.map((l) => cat.chanLabel(l.channel_id)))].join("، ")}</span><span>{[...new Set(row.listings.map((l) => fulfilLabel(l.fulfillment_method)))].join(" · ")}</span></div>
        <TraitBadges listings={row.listings} compact />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Big label="فعلي" v={row.isBundle ? null : row.comp?.physical_qty ?? null} />
        <Big label="محجوز" v={row.isBundle ? null : row.comp?.reserved_qty ?? null} />
        <Big label={row.isBundle ? "يمكن تجهيز" : "المتاح الموحد"} v={avail} strong />
        <div className="rounded-lg bg-muted/40 px-3 py-2"><div className="text-[11px] text-muted-foreground">المرجع الموحّد</div><div className="font-mono text-sm font-semibold" dir="ltr">{row.masterReference || "غير محدد"}</div></div>
      </div>
    </div>
    <div className="my-4"><ReadOnlyBanner /></div>

    <Tabs defaultValue={row.isBundle ? "bundle" : "overview"} dir="rtl">
      <TabsList className="mb-4 flex h-auto flex-wrap">
        <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
        <TabsTrigger value="master">بيانات المنتج الأساسية</TabsTrigger>
        <TabsTrigger value="stock">المخزون</TabsTrigger>
        <TabsTrigger value="offers">عروض bol <span className="ms-1 num">({row.listings.length})</span></TabsTrigger>
        <TabsTrigger value="bundle">العلاقات / المحتويات</TabsTrigger>
        <TabsTrigger value="variants">النسخ / Variants <span className="ms-1 num">({variants.length})</span></TabsTrigger>
        <TabsTrigger value="history">السجل</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-5">
        <UnifiedOffers row={row} all={cat.rows} account={cat.chanLabel} canEdit={perm.isAdmin} />
        <IdentityPanel row={row} account={cat.chanLabel} />
        <HealthPanel row={row} />
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 rounded-lg border bg-muted/20 px-4 py-5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="العلامة" value={f.brand || "—"} note="مستنتج — انظر البيانات الأساسية" />
          <Metric label="العائلة" value={f.family || "—"} note="للمقارنة والاقتراحات" />
          <Metric label="الموديل / المقاس" value={[f.model, f.size].filter(Boolean).join(" · ") || "—"} note="مستخرج من الاسم" />
          <Metric label="اللون / العبوة" value={`${f.color || "—"} / ${f.pack ?? "—"}`} note="تصحيحك له الأولوية" />
          <Metric label="السعر على bol" value={priceText} note={prices.length > 1 ? "حسب العرض" : "آخر قراءة"} />
          <Metric label="EAN / عروض" value={`${eans.length} / ${row.listings.length}`} note="مرتبطة بهذه البطاقة" />
        </div>
        {alerts.length > 0 ? <div className="space-y-1.5">{alerts.map((a) => <div key={a} className="flex items-center gap-2 border-s-4 border-warning bg-warning/10 px-3 py-2 text-sm"><AlertTriangle className="h-4 w-4 shrink-0" />{a}</div>)}</div>
          : <p className="text-sm text-success">لا توجد تنبيهات على هذا المنتج.</p>}
        <section className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-semibold">اسم المنتج عندنا</h3>
          <div className="flex max-w-xl flex-wrap gap-2">
            <Input className="min-w-48 flex-1" value={name} disabled={!perm.isAdmin} onChange={(e) => setName(e.target.value)} />
            {perm.isAdmin && <Button variant="outline" disabled={!name.trim() || name.trim() === row.name || busyName} onClick={saveName}>حفظ الاسم</Button>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">داخلي فقط — الاسم على bol لا يتغير.</p>
        </section>
      </TabsContent>

      <TabsContent value="master"><MasterTable row={row} canEdit={perm.isAdmin} /></TabsContent>

      <TabsContent value="stock" className="space-y-5">
        <InventoryIdentity row={row} />
        {row.isBundle ? <p className="text-sm text-muted-foreground">البندل ليس له مخزون مستقل؛ المتاح يُحسب من مكوّناته — انظر تبويب «البندل / المحتويات».</p> : <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Big label="فعلي" v={row.comp?.physical_qty ?? null} />
            <Big label="محجوز" v={row.comp?.reserved_qty ?? null} />
            <Big label="حد الأمان" v={row.comp?.safety_stock ?? null} />
            <Big label="متاح" v={row.comp?.available_qty ?? null} strong />
            <div className="rounded-lg bg-muted/40 px-3 py-2"><div className="text-[11px] text-muted-foreground">الموقع</div><div className="text-sm font-medium">المستودع الرئيسي</div></div>
          </div>
          {perm.isAdmin && <StockControl row={row} />}
        </>}
        <section>
          <h3 className="mb-2 text-sm font-semibold">يُستخدم في <span className="num text-muted-foreground">({dependents.length})</span></h3>
          {dependents.length ? <div className="divide-y rounded-lg border">{dependents.map((p) => {
            const required = p.contents.find((c) => c.component_id === row.comp?.id)?.qty ?? 0;
            return <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"><div className="flex min-w-0 items-center gap-3"><Photo name={p.name} src={p.imageUrl} size="h-10 w-10" /><Link to="/products/$productId" params={{ productId: p.id }} className="font-medium text-primary hover:underline">{p.name}</Link></div><div className="text-sm text-muted-foreground">يحتاج <b className="num text-foreground">{n(required)}</b> لكل بندل · يمكن تجهيز <b className="num text-foreground">{n(bundleParts(p, cat.rows).total ?? 0)}</b></div></div>;
          })}</div> : <p className="text-sm text-muted-foreground">لا يوجد بندل يسحب من هذا المنتج.</p>}
        </section>
      </TabsContent>

      <TabsContent value="offers" className="grid gap-4">
        <UnifiedOffers row={row} all={cat.rows} account={cat.chanLabel} canEdit={perm.isAdmin} />
        <h3 className="pt-2 text-sm font-semibold">تفاصيل كل عرض (قراءة فقط)</h3>
        {row.listings.map((l) => <OfferCorrection key={l.id} listing={l} account={cat.chanLabel(l.channel_id)} imageUrl={row.imageUrl} canEdit={perm.isAdmin} masterRef={row.masterReference} />)}
      </TabsContent>

      <TabsContent value="bundle" className="space-y-4">
        {row.isBundle ? <>
          <RelationshipPanel row={row} canEdit={perm.isAdmin} />
          <BundleExplain product={row} catalog={cat.rows} />
          {perm.isAdmin && <Button onClick={() => setEditingContents(true)}>تعديل مكونات البندل</Button>}
        </> : <div className="space-y-3">
          <p className="text-sm text-muted-foreground">هذا منتج عادي له مخزونه الخاص. إذا كان في الحقيقة عبوة أو طقم من منتجات أخرى، حوّله إلى بندل واختر مكوّناته.</p>
          {perm.isAdmin && <Button variant="outline" onClick={() => setEditingContents(true)}>تحويل إلى بندل واختيار المكوّنات</Button>}
        </div>}
      </TabsContent>

      <TabsContent value="variants" className="space-y-3">
        <FamilyPanel row={row} catalog={cat.catalog} />
        <h3 className="pt-2 text-sm font-semibold">نسخ محتملة (غير مؤكَّدة)</h3>
        <p className="text-sm text-muted-foreground">نسخ من نفس العائلة بلون أو مقاس مختلف. لكل نسخة مخزونها المستقل.</p>
        {variants.length ? <div className="divide-y rounded-lg border">{variants.map((v) => <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3"><Photo name={v.name} src={v.imageUrl} size="h-10 w-10" /><div className="min-w-0"><Link to="/products/$productId" params={{ productId: v.id }} className="line-clamp-1 font-medium text-primary hover:underline">{v.name}</Link><TraitBadges listings={v.listings} compact /></div></div>
          <div className="text-sm">متاح <b className="num">{v.comp ? n(v.comp.available_qty) : "—"}</b></div>
        </div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد نسخ معروفة. <Link to="/review" className="text-primary underline">مراجعة المنتجات</Link></p>}
      </TabsContent>

      <TabsContent value="history">
        {!row.comp ? <p className="text-sm text-muted-foreground">{row.isBundle ? "حركات البندل تظهر في سجل مكوّناته." : "لا يوجد سجل — المنتج غير مضاف للمخزون."}</p>
          : !history.data?.rows.length ? <p className="text-sm text-muted-foreground">{history.isPending ? "جارٍ التحميل…" : "لا توجد حركات بعد."}</p>
          : <ul className="divide-y rounded-lg border">{history.data.rows.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span><b>{MV[m.movement_type] ?? m.movement_type}</b>: {m.physical_delta > 0 ? `+${n(m.physical_delta)}` : n(m.physical_delta)} قطعة{m.reserved_delta ? ` (محجوز ${m.reserved_delta > 0 ? "+" : ""}${n(m.reserved_delta)})` : ""} — أصبح الفعلي <b className="num">{n(m.physical_after)}</b>{m.reason ? ` · ${m.reason}` : ""}{m.orders?.order_number ? ` · طلب #${m.orders.order_number}` : ""}</span>
            <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("ar")}</span>
          </li>)}</ul>}
      </TabsContent>
    </Tabs>
    <BundleEditor product={editingContents ? row : null} onClose={() => setEditingContents(false)} />
  </Page>;
}

function Big({ label, v, strong }: { label: string; v: number | null; strong?: boolean }) {
  return <div className="rounded-lg bg-muted/40 px-3 py-2"><div className="text-[11px] text-muted-foreground">{label}</div><div className={`num ${strong ? "text-2xl font-semibold text-stock-available" : "text-lg font-medium"}`}>{v == null ? "—" : n(v)}</div></div>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="min-w-0"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-1 break-words text-xl font-semibold num" dir="auto">{value}</div><div className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</div></div>;
}

function StockControl({ row }: { row: CatalogRow }) {
  const qc = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const physical = row.comp?.physical_qty ?? 0;
  const reserved = row.comp?.reserved_qty ?? 0;
  const target = Number(quantity);
  const valid = quantity.trim() !== "" && /^\d+$/.test(quantity.trim()) && Number.isSafeInteger(target) && target >= reserved;

  async function save() {
    if (!valid || busy) return;
    if (!window.confirm(`سيصبح العدد الفعلي في المستودع ${n(target)} قطعة (المتاح ${n(target - reserved)}).\nتغيير داخلي فقط — لا يُرسل شيء إلى bol.`)) return;
    setBusy(true);
    try {
      const componentId = row.comp?.id ?? await setStockItem(row.id);
      const delta = target - physical;
      if (delta !== 0) await postMovement({ componentId, type: "adjustment", quantity: delta, reason: "جرد من صفحة المنتج" });
      await qc.invalidateQueries();
      setQuantity("");
      toast.success("حُفظ مخزون المستودع");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return <div className="rounded-lg border-s-4 border-primary bg-accent/30 px-4 py-4">
    <h4 className="font-semibold">جرد المستودع</h4>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <div className="w-full max-w-48"><label htmlFor={`stock-${row.id}`} className="mb-1 block text-xs font-medium">العدد الفعلي الصحيح</label><Input id={`stock-${row.id}`} dir="ltr" type="number" min={reserved} step="1" inputMode="numeric" placeholder={String(physical)} value={quantity} disabled={busy} onChange={(e) => setQuantity(e.target.value)} /></div>
      <Button disabled={!valid || busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ الجرد"}</Button>
    </div>
    {quantity && !valid && <p className="mt-2 text-xs text-destructive">أدخل عدداً صحيحاً لا يقل عن المحجوز ({n(reserved)}).</p>}
    <p className="mt-2 text-xs text-muted-foreground">داخلي فقط. كميات bol لا تتغير في وضع القراءة فقط.</p>
  </div>;
}

type Listing = NonNullable<ReturnType<typeof useCatalog>["catalog"][number]>["listings"][number];

function OfferCorrection({ listing: l, account, imageUrl, canEdit, masterRef }: { listing: Listing; account: string; imageUrl: string | null; canEdit: boolean; masterRef?: string | null }) {
  const qc = useQueryClient();
  const resolvePage = useServerFn(getBolProductPage);
  const productPage = useQuery({ queryKey: ["bol-product-page", l.id], queryFn: () => resolvePage({ data: { listingId: l.id } }), enabled: !l.bol_product_id && !!l.external_ean, retry: false, staleTime: Infinity });
  const [color, setColor] = useState(l.variant_color ?? "");
  const [pack, setPack] = useState(l.variant_pack == null ? "" : String(l.variant_pack));
  const [busy, setBusy] = useState(false);
  const effective = listingTraits(l);
  const validPack = pack === "" || (/^[1-9]\d*$/.test(pack) && Number.isSafeInteger(Number(pack)));
  const dirty = color.trim() !== (l.variant_color ?? "") || pack !== (l.variant_pack == null ? "" : String(l.variant_pack));
  const bolProductId = l.bol_product_id ?? productPage.data?.productId;
  const bolPage = bolProductId && /^\d+$/.test(bolProductId) ? `https://www.bol.com/nl/nl/p/${bolProductId}/` : null;

  async function save() {
    if (!validPack || !dirty || busy) return;
    setBusy(true);
    try {
      await setListingVariant(l.id, l.variant_label ?? "", color.trim(), pack ? Number(pack) : null);
      await qc.invalidateQueries({ queryKey: ["catalog-listings"] });
      toast.success("حُفظ التصحيح وتحدّثت الاقتراحات");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return <div className="border bg-card p-4 sm:p-5">
    <div className="flex flex-col gap-5 sm:flex-row">
      <Photo name={l.title} src={imageUrl} size="h-32 w-32" />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Store className="h-4 w-4" /><b className="text-foreground">{account}</b><span>· العرض على bol</span></div>
        <h4 className="text-base font-semibold leading-relaxed">{l.title || "لم يُسحب اسم العرض من bol"}</h4>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-3 text-sm md:grid-cols-4">
          <div><div className="text-xs text-muted-foreground">السعر على bol</div><b className="num text-lg">{l.unit_price == null ? "غير متوفر" : `€ ${Number(l.unit_price).toFixed(2)}`}</b></div>
          <div><div className="text-xs text-muted-foreground">الكمية على bol</div><b className="num text-lg">{l.bol_stock == null ? "غير متوفرة" : l.bol_stock.toLocaleString("en-US")}</b></div>
          <div><div className="text-xs text-muted-foreground">العبوة من bol</div><b>{l.bol_pack == null ? "غير مذكورة" : <><span className="num">{l.bol_pack}</span> قطعة</>}</b></div>
          <div><div className="text-xs text-muted-foreground">حالة العرض</div><b>{l.for_sale === false ? "معلّق" : l.for_sale === true ? "معروض للبيع" : "غير متوفرة"}</b></div>
          <div><div className="text-xs text-muted-foreground">اللون من bol</div><b>{l.bol_colour || "غير مذكور"}</b></div>
          <div><div className="text-xs text-muted-foreground">الشحن</div><b className="inline-flex items-center gap-1">{l.fulfillment_method === "FBB" ? <><Truck className="h-4 w-4" /> تشحنه bol</> : <><Warehouse className="h-4 w-4" /> نشحن نحن</>}</b></div>
          <div><div className="text-xs text-muted-foreground">المرجع الموحّد</div><b className="break-all font-mono text-xs" dir="ltr">{(l.mapping_status === "CONFIRMED" && masterRef) || l.reference || "غير محدد"}</b>{l.mapping_status === "CONFIRMED" && masterRef && (l.reference?.trim() || "") !== masterRef && <div className="text-[11px] text-warning-foreground">على bol حالياً: <span dir="ltr" className="font-mono">{l.reference || "فارغ"}</span> — يُحدَّث عند تفعيل المزامنة</div>}</div>
          <div><div className="text-xs text-muted-foreground">الحالة</div><b>{l.condition || "غير متوفرة"}</b></div>
          <details className="col-span-full text-[11px] text-muted-foreground"><summary className="cursor-pointer">تفاصيل متقدمة</summary><div dir="ltr" className="mt-1 flex flex-wrap gap-x-4"><span>Offer ID {l.external_offer_id ?? "—"}</span><span>{l.fulfillment_method}</span><span>{l.mapping_status}</span></div></details>
        </div>
        <div className="mt-4 border-t pt-3 text-sm"><div className="flex items-center gap-1 font-medium"><Package className="h-4 w-4" /> محتويات العبوة حسب bol</div><p className="mt-1 text-muted-foreground">{l.bol_contents || "لم تُذكر في البيانات المسحوبة؛ اقرأ المواصفات الكاملة على bol."}</p></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> EAN <span className="num" dir="ltr">{l.external_ean ?? "—"}</span></span></div>
          {bolPage ? <Button asChild size="sm" variant="outline"><a href={bolPage} target="_blank" rel="noopener noreferrer" aria-label={`افتح صفحة المنتج على bol ${bolProductId}`}><ExternalLink className="h-4 w-4" /> المواصفات الكاملة على bol</a></Button> : <span className="text-xs text-muted-foreground">{productPage.isPending ? "جارٍ جلب رابط المنتج من bol…" : "رابط المنتج المباشر غير متوفر لهذا العرض"}</span>}
        </div>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><ReadOnlyNote /><span>{l.last_synced_at ? `آخر قراءة: ${new Date(l.last_synced_at).toLocaleString("ar")}` : ""}</span></div>
    <div className="mt-5 border-t pt-4">
      <div className="mb-3 text-sm font-semibold">تصحيح بياناتنا لهذا العرض</div>
      <p className="mb-3 text-xs text-muted-foreground">اللون والعدد المصححان هنا لا يغيّران بيانات bol؛ تُستخدم هذه القيم لاقتراحات الربط والبندلات.</p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div><label className="mb-1 block text-xs font-medium" htmlFor={`color-${l.id}`}>اللون الصحيح عندنا</label><Input id={`color-${l.id}`} placeholder={l.bol_colour || "أدخل اللون"} value={color} disabled={!canEdit} onChange={(e) => setColor(e.target.value)} /><div className="mt-1 text-xs text-muted-foreground">المعتمد: {effective.color || "غير محدد"}</div></div>
        <div><label className="mb-1 block text-xs font-medium" htmlFor={`pack-${l.id}`}>عدد القطع الصحيح عندنا</label><Input id={`pack-${l.id}`} dir="ltr" type="number" min={1} step={1} placeholder={l.bol_pack == null ? "أدخل العدد" : String(l.bol_pack)} value={pack} disabled={!canEdit} onChange={(e) => setPack(e.target.value)} /><div className="mt-1 text-xs text-muted-foreground">المعتمد: <span className="num">{effective.pack ?? "غير محدد"}</span></div>{!validPack && <p className="mt-1 text-xs text-destructive">أدخل عدداً صحيحاً أكبر من صفر.</p>}</div>
        {canEdit && <Button disabled={!validPack || !dirty || busy} onClick={save}>حفظ التصحيح</Button>}
      </div>
    </div>
  </div>;
}
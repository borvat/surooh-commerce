import { useState } from "react";
import { productHealth, resolveMaster } from "@/lib/product-master";
import { unified, SYNC_AR } from "@/lib/unified-stock";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { confirmListing, errMsg, mergeProducts, unmergeListing, setProductNormal, setStockItem } from "@/lib/inventory";
import { usePermissions } from "@/lib/auth";
import { Page, Tag } from "@/components/app/page";
import { TraitBadges, listingTraits, fulfilLabel } from "@/components/app/offer-card";
import { Lock, ArrowUpLeft, Boxes } from "lucide-react";
import { BundleEditor, useCatalog, type CatalogRow } from "@/components/app/catalog";
import { Photo, SharedNote, sel, n } from "@/components/app/merchant";
import { SameProductDialog } from "@/components/app/review-cards";
import { bundleParts } from "@/components/app/bundle-view";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [
    { title: "منتجات bol · QNAN" }, { name: "description", content: "إدارة منتجات bol والنسخ والألوان والعبوات والمخزون وربط العروض في QNAN." },
    { property: "og:title", content: "منتجات bol · QNAN" }, { property: "og:description", content: "إدارة منتجات bol والنسخ والألوان والعبوات والمخزون وربط العروض في QNAN." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CatalogPage,
});

function CatalogPage() {
  const perm = usePermissions();
  const qc = useQueryClient();
  const cat = useCatalog();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [quick, setQuick] = useState("all");
  const [f, setF] = useState({ stock: "all", sale: "all", ship: "all", type: "all", map: "all", account: "all", sort: "name" });
  const setFilter = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const [bundle, setBundle] = useState<CatalogRow | null>(null);
  const [review, setReview] = useState<CatalogRow | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [mergeRows, setMergeRows] = useState<CatalogRow[] | null>(null);
  const unmerge = useMutation({
    mutationFn: (id: string) => unmergeListing(id),
    onSuccess: () => { toast.success("صار العرض بطاقة منفصلة"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const toNormal = useMutation({
    mutationFn: (id: string) => setProductNormal(id),
    onSuccess: () => { toast.success("أصبح منتجاً عادياً"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const stockItem = useMutation({
    mutationFn: (id: string) => setStockItem(id),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast.error(errMsg(e)),
  });
  const salesQ = useQuery({
    queryKey: ["product-sales-90d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 864e5).toISOString();
      const { data, error } = await supabase.from("order_lines").select("product_id, quantity, orders!inner(status, created_at)").gte("orders.created_at", since).neq("orders.status", "cancelled").limit(10000);
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const l of data ?? []) m[l.product_id] = (m[l.product_id] ?? 0) + l.quantity;
      return m;
    },
  });
  const sold = (r: CatalogRow) => salesQ.data?.[r.id] ?? 0;
  const q = search.trim().toLowerCase();
  // unified available of the canonical product — never a sum of bol offer quantities
  const bolQty = (r: CatalogRow) => unified(r, cat.rows).target ?? 0;
  const outOnBol = (r: CatalogRow) => r.listings.some((l) => l.for_sale !== false && (l.bol_stock ?? 0) === 0);
  const ourAvail = (r: CatalogRow) => (r.isBundle ? (r.contents.length ? r.available_qty ?? 0 : null) : r.comp ? r.comp.available_qty ?? 0 : null);
  const counts = {
    out: cat.catalog.filter(outOnBol).length,
    low: cat.catalog.filter((r) => { const s = bolQty(r); return s > 0 && s <= 5; }).length,
    hold: cat.catalog.filter((r) => r.listings.some((l) => l.for_sale === false)).length,
    review: cat.catalog.filter((r) => r.needsReview).length,
  };
  const health = new Map(cat.catalog.map((r) => [r.id, productHealth(r)]));
  const usedIn = (r: CatalogRow) => r.comp ? cat.rows.filter((p) => p.isBundle && p.contents.some((c) => c.component_id === r.comp?.id)).length : 0;
  const QUICK: [string, string, (r: CatalogRow) => boolean][] = [
    ["all", "كل المنتجات", () => true],
    ["attention", "بحاجة انتباه", (r) => health.get(r.id)!.needsAttention],
    ["master", "بيانات أساسية ناقصة", (r) => health.get(r.id)!.missingMaster || health.get(r.id)!.conflicts.length > 0],
    ["noinv", "بلا صنف مخزون", (r) => health.get(r.id)!.noInventory],
    ["rel", "مشاكل العلاقات", (r) => health.get(r.id)!.relationshipIssue],
    ["out", "نفد المخزون", (r) => ourAvail(r) === 0 || outOnBol(r)],
  ];
  const quickFn = QUICK.find((x) => x[0] === quick)![2];
  const all = cat.catalog
    .filter((r) => {
      if (!quickFn(r)) return false;
      const s = bolQty(r);
      if (f.stock === "out" && !outOnBol(r)) return false;
      if (f.stock === "low" && !(s > 0 && s <= 5)) return false;
      if (f.stock === "in" && s <= 5) return false;
      if (f.stock === "nowh" && ourAvail(r) !== null) return false;
      if (f.stock === "whzero" && ourAvail(r) !== 0) return false;
      if (f.sale === "on" && !r.listings.some((l) => l.for_sale !== false)) return false;
      if (f.sale === "off" && !r.listings.some((l) => l.for_sale === false)) return false;
      if (f.ship !== "all" && !r.listings.some((l) => l.fulfillment_method === f.ship)) return false;
      if (f.type === "bundle" && !r.isBundle) return false;
      if (f.type === "normal" && r.isBundle) return false;
      if (f.type === "merged" && new Set(r.listings.map((l) => l.external_ean)).size < 2) return false;
      if (f.map === "review" && !r.needsReview) return false;
      if (f.map === "ok" && r.needsReview) return false;
      if (f.account !== "all" && !r.accounts.includes(f.account)) return false;
      return !q || `${r.name} ${r.ean ?? ""} ${r.listings.map((l) => `${l.reference ?? ""} ${l.external_offer_id ?? ""} ${listingTraits(l).color ?? ""} ${listingTraits(l).pack ?? ""} ${listingTraits(l).label ?? ""}`).join(" ")}`.toLowerCase().includes(q);
    })
    .sort((a, b) => f.sort === "sales_desc" ? sold(b) - sold(a) : f.sort === "sales_asc" ? sold(a) - sold(b) : f.sort === "stock_asc" ? bolQty(a) - bolQty(b) : f.sort === "stock_desc" ? bolQty(b) - bolQty(a)
      : f.sort === "price_desc" ? (b.price ?? 0) - (a.price ?? 0) : f.sort === "price_asc" ? (a.price ?? 0) - (b.price ?? 0) : (a.name ?? "").localeCompare(b.name ?? ""));
  const perPage = 25;
  const pages = Math.max(1, Math.ceil(all.length / perPage));
  const current = Math.min(page, pages);
  const rows = all.slice((current - 1) * perPage, current * perPage);

  if (cat.loaded && !cat.imported) {
    return <Page title="منتجات bol"><div className="rounded-xl border p-10 text-center">
      <p className="mb-4 text-muted-foreground">لم تُسحب أي منتجات بعد. ابدأ بربط حسابك على bol.com.</p>
      <Button size="lg" asChild><Link to="/channels">ربط حساب bol.com</Link></Button>
    </div></Page>;
  }
  return (
    <Page title="منتجات bol" intro="منتجاتك كما سُحبت من bol.com. حدّد لكل منتج: منتج عادي (له مخزون خاص) أو بندل / طقم (يتكون من منتجات أخرى).">
      <div className="mb-4"><SharedNote /></div>
      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK.map(([k, l, fn]) => <button key={k} onClick={() => { setQuick(k); setPage(1); }}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${quick === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>
          {l}<span className="num font-semibold">{cat.catalog.filter(fn).length}</span></button>)}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input className="max-w-sm" placeholder="بحث بالاسم، EAN، المرجع أو رقم العرض…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <span className="text-xs text-muted-foreground num">{all.length} منتج</span>
        <Button size="sm" variant="outline" className="ms-auto" asChild><Link to="/review">مراجعة المنتجات</Link></Button>
      </div>
      <details className="mb-4 rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">فلاتر متقدمة</summary>
        <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterSel label="المخزون" value={f.stock} onChange={(v) => setFilter("stock", v)} opts={[["all", "الكل"], ["out", "نفد على bol"], ["low", "متاح موحّد قليل (1–5)"], ["in", "متاح موحّد (+5)"], ["nowh", "غير مضاف لمستودعنا"], ["whzero", "صفر في مستودعنا"]]} />
        <FilterSel label="حالة العرض" value={f.sale} onChange={(v) => setFilter("sale", v)} opts={[["all", "الكل"], ["on", "معروض للبيع"], ["off", "معلّق"]]} />
        <FilterSel label="الشحن" value={f.ship} onChange={(v) => setFilter("ship", v)} opts={[["all", "الكل"], ["FBR", "نشحن نحن (FBR)"], ["FBB", "تشحنه bol (FBB)"]]} />
        <FilterSel label="النوع" value={f.type} onChange={(v) => setFilter("type", v)} opts={[["all", "الكل"], ["normal", "منتج عادي"], ["bundle", "بندل / طقم"], ["merged", "مدموج (أكثر من EAN)"]]} />
        {cat.channels.length > 1 && <FilterSel label="الحساب" value={f.account} onChange={(v) => setFilter("account", v)} opts={[["all", "الكل"], ...cat.channels.map((c) => [c.id, c.retailer_name ?? cat.chanLabel(c.id)] as [string, string])]} />}
        <FilterSel label="ترتيب" value={f.sort} onChange={(v) => setFilter("sort", v)} opts={[["name", "الاسم"], ["sales_desc", "الأكثر مبيعاً (90 يوم)"], ["sales_asc", "الأقل مبيعاً (90 يوم)"], ["stock_asc", "الكمية: الأقل أولاً"], ["stock_desc", "الكمية: الأكثر أولاً"], ["price_desc", "السعر: الأعلى"], ["price_asc", "السعر: الأقل"]]} />
        </div>
      </details>
      <div className="grid gap-4">
        {rows.length === 0 && <div className="rounded-xl border p-10 text-center text-muted-foreground">{cat.loaded ? "لا شيء هنا." : "جارٍ التحميل…"}</div>}
        {rows.map((r) => {
          const bp = r.isBundle ? bundleParts(r, cat.rows) : null;
          const fulfil = [...new Set(r.listings.map((l) => fulfilLabel(l.fulfillment_method)))].join(" · ");
          const alerts: [string, "danger" | "warning"][] = [];
          if (outOnBol(r)) alerts.push(["نفد على bol", "danger"]);
          if (r.listings.some((l) => l.for_sale === false)) alerts.push(["عرض معلّق", "warning"]);
          if (r.needsReview) alerts.push(["راجع الربط", "warning"]);
          if (!r.isBundle && !r.comp) alerts.push(["غير مضاف للمخزون", "warning"]);
          if (bp && !bp.parts.length) alerts.push(["حدّد المكوّنات", "warning"]);
          const hh = health.get(r.id)!;
          const u = unified(r, cat.rows);
          if (u.state === "NO_STOCK" && !r.isBundle) { const i = alerts.findIndex((a) => a[0] === "غير مضاف للمخزون"); if (i >= 0) alerts.splice(i, 1); }
          if (u.remoteMismatch || u.qtyDrift) alerts.push(["عروض bol غير متطابقة مع الكمية الموحدة", "danger"]);
          if (u.refDrift) alerts.push(["المرجع على bol مختلف عن المرجع الموحّد", "warning"]);
          if (hh.conflicts.length) alerts.push([`تعارض: ${hh.conflicts.join("، ")}`, "danger"]);
          if (hh.missingTitle) alerts.push(["الاسم ناقص", "warning"]);
          if (bp && bp.total != null && r.listings.some((l) => l.fulfillment_method !== "FBB" && (l.bol_stock ?? 0) > bp.total!)) alerts.push(["bol يعرض أكثر مما يمكن تجهيزه", "danger"]);
          const phys = r.isBundle ? null : r.comp?.physical_qty ?? null;
          const res = r.isBundle ? null : r.comp?.reserved_qty ?? null;
          const avail = r.isBundle ? bp?.total ?? null : r.comp?.available_qty ?? null;
          return <article key={r.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center">
            {perm.isAdmin && !r.isBundle && <input type="checkbox" aria-label="اختيار للربط" className="h-5 w-5 shrink-0 accent-primary" checked={picked.includes(r.id)} onChange={(e) => setPicked((x) => e.target.checked ? [...x, r.id] : x.filter((i) => i !== r.id))} />}
            <div className="shrink-0 self-center"><Photo name={r.name} src={r.imageUrl} size="h-28 w-28" /></div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {r.isBundle && <Tag tone="warning">بندل / طقم</Tag>}
                <h3 className="text-base font-semibold leading-snug"><Link to="/products/$productId" params={{ productId: r.id }} className="hover:text-primary hover:underline">{r.name}</Link></h3>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span dir="ltr" className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> EAN <span className="num">{[...new Set(r.listings.map((l) => l.external_ean).filter(Boolean))].join(" · ") || r.ean || "—"}</span></span>
                <span>المرجع الموحّد: <b dir="ltr" className="font-mono text-foreground">{r.masterReference || "غير محدد"}</b></span>
                <span>{[...new Set(r.listings.map((l) => cat.chanLabel(l.channel_id)))].join("، ")}</span>
                <span>{fulfil}</span>
              </div>
              {(() => { const m = resolveMaster(r); const bm = ["brand", "model"].map((k) => m.find((a) => a.key === k)).filter((a) => a?.value && a.status === "confirmed").map((a) => a!.value).join(" · "); return bm ? <div className="text-xs font-medium">{bm}</div> : null; })()}
              <TraitBadges listings={r.listings} compact />
              <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                <span><b className="num text-foreground">{r.listings.length}</b> عرض bol</span>
                {(() => { const st = SYNC_AR[unified(r, cat.rows).state]; return <Tag tone={st[1]}>{st[0]}</Tag>; })()}
                {r.price != null && <span className="num">€ {r.price.toFixed(2)}</span>}
                <span>{r.listings.some((l) => l.for_sale !== false) ? "معروض للبيع" : "معلّق"}</span>
                {!r.isBundle && usedIn(r) > 0 && <span>يُستخدم في <b className="num text-foreground">{usedIn(r)}</b> بندل</span>}
                {r.familyName && <span>العائلة: <b className="text-foreground">{r.familyName}</b></span>}
              </div>
              {bp?.limiting && <div className="text-xs text-muted-foreground">العنصر المحدِّد: <b className="text-foreground">{bp.limiting.source?.name ?? bp.limiting.name}</b> (× {bp.limiting.qty})</div>}
              {alerts.length > 0 && <div className="flex flex-wrap gap-1.5">{alerts.map(([t, tone]) => <Tag key={t} tone={tone}>{t}</Tag>)}</div>}
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
              <Stat label="فعلي" v={phys} />
              <Stat label="محجوز" v={res} />
              <Stat label={r.isBundle ? "يمكن تجهيز" : "المتاح الموحد"} v={avail} strong />

            </div>
            <div className="shrink-0"><Button asChild><Link to="/products/$productId" params={{ productId: r.id }}>فتح المنتج</Link></Button></div>
          </article>;
        })}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>السابق</Button>
          <span className="text-sm num">صفحة {current} من {pages}</span>
          <Button size="sm" variant="outline" disabled={current === pages} onClick={() => setPage(current + 1)}>التالي</Button>
        </div>
      )}
      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm">تم اختيار <b className="num">{picked.length}</b> بطاقة</span>
           <Button size="sm" disabled={picked.length < 2} onClick={() => setMergeRows(cat.catalog.filter((r) => picked.includes(r.id)))}>ربط العروض بنفس المنتج</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked([])}>إلغاء</Button>
        </div>
      )}
      <SameProductDialog rows={mergeRows} chanLabel={cat.chanLabel} onClose={() => setMergeRows(null)} onDone={() => setPicked([])} />
      <BundleEditor product={bundle} onClose={() => setBundle(null)} />
      <ReviewDialog row={review} onClose={() => setReview(null)} all={cat.rows} chanLabel={cat.chanLabel} />
    </Page>
  );
}

function ReviewDialog({ row, onClose, all, chanLabel }: { row: CatalogRow | null; onClose: () => void; all: CatalogRow[]; chanLabel: (id: string) => string }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: async () => {
      for (const l of row!.listings.filter((x) => x.mapping_status !== "CONFIRMED")) await confirmListing(l.id, target[l.id] ?? row!.id);
    },
    onSuccess: () => { toast.success("تم تأكيد الربط"); qc.invalidateQueries(); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) { setTarget({}); onClose(); } }}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>ربط منتج bol بمنتجنا</DialogTitle>
          <DialogDescription>اقترحنا الربط لأن الـ EAN متطابق. تأكد أنه نفس المنتج، أو اختر منتجاً آخر.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {row?.listings.map((l) => (
            <div key={l.id} className="grid gap-2 rounded-md border p-3 text-sm">
              <div className="flex justify-between"><span className="font-medium">{chanLabel(l.channel_id)}</span><span className="text-xs text-muted-foreground">{l.fulfillment_method === "FBB" ? "تشحنه bol.com" : "يُشحن من مستودعنا"}</span></div>
              <div className="text-xs text-muted-foreground" dir="ltr">{l.title ?? "—"} · EAN {l.external_ean ?? "—"} · {l.reference ?? l.external_offer_id}</div>
              {l.mapping_status === "CONFIRMED" ? <Tag tone="success">مؤكد</Tag> : (
                <div className="flex items-center gap-2"><span>←</span>
                  <select className={sel} value={target[l.id] ?? row.id} onChange={(e) => setTarget({ ...target, [l.id]: e.target.value })}>
                    {all.map((p) => <option key={p.id} value={p.id}>{p.name}{p.ean ? ` · ${p.ean}` : ""}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter><Button size="lg" disabled={m.isPending} onClick={() => m.mutate()}>تأكيد</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function Stat({ label, v, strong, note }: { label: string; v: number | null; strong?: boolean; note?: string }) {
  return <div className="min-w-16 rounded-lg bg-muted/40 px-2 py-1.5">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className={`num ${strong ? "text-lg font-semibold text-stock-available" : "text-base font-medium"}`}>{v == null ? "—" : n(v)}</div>
    {note && <div className="text-[9px] text-muted-foreground">{note}</div>}
  </div>;
}

function FilterSel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <label className={`flex items-center gap-1.5 rounded-md border px-2 text-xs ${value !== "all" && value !== "name" ? "border-primary bg-accent/50" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <select className="h-8 bg-transparent text-sm outline-none" value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
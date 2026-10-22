import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Store, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  allBomLines,
  allComponents,
  listProductAttributes,
  listFamilies,
  allProducts,
  channelCredentialStatus,
  errMsg,
  listCatalogListings,
  listChannels,
  listProductLinks,
  setBundleContents,
  setChannelCompany,
} from "@/lib/inventory";
import {
  saveBolCredentials,
  startBolImport,
  checkBolImport,
  importDemoOffers,
  syncBolShop,
  enrichBolCatalog,
  syncBolAttributes,
  type ImportSummary,
} from "@/lib/bol.functions";
import { usePermissions } from "@/lib/auth";
import { fmtDate } from "@/components/app/ui-bits";
import { Card, Tag } from "@/components/app/page";
import { F, sel, n, Photo } from "@/components/app/merchant";
import { suggestComponents, confLabel } from "@/lib/product-intelligence";

export function useCatalog() {
  const prods = useQuery({ queryKey: ["products-all"], queryFn: allProducts });
  const links = useQuery({ queryKey: ["product-links"], queryFn: listProductLinks });
  const listings = useQuery({ queryKey: ["catalog-listings"], queryFn: listCatalogListings });
  const chans = useQuery({ queryKey: ["channels"], queryFn: listChannels });
  const comps = useQuery({ queryKey: ["components-all"], queryFn: allComponents });
  const bom = useQuery({ queryKey: ["bom-all"], queryFn: allBomLines });
  const attrs = useQuery({ queryKey: ["product-attributes"], queryFn: listProductAttributes });
  const fams = useQuery({ queryKey: ["product-families"], queryFn: listFamilies });
  const loaded =
    prods.isSuccess &&
    links.isSuccess &&
    listings.isSuccess &&
    chans.isSuccess &&
    comps.isSuccess &&
    bom.isSuccess;
  const channels = chans.data ?? [];
  const chanLabel = (id: string) => {
    const i = channels.findIndex((c) => c.id === id);
    return channels[i]?.account_label ?? `الحساب ${i + 1}`;
  };
  const rows = (prods.data ?? []).map((p) => {
    const link = (links.data ?? []).find((l) => l.id === p.id);
    const ls = (listings.data ?? []).filter((l) => l.product_id === p.id);
    const comp = link?.stock_component_id
      ? (comps.data ?? []).find((c) => c.id === link.stock_component_id)
      : undefined;
    const contents = (bom.data ?? [])
      .filter((b) => b.product_id === p.id)
      .map((b) => {
        const owner = (links.data ?? []).find((l) => l.stock_component_id === b.component_id);
        const ownerName = (prods.data ?? []).find((x) => x.id === owner?.id)?.name;
        return {
          component_id: b.component_id,
          product_id: owner?.id ?? null,
          qty: b.quantity_required,
          name: ownerName ?? (comps.data ?? []).find((c) => c.id === b.component_id)?.name ?? "",
        };
      });
    const prices = ls
      .map((l) => l.unit_price)
      .filter((x): x is number => typeof x === "number" && x > 0);
    return {
      ...p,
      id: p.id!,
      listings: ls,
      comp,
      contents,
      isBundle: p.product_type === "BUNDLE",
      imageUrl: link?.image_url ?? null,
      familyId: (link as { family_id?: string | null } | undefined)?.family_id ?? null,
      familyName:
        (fams.data ?? []).find(
          (x) => x.id === (link as { family_id?: string | null } | undefined)?.family_id,
        )?.name ?? null,
      relationshipType: ((link as { relationship_type?: string | null } | undefined)
        ?.relationship_type ?? null) as "MULTIPACK" | "BUNDLE" | "KIT" | "SET" | null,
      relationshipStatus:
        (link as { relationship_status?: string } | undefined)?.relationship_status ?? "none",
      storedAttrs: (attrs.data ?? []).filter((a) => a.product_id === p.id),
      familyKey: (link as { family_key?: string | null } | undefined)?.family_key ?? null,
      masterReference:
        (link as { master_reference?: string | null } | undefined)?.master_reference ?? null,
      primaryListingId:
        (link as { primary_listing_id?: string | null } | undefined)?.primary_listing_id ?? null,
      price: prices.length ? Math.min(...prices) : null,
      accounts: [...new Set(ls.map((l) => l.channel_id))],
      needsReview: ls.some((l) => l.mapping_status !== "CONFIRMED"),
    };
  });
  const catalog = rows.filter((r) => r.listings.length > 0);
  const imported = channels.some((c) => c.last_product_sync_at);
  return { loaded, rows, catalog, channels, chanLabel, imported, listings: listings.data ?? [] };
}
export type CatalogRow = ReturnType<typeof useCatalog>["rows"][number];

// ---------- "هذا المنتج يتكون من" ----------
export function BundleEditor({
  product,
  onClose,
}: {
  product: CatalogRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { rows } = useCatalog();
  const [lines, setLines] = useState<{ pid: string; qty: string }[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!product) return;
    setRequestId(`bundle:${crypto.randomUUID()}`);
    const existing = product.isBundle
      ? product.contents
          .filter((c) => c.product_id)
          .map((c) => ({ pid: c.product_id!, qty: String(c.qty) }))
      : [];
    setLines(existing.length ? existing : [{ pid: "", qty: "1" }]);
    setQ("");
    setShowSearch(!!existing.length);
  }, [product]);
  const [requestId, setRequestId] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const suggested = product ? suggestComponents(product, rows) : [];
  const options = rows.filter(
    (r) =>
      r.id !== product?.id &&
      !r.isBundle &&
      r.active &&
      (!q || `${r.name} ${r.ean ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const valid = lines.filter((l) => l.pid && parseInt(l.qty, 10) > 0);
  const preview = valid.length
    ? Math.min(
        ...valid.map((l) => {
          const r = rows.find((x) => x.id === l.pid);
          return Math.floor(Math.max(r?.comp?.available_qty ?? 0, 0) / parseInt(l.qty, 10));
        }),
      )
    : 0;
  const m = useMutation({
    mutationFn: () =>
      setBundleContents(
        product!.id,
        valid.map((l) => ({ product_id: l.pid, qty: parseInt(l.qty, 10) })),
        requestId,
      ),
    onSuccess: () => {
      toast.success("تم حفظ مكوّنات البندل");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>هذا المنتج يتكون من:</DialogTitle>
          <DialogDescription>
            {product?.name} — اختر من منتجاتك المسحوبة من bol.com.
          </DialogDescription>
        </DialogHeader>
        {suggested.length > 0 && (
          <div className="rounded-lg border bg-accent/30 p-3">
            <div className="mb-2 text-sm font-semibold">مكوّنات مقترحة</div>
            <div className="grid max-h-64 gap-2 overflow-y-auto">
              {suggested.map((s) => {
                const used = lines.some((l) => l.pid === s.row.id);
                return (
                  <div
                    key={s.row.id}
                    className="flex items-start gap-2 rounded-md border bg-card p-2"
                  >
                    <Photo name={s.row.name} src={s.row.imageUrl} size="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium">{s.row.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {confLabel[s.confidence]} ·{" "}
                        {s.evidence
                          .filter((e) => e.ok)
                          .map((e) => e.text)
                          .join(" · ")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        المتاح: <b className="num">{n(s.row.comp?.available_qty ?? 0)}</b>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={used ? "secondary" : "default"}
                      disabled={used}
                      onClick={() =>
                        setLines([
                          ...lines.filter((l) => l.pid),
                          { pid: s.row.id, qty: String(s.qty) },
                        ])
                      }
                    >
                      {used ? "مضاف" : `استخدام كمكوّن (${s.qty}×)`}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!showSearch && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => setShowSearch(true)}
          >
            اختيار منتج آخر…
          </Button>
        )}
        {showSearch && (
          <Input placeholder="بحث عن منتج…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        <div className="grid gap-2">
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
                value={l.pid}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, pid: e.target.value } : x)))
                }
              >
                <option value="">اختر منتجاً…</option>
                {[...options, ...rows.filter((r) => r.id === l.pid && !options.includes(r))].map(
                  (r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.ean ? ` · ${r.ean}` : ""}
                    </option>
                  ),
                )}
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
            onClick={() => setLines([...lines, { pid: "", qty: "1" }])}
          >
            <Plus className="h-4 w-4" /> إضافة منتج آخر
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="text-muted-foreground">بحسب مخزونك الحالي يمكنك بيع:</div>
          <div className="mt-1 text-2xl font-semibold text-stock-available num">{n(preview)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            لن يُفعَّل أي بندل قبل الضغط على «حفظ». تغيير داخلي فقط — لا يُرسل شيء إلى bol.
          </div>
        </div>
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <div>مثال: عبوة 10 غاز = 10 × Gas Bottle</div>
          <div>طقم غاز + شعلة = 4 × Gas Bottle + 1 × Burner</div>
        </div>
        <DialogFooter>
          <Button size="lg" disabled={!valid.length || m.isPending} onClick={() => m.mutate()}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- bol accounts ----------
export function AccountCards({ compact = false }: { compact?: boolean }) {
  const perm = usePermissions();
  const qc = useQueryClient();
  const { channels, listings } = useCatalog();
  const creds = useQuery({ queryKey: ["cred-status"], queryFn: channelCredentialStatus });
  const [connect, setConnect] = useState<{ id: string; label: string } | null>(null);
  const [companyFor, setCompanyFor] = useState<{
    id: string;
    label: string;
    company: Company;
  } | null>(null);
  const [summary, setSummary] = useState<Record<string, ImportSummary>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const start = useServerFn(startBolImport);
  const check = useServerFn(checkBolImport);
  const demo = useServerFn(importDemoOffers);
  const shop = useServerFn(syncBolShop);
  const enrich = useServerFn(enrichBolCatalog);
  const attrs = useServerFn(syncBolAttributes);

  const note = (id: string, text: string) => setProgress((p) => ({ ...p, [id]: text }));

  // اسم المنتج الحقيقي + الصورة + السعر من bol، على دفعات
  async function details(channelId: string, force: boolean) {
    let done = 0;
    for (let i = 0; i < 200; i++) {
      const r = await enrich({ data: { channelId, limit: 30, force } });
      done += r.processed;
      note(channelId, `جارٍ تحديث الأسماء والصور والأسعار… ${done} منتج`);
      qc.invalidateQueries({ queryKey: ["catalog-listings"] });
      qc.invalidateQueries({ queryKey: ["product-links"] });
      qc.invalidateQueries({ queryKey: ["products-all"] });
      if (r.done || r.processed === 0) break;
    }
    // اللون وعدد القطع في العبوة من كتالوج bol
    for (let i = 0; i < 100; i++) {
      const r = await attrs({ data: { channelId, limit: 40 } });
      note(channelId, `جارٍ سحب اللون وعدد القطع… باقي ${r.remaining}`);
      if (r.done) break;
    }
    qc.invalidateQueries({ queryKey: ["catalog-listings"] });
    note(channelId, "");
    return done;
  }

  async function refreshDetails(channelId: string, force: boolean) {
    setBusy(channelId);
    try {
      await shop({ data: { channelId } });
      const done = await details(channelId, force);
      toast.success(`تم تحديث بيانات ${done} منتج من bol.com`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
      note(channelId, "");
    } finally {
      setBusy(null);
    }
  }

  async function pull(channelId: string, useDemo: boolean) {
    setBusy(channelId);
    try {
      let res: ImportSummary;
      if (useDemo) res = await demo({ data: { channelId } });
      else {
        const { processId } = await start({ data: { channelId } });
        toast.info("bol.com يجهّز قائمة منتجاتك… قد يستغرق ذلك دقيقة");
        note(channelId, "bol.com يجهّز قائمة منتجاتك…");
        let out: Awaited<ReturnType<typeof check>> | null = null;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          out = await check({ data: { channelId, processId } });
          if (out.state === "done") break;
        }
        if (!out || out.state !== "done")
          throw new Error("bol.com لم ينهِ التجهيز بعد. حاول مرة أخرى بعد قليل.");
        res = out.result;
      }
      setSummary((s) => ({ ...s, [channelId]: res }));
      toast.success(
        `تم سحب ${res.imported} منتج من حساب bol · ${res.needs_review} بحاجة ربط/مراجعة · ${res.bundles} محدد كبندل`,
        { duration: 8000 },
      );
      qc.invalidateQueries();
      if (!useDemo) {
        await shop({ data: { channelId } });
        await details(channelId, false);
        qc.invalidateQueries();
      }
    } catch (e) {
      toast.error(errMsg(e));
      note(channelId, "");
      qc.invalidateQueries();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {channels.map((c, i) => {
          const cred = (creds.data ?? []).find((x) => x.channel_id === c.id);
          const count = listings.filter((l) => l.channel_id === c.id).length;
          const connected = c.status === "connected" && cred?.status === "verified";
          const s = summary[c.id];
          const label = c.retailer_name ?? `bol.com الحساب ${i + 1}`;
          const info = (c.retailer_info ?? {}) as {
            retailerRating?: { rating?: number | string } & Record<string, unknown>;
            registrationDate?: string;
            topRetailer?: boolean;
            ratingMethod?: string;
          };
          const rating = info.retailerRating?.rating;
          const company = ((c as { company?: Company }).company ?? {}) as Company;
          return (
            <Card key={c.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {company.logo ? (
                    <img src={company.logo} alt="" className="h-10 w-10 rounded object-contain" />
                  ) : (
                    <Store className="h-7 w-7 text-primary" />
                  )}
                  <div>
                    <div className="text-lg font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      bol.com الحساب {i + 1}
                      {c.retailer_id ? ` · رقم التاجر ${c.retailer_id}` : ""}
                    </div>
                    {c.is_demo && (
                      <div className="text-xs text-warning-foreground">بيانات تجريبية</div>
                    )}
                  </div>
                </div>
                {connected ? (
                  <Tag tone="success">متصل</Tag>
                ) : c.status === "error" ? (
                  <Tag tone="danger">خطأ في الربط</Tag>
                ) : (
                  <Tag>غير متصل</Tag>
                )}
              </div>
              {!compact && (
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Client ID</dt>
                  <dd dir="ltr" className="text-end">
                    {cred ? `••••${cred.client_id_last4}` : "غير محفوظ"}
                  </dd>
                  <dt className="text-muted-foreground">المنتجات المسحوبة</dt>
                  <dd className="num">{count}</dd>
                  {c.retailer_name && (
                    <>
                      <dt className="text-muted-foreground">اسم المتجر لدى bol</dt>
                      <dd className="text-end">{c.retailer_name}</dd>
                    </>
                  )}
                  {c.retailer_id && (
                    <>
                      <dt className="text-muted-foreground">رقم التاجر (Retailer ID)</dt>
                      <dd className="num text-end">{c.retailer_id}</dd>
                    </>
                  )}
                  {info.registrationDate && (
                    <>
                      <dt className="text-muted-foreground">تاريخ التسجيل لدى bol</dt>
                      <dd className="num text-end">{info.registrationDate}</dd>
                    </>
                  )}
                  {rating != null && (
                    <>
                      <dt className="text-muted-foreground">تقييم المتجر لدى bol</dt>
                      <dd className="num">{rating} / 10</dd>
                    </>
                  )}
                  {info.retailerRating &&
                    Object.entries(info.retailerRating)
                      .filter(([k, v]) => k !== "rating" && typeof v === "number")
                      .map(([k, v]) => [
                        <dt key={`${k}-t`} className="text-xs text-muted-foreground" dir="ltr">
                          {k}
                        </dt>,
                        <dd key={k} className="num text-xs">
                          {String(v)}
                        </dd>,
                      ])}
                  {info.topRetailer != null && (
                    <>
                      <dt className="text-muted-foreground">Top Retailer</dt>
                      <dd>{info.topRetailer ? "نعم" : "لا"}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">آخر سحب للمنتجات</dt>
                  <dd>{c.last_product_sync_at ? fmtDate(c.last_product_sync_at) : "لم يتم بعد"}</dd>
                  <dt className="text-muted-foreground">آخر سحب للطلبات</dt>
                  <dd>{c.last_order_sync_at ? fmtDate(c.last_order_sync_at) : "لم يتم بعد"}</dd>
                </dl>
              )}
              {!compact && <CompanyDetails company={company} />}
              {c.status === "error" && c.last_sync_message && (
                <p className="rounded bg-destructive/10 p-2 text-xs text-destructive" dir="ltr">
                  {c.last_sync_message}
                </p>
              )}
              {progress[c.id] && (
                <p className="rounded bg-accent/60 p-2 text-xs">{progress[c.id]}</p>
              )}
              {s && (
                <div className="rounded-lg bg-success/10 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success" /> تم سحب {s.imported} منتج من
                    حساب bol
                  </div>
                  <div>{s.needs_review} منتج بحاجة ربط/مراجعة</div>
                  <div>{s.bundles} منتج محدد كبندل</div>
                </div>
              )}
              {perm.isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    variant={connected ? "outline" : "default"}
                    onClick={() => setConnect({ id: c.id, label: `bol.com الحساب ${i + 1}` })}
                  >
                    {connected ? "تغيير بيانات الربط" : "ربط الحساب"}
                  </Button>
                  <Button
                    size="lg"
                    variant={connected ? "default" : "outline"}
                    disabled={!connected || busy === c.id}
                    onClick={() => pull(c.id, false)}
                  >
                    {busy === c.id ? "جارٍ العمل…" : "سحب المنتجات الآن"}
                  </Button>
                  {connected && count > 0 && (
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={busy === c.id}
                      onClick={() => refreshDetails(c.id, true)}
                    >
                      تحديث الأسماء والصور والأسعار
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setCompanyFor({ id: c.id, label, company })}
                  >
                    بيانات الشركة
                  </Button>
                  {count > 0 && (
                    <Button size="lg" variant="ghost" asChild>
                      <Link to="/products">عرض المنتجات</Link>
                    </Button>
                  )}
                </div>
              )}
              {perm.isAdmin && !connected && (
                <button
                  className="text-start text-xs text-muted-foreground underline"
                  disabled={busy === c.id}
                  onClick={() => pull(c.id, true)}
                >
                  ليس لديك بيانات الربط الآن؟ جرّب ببيانات تجريبية
                </button>
              )}
            </Card>
          );
        })}
      </div>
      <ConnectDialog target={connect} onClose={() => setConnect(null)} />
      <CompanyDialog target={companyFor} onClose={() => setCompanyFor(null)} />
    </>
  );
}

function ConnectDialog({
  target,
  onClose,
}: {
  target: { id: string; label: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveBolCredentials);
  const [cid, setCid] = useState("");
  const [secret, setSecret] = useState("");
  useEffect(() => {
    setCid("");
    setSecret("");
  }, [target]);
  const m = useMutation({
    mutationFn: () =>
      save({ data: { channelId: target!.id, clientId: cid.trim(), clientSecret: secret.trim() } }),
    onSuccess: (r) => {
      qc.invalidateQueries();
      if (r.ok) {
        toast.success("تم الربط بنجاح — يمكنك الآن سحب المنتجات");
        onClose();
      } else toast.error(`رفض bol.com بيانات الدخول: ${r.error}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>ربط {target?.label}</DialogTitle>
          <DialogDescription>
            من bol.com: Partner Platform ← الإعدادات ← API ← أنشئ بيانات دخول Retailer API.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <F label="Client ID">
            <Input
              dir="ltr"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              autoComplete="off"
            />
          </F>
          <F label="Client Secret" help="يُحفظ مشفّراً على الخادم ولن يظهر مرة أخرى.">
            <Input
              dir="ltr"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="new-password"
            />
          </F>
          <div className="flex gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" /> لن نرسل أي كميات إلى bol.com الآن. نقرأ
            منتجاتك فقط.
          </div>
        </div>
        <DialogFooter>
          <Button
            size="lg"
            disabled={cid.trim().length < 8 || secret.trim().length < 8 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "جارٍ التحقق…" : "ربط واختبار"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type Company = {
  [k: string]: string | undefined;
  logo?: string | undefined;
  legal_name?: string | undefined;
  trade_name?: string;
  kvk?: string;
  vat?: string;
  eori?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  iban?: string;
  bic?: string;
  bank?: string;
};

const COMPANY_FIELDS: [keyof Company, string, boolean?][] = [
  ["legal_name", "اسم الشركة النظامي"],
  ["trade_name", "الاسم التجاري"],
  ["kvk", "رقم KvK", true],
  ["vat", "رقم الضريبة (BTW / VAT)", true],
  ["eori", "رقم EORI (اختياري)", true],
  ["street", "الشارع ورقم البناء"],
  ["postal_code", "الرمز البريدي", true],
  ["city", "المدينة"],
  ["country", "الدولة"],
  ["email", "البريد الإلكتروني", true],
  ["phone", "الهاتف", true],
  ["website", "الموقع", true],
  ["iban", "IBAN", true],
  ["bic", "BIC", true],
  ["bank", "اسم البنك"],
];

export function CompanyDetails({ company }: { company: Company }) {
  const filled = COMPANY_FIELDS.filter(([k]) => company[k]);
  if (!filled.length && !company.logo)
    return (
      <p className="text-xs text-muted-foreground">لم تُضف بيانات الشركة بعد (للفواتير لاحقاً).</p>
    );
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-3">
        {company.logo && (
          <img src={company.logo} alt="" className="h-12 w-12 rounded object-contain" />
        )}
        <div className="font-semibold">
          {company.legal_name ?? company.trade_name ?? "بيانات الشركة"}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        {filled
          .filter(([k]) => k !== "legal_name")
          .flatMap(([k, l, ltr]) => [
            <dt key={`${k}-t`} className="text-muted-foreground">
              {l}
            </dt>,
            <dd key={k} dir={ltr ? "ltr" : undefined} className="text-end">
              {company[k]}
            </dd>,
          ])}
      </dl>
    </div>
  );
}

async function resizeLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const s = Math.min(1, 400 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/png");
}

export function CompanyDialog({
  target,
  onClose,
}: {
  target: { id: string; label: string; company: Company } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Company>({});
  useEffect(() => {
    setF(target?.company ?? {});
  }, [target]);
  const m = useMutation({
    mutationFn: () => setChannelCompany(target!.id, f),
    onSuccess: () => {
      toast.success("تم حفظ بيانات الشركة");
      qc.invalidateQueries({ queryKey: ["channels"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>بيانات الشركة · {target?.label}</DialogTitle>
          <DialogDescription>
            bol.com لا يرسل هذه البيانات عبر الربط، لذلك تُدخل مرة واحدة هنا. ستُستخدم لاحقاً في
            الفواتير.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <F label="الشعار (Logo)">
            <div className="flex items-center gap-3">
              {f.logo && (
                <img src={f.logo} alt="" className="h-16 w-16 rounded border object-contain" />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setF({ ...f, logo: await resizeLogo(file) });
                }}
              />
              {f.logo && (
                <Button variant="ghost" size="sm" onClick={() => setF({ ...f, logo: undefined })}>
                  إزالة
                </Button>
              )}
            </div>
          </F>
          <div className="grid gap-3 md:grid-cols-2">
            {COMPANY_FIELDS.map(([k, l, ltr]) => (
              <F key={k} label={l}>
                <Input
                  dir={ltr ? "ltr" : undefined}
                  value={f[k] ?? ""}
                  onChange={(e) => setF({ ...f, [k]: e.target.value || undefined })}
                />
              </F>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button size="lg" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

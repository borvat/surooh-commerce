import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Page } from "@/components/app/page";
import { BundleEditor, useCatalog, type CatalogRow } from "@/components/app/catalog";
import { ConfBadge, EvidenceList, ProductColumn, SameProductDialog } from "@/components/app/review-cards";
import { analyze, keyOf, type MultipackSuggestion } from "@/lib/product-intelligence";
import { errMsg, listReviewDecisions, saveReviewDecision, setBundleContents, setFamily } from "@/lib/inventory";
import { usePermissions } from "@/lib/auth";
import { n } from "@/components/app/merchant";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [
    { title: "مراجعة المنتجات · QNAN" }, { name: "description", content: "اقتراحات نفس المنتج والبندلات والنسخ مع الأدلة والتعارضات ودرجة الثقة." },
    { property: "og:title", content: "مراجعة المنتجات · QNAN" }, { property: "og:description", content: "اقتراحات نفس المنتج والبندلات والنسخ مع الأدلة والتعارضات ودرجة الثقة." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ReviewPage,
});

function ReviewPage() {
  const cat = useCatalog();
  const perm = usePermissions();
  const qc = useQueryClient();
  const decisions = useQuery({ queryKey: ["review-decisions"], queryFn: listReviewDecisions });
  const rejected = useMemo(() => new Set((decisions.data ?? []).filter((d) => d.decision === "rejected").map((d) => keyOf(d.kind, d.product_ids))), [decisions.data]);
  const a = useMemo(() => analyze(cat.catalog, rejected), [cat.catalog, rejected]);
  const [same, setSame] = useState<CatalogRow[] | null>(null);
  const [edit, setEdit] = useState<CatalogRow | null>(null);
  const [limit, setLimit] = useState(20);

  async function reject(kind: "same" | "multipack" | "variant", ids: string[]) {
    try { await saveReviewDecision(kind, ids, "rejected"); toast.success("لن نقترحه مجدداً"); qc.invalidateQueries({ queryKey: ["review-decisions"] }); } catch (e) { toast.error(errMsg(e)); }
  }
  async function confirmMultipack(s: MultipackSuggestion) {
    if (!confirm(`سيصبح كل منتج بندلاً يسحب من «${s.base.name}».\n${s.items.map((i) => `${i.row.name} = ${i.ratio} × المفرد`).join("\n")}\nتغيير داخلي فقط — لا يُرسل شيء إلى bol.`)) return;
    try {
      for (const i of s.items) await setBundleContents(i.row.id, [{ product_id: s.base.id, qty: i.ratio }]);
      await saveReviewDecision("multipack", [s.base.id, ...s.items.map((i) => i.row.id)], "confirmed");
      toast.success("تم تأكيد البندلات"); qc.invalidateQueries();
    } catch (e) { toast.error(errMsg(e)); }
  }
  async function groupVariants(rows: CatalogRow[]) {
    try {
      await setFamily(rows.map((r) => r.id), rows[0]!.familyKey ?? crypto.randomUUID());
      await saveReviewDecision("variant", rows.map((r) => r.id), "confirmed");
      toast.success("تم التجميع كعائلة — مخزون كل نسخة يبقى مستقلاً"); qc.invalidateQueries();
    } catch (e) { toast.error(errMsg(e)); }
  }

  const more = (len: number) => len > limit && <Button variant="outline" className="w-full" onClick={() => setLimit(limit + 20)}>عرض المزيد ({len - limit})</Button>;

  return <Page title="مراجعة المنتجات" intro="نقارن منتجاتك بعدة إشارات: العلامة، العائلة، الموديل، المقاس، العبوة، اللون ومحتويات bol. لا يتغيّر شيء قبل تأكيدك، ولا يُرسل أي شيء إلى bol.">
    {!cat.loaded ? <p className="text-muted-foreground">جارٍ التحليل…</p> : <Tabs defaultValue="same" dir="rtl" onValueChange={() => setLimit(20)}>
      <TabsList className="mb-4 flex h-auto flex-wrap">
        <TabsTrigger value="same">نفس المنتج <span className="ms-1 num">({a.same.length})</span></TabsTrigger>
        <TabsTrigger value="multi">بندلات / Multipacks <span className="ms-1 num">({a.multipack.length})</span></TabsTrigger>
        <TabsTrigger value="var">Variants <span className="ms-1 num">({a.variants.length})</span></TabsTrigger>
        <TabsTrigger value="review">بحاجة مراجعة <span className="ms-1 num">({a.review.length})</span></TabsTrigger>
      </TabsList>

      <TabsContent value="same" className="grid gap-4">
        <p className="text-sm text-muted-foreground">نفس القطعة الفعلية بعروض أو EAN أو حسابات مختلفة ← مخزون واحد. المخزون لا يُجمع أبداً.</p>
        {!a.same.length && <Empty />}
        {a.same.slice(0, limit).map((s) => <Card key={s.key} conf={<ConfBadge c={s.confidence} />} title={`${s.rows.length} منتجات تبدو نفس القطعة`}
          primary={perm.isAdmin && <Button disabled={s.critical} onClick={() => setSame(s.rows)}>ربط العروض بنفس المنتج</Button>}
          menu={perm.isAdmin && <DropdownMenuItem onClick={() => reject("same", s.rows.map((r) => r.id))}>ليسا نفس المنتج</DropdownMenuItem>}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{s.rows.map((r) => <ProductColumn key={r.id} r={r} chanLabel={cat.chanLabel} />)}</div>
          <div className="mt-3"><div className="mb-1 text-sm font-semibold">لماذا نعتقد أنهما نفس المنتج؟</div><EvidenceList items={s.evidence} /></div>
        </Card>)}
        {more(a.same.length)}
      </TabsContent>

      <TabsContent value="multi" className="grid gap-4">
        <p className="text-sm text-muted-foreground">نفس المنتج بعبوات مختلفة ← العبوة الأكبر بندل يسحب من المفرد.</p>
        {!a.multipack.length && <Empty />}
        {a.multipack.slice(0, limit).map((s) => <Card key={s.key} conf={<ConfBadge c={s.confidence} />} title="اقتراح بندل / Multipack"
          primary={perm.isAdmin && <Button disabled={s.conflicts.length > 0} onClick={() => confirmMultipack(s)}>تأكيد البندل</Button>}
          menu={perm.isAdmin && <>{s.items.map((i) => <DropdownMenuItem key={i.row.id} onClick={() => setEdit(i.row)}>تعديل المحتويات: {i.row.name?.slice(0, 30)}</DropdownMenuItem>)}
            <DropdownMenuItem onClick={() => reject("multipack", [s.base.id, ...s.items.map((i) => i.row.id)])}>غير مرتبطين</DropdownMenuItem></>}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ProductColumn r={s.base} chanLabel={cat.chanLabel} badge="المنتج الأساسي (المفرد)" />
            {s.items.map((i) => <ProductColumn key={i.row.id} r={i.row} chanLabel={cat.chanLabel} badge={`البندل = ${i.ratio} × الأساسي`} />)}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div><div className="mb-1 text-sm font-semibold">الأدلة</div><EvidenceList items={s.evidence} /></div>
            <div><div className="mb-1 text-sm font-semibold">التركيب المقترح</div>
              {s.items.map((i) => <div key={i.row.id} className="text-sm">{i.row.name?.slice(0, 50)} = <b className="num">{i.ratio}</b> × المفرد → يمكن تجهيز <b className="num">{n(Math.floor(Math.max(s.base.comp?.available_qty ?? 0, 0) / i.ratio))}</b></div>)}
              {s.conflicts.map((c) => <div key={c} className="mt-1 text-sm text-destructive">⚠ {c}</div>)}
            </div>
          </div>
        </Card>)}
        {more(a.multipack.length)}
      </TabsContent>

      <TabsContent value="var" className="grid gap-4">
        <p className="text-sm text-muted-foreground">نفس الموديل بلون أو مقاس مختلف ← منتجات مستقلة. التجميع كعائلة للتنظيم فقط، ولا يشارك المخزون.</p>
        {!a.variants.length && <Empty />}
        {a.variants.slice(0, limit).map((s) => <Card key={s.key} conf={<ConfBadge c={s.confidence} />} title={`عائلة نسخ — ${s.differ.join(" · ")}`}
          primary={perm.isAdmin && <Button onClick={() => groupVariants(s.rows)}>تجميع كعائلة Variants</Button>}
          menu={perm.isAdmin && <DropdownMenuItem onClick={() => reject("variant", s.rows.map((r) => r.id))}>ليست عائلة واحدة</DropdownMenuItem>}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{s.rows.map((r) => <ProductColumn key={r.id} r={r} chanLabel={cat.chanLabel} />)}</div>
        </Card>)}
        {more(a.variants.length)}
      </TabsContent>

      <TabsContent value="review" className="grid gap-3">
        {!a.review.length && <Empty />}
        {a.review.slice(0, limit).map((s) => <Card key={s.key} title={s.row.name ?? ""} primary={<Button asChild variant="outline"><Link to="/products/$productId" params={{ productId: s.row.id }}>مراجعة الربط</Link></Button>}>
          <div className="flex flex-wrap gap-2">{s.reasons.map((r) => <span key={r} className="rounded bg-warning/15 px-2 py-0.5 text-xs">{r}</span>)}</div>
        </Card>)}
        {more(a.review.length)}
      </TabsContent>
    </Tabs>}
    <SameProductDialog rows={same} onClose={() => setSame(null)} chanLabel={cat.chanLabel} />
    <BundleEditor product={edit} onClose={() => setEdit(null)} />
  </Page>;
}

function Empty() { return <div className="rounded-xl border p-8 text-center text-muted-foreground">لا توجد اقتراحات هنا حالياً.</div>; }

function Card({ title, conf, primary, menu, children }: { title: string; conf?: React.ReactNode; primary?: React.ReactNode; menu?: React.ReactNode; children: React.ReactNode }) {
  return <article className="rounded-xl border bg-card p-4 shadow-sm">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><h3 className="font-semibold">{title}</h3>{conf}</div>
      <div className="flex items-center gap-1">{primary}
        {menu && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="خيارات أخرى"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent>{menu}</DropdownMenuContent></DropdownMenu>}
      </div>
    </div>
    {children}
  </article>;
}
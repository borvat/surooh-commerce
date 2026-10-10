import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Photo, n } from "@/components/app/merchant";
import { Tag } from "@/components/app/page";
import type { CatalogRow } from "@/components/app/catalog";
import { compareSame, confLabel, features, type Confidence, type Evidence } from "@/lib/product-intelligence";
import { errMsg, mergeProducts, saveReviewDecision } from "@/lib/inventory";

export function ConfBadge({ c }: { c: Confidence }) {
  return <Tag tone={c === "high" ? "success" : c === "medium" ? "warning" : "danger"}>{confLabel[c]}</Tag>;
}

export function EvidenceList({ items }: { items: Evidence[] }) {
  return <ul className="grid gap-1 text-sm">
    {items.map((e, i) => <li key={i} className={`flex items-start gap-1.5 ${e.ok ? "" : e.critical ? "text-destructive font-medium" : e.warn ? "text-warning-foreground" : "text-muted-foreground"}`}>
      {e.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : e.critical ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : e.warn ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}{e.text}
    </li>)}
  </ul>;
}

/** Compact side-by-side product column for comparison cards. */
export function ProductColumn({ r, chanLabel, badge }: { r: CatalogRow; chanLabel: (id: string) => string; badge?: string }) {
  const f = features(r);
  return <div className="min-w-0 rounded-lg border bg-card p-3">
    <div className="flex gap-3">
      <Photo name={r.name} src={r.imageUrl} size="h-20 w-20" />
      <div className="min-w-0 flex-1">
        {badge && <div className="mb-1 text-[11px] font-semibold text-primary">{badge}</div>}
        <div className="line-clamp-2 text-sm font-medium">{r.name}</div>
        <div className="mt-1 num text-[11px] text-muted-foreground" dir="ltr">EAN {r.ean ?? r.listings[0]?.external_ean ?? "—"}</div>
      </div>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      <dt className="text-muted-foreground">العلامة</dt><dd>{f.brand || "—"}</dd>
      <dt className="text-muted-foreground">الموديل</dt><dd dir="ltr" className="text-start">{f.model || "—"}</dd>
      <dt className="text-muted-foreground">اللون</dt><dd>{f.color || "—"}</dd>
      <dt className="text-muted-foreground">العبوة</dt><dd className="num">{f.pack ? `${f.pack} قطعة` : "غير معروف"}</dd>
      <dt className="text-muted-foreground">المقاس</dt><dd dir="ltr" className="text-start">{f.size || "—"}</dd>
      <dt className="text-muted-foreground">الحساب</dt><dd>{[...new Set(r.listings.map((l) => chanLabel(l.channel_id)))].join("، ")}</dd>
      <dt className="text-muted-foreground">مخزوننا</dt><dd className="num">{r.comp ? `${n(r.comp.physical_qty)} فعلي` : "غير مضاف"}</dd>
      <dt className="text-muted-foreground">عروض bol</dt><dd className="num">{r.listings.length} · bol يعرض (قراءة فقط) {r.listings.map((l) => l.bol_stock ?? "—").join(" / ")}</dd>
    </dl>
  </div>;
}

/** Link offers to one internal product. Never sums stock; asks for an explicit decision when needed. */
export function SameProductDialog({ rows, onClose, onDone, chanLabel }: { rows: CatalogRow[] | null; onClose: () => void; onDone?: () => void; chanLabel: (id: string) => string }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState("");
  const [choice, setChoice] = useState<string>("");
  const [manual, setManual] = useState("");
  const [refChoice, setRefChoice] = useState("");
  const [refManual, setRefManual] = useState("");
  useEffect(() => { setTarget(rows?.[0]?.id ?? ""); setChoice(""); setManual(""); setRefChoice(""); setRefManual(""); }, [rows]);
  const withStock = (rows ?? []).filter((r) => (r.comp?.physical_qty ?? 0) !== 0);
  const needsDecision = withStock.length > 1;
  const pairs = rows && rows.length > 1 ? rows.slice(1).map((r) => compareSame(rows[0]!, r)) : [];
  const critical = pairs.some((p) => p.critical);
  const evidence = pairs[0]?.evidence ?? [];
  const decided = !needsDecision || (choice === "manual" ? /^\d+$/.test(manual.trim()) : !!choice);
  // ONE master reference: keep a single existing one; otherwise the owner must choose/enter one.
  const masterRefs = [...new Set((rows ?? []).map((r) => r.masterReference?.trim()).filter((x): x is string => !!x))];
  const needsRef = masterRefs.length !== 1;
  const refCandidates = [...new Set([...masterRefs, ...(rows ?? []).flatMap((r) => r.listings.map((l) => l.reference?.trim()).filter((x): x is string => !!x))])];
  const chosenRef = refChoice === "manual" ? refManual.trim() : refChoice;
  const refDecided = !needsRef || !!chosenRef;
  const m = useMutation({
    mutationFn: async () => {
      const sources = rows!.map((r) => r.id).filter((i) => i !== target);
      let stock: { keepTarget?: boolean; stockValue?: number | null } | undefined;
      if (needsDecision) {
        if (choice === "manual") stock = { stockValue: Number(manual) };
        else if (choice === target) stock = { keepTarget: true };
        else stock = { stockValue: rows!.find((r) => r.id === choice)?.comp?.physical_qty ?? 0 };
      }
      await mergeProducts(target, sources, stock, needsRef ? chosenRef : null);
      await saveReviewDecision("same", rows!.map((r) => r.id), "confirmed").catch(() => undefined);
    },
    onSuccess: () => { toast.success("تم ربط العروض بنفس المنتج — لم يُرسل شيء إلى bol"); qc.invalidateQueries(); onDone?.(); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return <Dialog open={!!rows} onOpenChange={(o) => !o && onClose()}>
    <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>ربط العروض بنفس المنتج</DialogTitle>
        <DialogDescription>كل العروض ستسحب من مخزون واحد. المخزون لا يُجمع تلقائياً أبداً.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 md:grid-cols-2">
        {rows?.map((r) => <label key={r.id} className={`cursor-pointer rounded-lg ${target === r.id ? "ring-2 ring-primary" : ""}`}>
          <input type="radio" className="sr-only" checked={target === r.id} onChange={() => setTarget(r.id)} />
          <ProductColumn r={r} chanLabel={chanLabel} badge={target === r.id ? "البطاقة الرئيسية (اسمها وصورتها)" : "اضغط لجعلها الرئيسية"} />
        </label>)}
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 text-sm font-semibold">لماذا نعتقد أنهما نفس المنتج؟</div>
        <EvidenceList items={evidence} />
      </div>
      {critical && <p className="flex items-start gap-2 border-s-4 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />تعارض مؤكد: قيمة أساسية مؤكَّدة من bol أو منك تختلف بين المنتجين. لا يمكن الربط — صحّح البيانات الأساسية أو اعتبرهما بندلاً / نسخة.</p>}
      {!critical && pairs.some((p) => p.evidence.some((e) => e.warn)) && <p className="flex items-start gap-2 border-s-4 border-warning bg-warning/10 px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />اختلاف/تخمين غير مؤكد: بعض القيم مستنتجة من الاسم أو غير معروفة. لا تمنع الربط — القرار لك بعد المقارنة.</p>}
      {needsDecision && !critical && <div className="rounded-lg border-2 border-warning/60 bg-warning/10 p-3">
        <div className="mb-2 text-sm font-semibold">لكل منتج مخزون مستقل — أي رقم هو الصحيح؟</div>
        <div className="grid gap-2 text-sm">
          {withStock.map((r) => <label key={r.id} className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={choice === r.id} onChange={() => setChoice(r.id)} />
            اعتمد مخزون «<span className="line-clamp-1 max-w-72">{r.name}</span>»: <b className="num">{n(r.comp?.physical_qty)}</b></label>)}
          <label className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={choice === "manual"} onChange={() => setChoice("manual")} />
            أدخل العدد الفعلي الصحيح: <Input dir="ltr" className="h-8 w-28 num" type="number" min={0} value={manual} onFocus={() => setChoice("manual")} onChange={(e) => setManual(e.target.value)} /></label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">لن نجمع الأرقام: {withStock.map((r) => n(r.comp?.physical_qty)).join(" + ")} ليس بالضرورة المخزون الحقيقي.</p>
      </div>}
      {!critical && rows && rows.length > 1 && (needsRef ? <div className="rounded-lg border-2 border-warning/60 bg-warning/10 p-3">
        <div className="mb-2 text-sm font-semibold">{masterRefs.length > 1 ? "المراجع الموحّدة مختلفة — اختر مرجعاً واحداً" : "لا يوجد مرجع موحّد — اختر أو أدخل مرجعاً"}</div>
        <div className="grid gap-2 text-sm">
          {refCandidates.map((ref) => <label key={ref} className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={refChoice === ref} onChange={() => setRefChoice(ref)} />
            <span dir="ltr" className="num">{ref}</span>{masterRefs.includes(ref) && <span className="text-xs text-muted-foreground">(مرجع موحّد حالي)</span>}</label>)}
          <label className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={refChoice === "manual"} onChange={() => setRefChoice("manual")} />
            مرجع جديد: <Input dir="ltr" className="h-8 w-40" value={refManual} onFocus={() => setRefChoice("manual")} onChange={(e) => setRefManual(e.target.value)} /></label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">يُحفظ داخلياً فقط — لن يُرسل إلى bol.</p>
      </div> : <p className="text-sm text-muted-foreground">المرجع الموحّد سيبقى: <b dir="ltr" className="num">{masterRefs[0]}</b></p>)}
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={!rows || m.isPending} onClick={async () => {
          try { await saveReviewDecision("same", rows!.map((r) => r.id), "rejected"); toast.success("لن نقترح هذا الربط مجدداً"); qc.invalidateQueries({ queryKey: ["review-decisions"] }); onClose(); } catch (e) { toast.error(errMsg(e)); }
        }}>ليسا نفس المنتج</Button>
        <Button size="lg" disabled={m.isPending || !rows || rows.length < 2 || critical || !decided || !refDecided} onClick={() => m.mutate()}>ربط العروض بنفس المنتج</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
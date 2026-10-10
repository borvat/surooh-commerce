import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/app/page";
import { n } from "@/components/app/merchant";
import { errMsg, setProductMaster } from "@/lib/inventory";
import { unified, SYNC_AR } from "@/lib/unified-stock";
import type { CatalogRow } from "@/components/app/catalog";

/** One product → one stock → one reference → many offers. bol values are observations only. */
export function UnifiedOffers({ row, all, account, canEdit }: { row: CatalogRow; all: CatalogRow[]; account: (id: string) => string; canEdit: boolean }) {
  const u = unified(row, all);
  const [st, tone] = SYNC_AR[u.state];
  const confirmedOffers = u.offers.filter((o) => !o.isPending);
  const pendingOffers = u.offers.filter((o) => o.isPending);
  return <section className="space-y-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-semibold">مخزون واحد ومرجع واحد لكل العروض</h3>
      <Tag tone={tone}>{st}</Tag>
      <span className="text-xs text-muted-foreground">الهدف لكل عرض نشحنه نحن: <b className="num text-foreground">{u.target == null ? "—" : n(Math.min(u.target, 999))}</b> · المرجع <b dir="ltr" className="font-mono text-foreground">{u.masterRef ?? "غير محدد"}</b></span>
    </div>
    <MasterRef row={row} candidates={u.refCandidates} canEdit={canEdit} />
    {confirmedOffers.length > 0 && <OfferTable rows={confirmedOffers} account={account} />}
    {pendingOffers.length > 0 && <div className="space-y-1">
      <h4 className="text-xs font-semibold text-warning-foreground">بانتظار تأكيد الربط ({pendingOffers.length}) — لا تحدد المخزون ولا المرجع حتى التأكيد</h4>
      <OfferTable rows={pendingOffers} account={account} />
    </div>}
    <p className="text-[11px] text-muted-foreground">أرقام bol قراءة فقط (ملاحظة لحالة المتجر)، وليست مخزوناً مستقلاً. لا يُرسل شيء إلى bol — المزامنة معطّلة.</p>
  </section>;
}

function OfferTable({ rows, account }: { rows: ReturnType<typeof unified>["offers"]; account: (id: string) => string }) {
  return <div className="overflow-x-auto rounded border"><table className="w-full text-sm">
    <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["الحساب", "EAN", "كمية bol الحالية", "الكمية المستهدفة", "مرجع bol الحالي", "المرجع المستهدف", "الحالة"].map((h) => <th key={h} className="px-2 py-1.5 text-start">{h}</th>)}</tr></thead>
    <tbody>{rows.map((o) => <tr key={o.l.id} className="border-t">
      <td className="px-2 py-1.5">{account(o.l.channel_id)}</td>
      <td className="px-2 py-1.5 num" dir="ltr">{o.l.external_ean ?? "—"}</td>
      <td className={`px-2 py-1.5 num ${o.qtyOk === false ? "text-destructive font-semibold" : ""}`}>{o.l.bol_stock ?? "—"}</td>
      <td className="px-2 py-1.5 num">{o.targetQty ?? "—"}</td>
      <td className={`px-2 py-1.5 font-mono ${o.refOk === false ? "text-destructive" : ""}`} dir="ltr">{o.l.reference || "فارغ"}</td>
      <td className="px-2 py-1.5 font-mono" dir="ltr">{o.targetRef ?? "—"}</td>
      <td className="px-2 py-1.5"><Tag tone={o.status === "متطابق" ? "success" : o.status === "غير متطابق" ? "danger" : "neutral"}>{o.status}</Tag></td>
    </tr>)}</tbody>
  </table></div>;
}

function MasterRef({ row, candidates, canEdit }: { row: CatalogRow; candidates: string[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [val, setVal] = useState(row.masterReference ?? "");
  const [busy, setBusy] = useState(false);
  if (!canEdit) return null;
  async function save(ref: string) {
    setBusy(true);
    try { await setProductMaster(row.id, row.name ?? "", ref.trim()); await qc.invalidateQueries({ queryKey: ["product-links"] }); toast.success("حُفظ المرجع الموحّد داخلياً — لم يُرسل إلى bol"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2 text-sm">
    <span className="text-muted-foreground">المرجع الموحّد:</span>
    <Input className="h-8 w-40 font-mono" dir="ltr" value={val} onChange={(e) => setVal(e.target.value)} />
    <Button size="sm" variant="outline" disabled={busy || val.trim() === (row.masterReference ?? "")} onClick={() => save(val)}>حفظ</Button>
    {!row.masterReference && candidates.map((c) => <Button key={c} size="sm" variant="ghost" disabled={busy} onClick={() => { setVal(c); save(c); }}>اعتماد <span className="font-mono" dir="ltr">{c}</span> (من bol)</Button>)}
  </div>;
}
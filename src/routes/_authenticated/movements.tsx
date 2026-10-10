import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock, Truck, Wrench, AlertOctagon, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMovements, PAGE_SIZE } from "@/lib/inventory";
import { fmtDate } from "@/components/app/ui-bits";
import { Page, Card } from "@/components/app/page";
import { n } from "@/components/app/merchant";

export const Route = createFileRoute("/_authenticated/movements")({
  head: () => ({ meta: [{ title: "سجل الحركات · QNAN" }, { name: "description", content: "سجل تغييرات المخزون والطلبات في QNAN." }, { property: "og:title", content: "سجل الحركات · QNAN" }, { property: "og:description", content: "سجل تغييرات المخزون والطلبات في QNAN." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: HistoryPage,
});

type Mv = Awaited<ReturnType<typeof listMovements>>["rows"][number];

function sentence(m: Mv) {
  const item = m.components?.name ?? m.components?.sku ?? "";
  const ord = m.orders?.order_number ? `الطلب #${m.orders.order_number}` : "طلب";
  const abs = (v: number) => n(Math.abs(v));
  switch (m.movement_type) {
    case "receipt": return { Icon: ArrowDownCircle, cls: "text-success", t: `تم استلام ${abs(m.physical_delta)} × ${item}` };
    case "return": return { Icon: Undo2, cls: "text-success", t: `مرتجع: ${abs(m.physical_delta)} × ${item} عادت إلى المستودع` };
    case "damaged": return { Icon: AlertOctagon, cls: "text-destructive", t: `تالف: خُصم ${abs(m.physical_delta)} × ${item}` };
    case "adjustment": return { Icon: Wrench, cls: "text-info", t: `تعديل بعد الجرد: ${m.physical_delta > 0 ? "+" : "−"}${abs(m.physical_delta)} × ${item}` };
    case "reservation": return { Icon: Lock, cls: "text-stock-reserved", t: `${ord} حجز ${abs(m.reserved_delta)} × ${item}` };
    case "release": return { Icon: Unlock, cls: "text-muted-foreground", t: `${ord} أُلغي: عاد ${abs(m.reserved_delta)} × ${item} إلى المتاح` };
    case "sale": return { Icon: Truck, cls: "text-foreground", t: `${ord} شُحن: −${abs(m.physical_delta)} × ${item}` };
    default: return { Icon: ArrowUpCircle, cls: "", t: `${m.movement_type} ${item}` };
  }
}

function HistoryPage() {
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["movements", page], queryFn: () => listMovements({ page }) });
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / PAGE_SIZE));
  return (
    <Page title="سجل الحركات" intro="كل ما حدث لمخزونك، بالترتيب. هذا السجل لا يمكن تعديله أو حذفه.">
      <Card className="p-0">
        <ul className="divide-y">
          {(q.data?.rows ?? []).length === 0 && <li className="p-10 text-center text-muted-foreground">{q.isLoading ? "جارٍ التحميل…" : "لا توجد حركات بعد."}</li>}
          {(q.data?.rows ?? []).map((m) => {
            const s = sentence(m);
            return (
              <li key={m.id} className="px-5 py-3">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <s.Icon className={`h-5 w-5 shrink-0 ${s.cls}`} />
                    <span className="flex-1">{s.t}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(m.created_at)}</span>
                  </summary>
                  <div className="mt-2 grid gap-1 ps-8 text-xs text-muted-foreground sm:grid-cols-2">
                    {m.reason && <div>الملاحظة: {m.reason}</div>}
                    {m.reference && <div>المرجع: {m.reference}</div>}
                    <div>في المستودع بعدها: <span className="num">{n(m.physical_after)}</span></div>
                    <div>المحجوز بعدها: <span className="num">{n(m.reserved_after)}</span></div>
                    <div dir="ltr" className="text-start">#{m.id} · {m.movement_type} · Δphys {m.physical_delta} · Δres {m.reserved_delta}</div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </Card>
      {pages > 1 && <div className="mt-3 flex items-center gap-2 text-sm">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>الأحدث</Button>
        <span>{page + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>الأقدم</Button>
      </div>}
    </Page>
  );
}
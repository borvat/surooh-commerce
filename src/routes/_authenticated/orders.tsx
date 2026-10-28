import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelOrder, errMsg, fulfillOrder, listOrders, PAGE_SIZE } from "@/lib/inventory";
import { usePermissions } from "@/lib/auth";
import { fmtDate } from "@/components/app/ui-bits";
import { Page, Table, Empty, Tag } from "@/components/app/page";
import { NewOrderDialog } from "@/components/app/merchant";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "الطلبات · QNAN" }, { name: "description", content: "طلبات البيع والشحن من المستودع أو bol في QNAN." }, { property: "og:title", content: "الطلبات · QNAN" }, { property: "og:description", content: "طلبات البيع والشحن من المستودع أو bol في QNAN." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OrdersPage,
});

const statusAr = { placed: ["بانتظار الشحن", "warning"], fulfilled: ["تم الشحن", "success"], cancelled: ["ملغى", "neutral"] } as const;

function OrdersPage() {
  const perm = usePermissions();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["orders", page, status], queryFn: () => listOrders({ page, status }) });
  const act = useMutation({
    mutationFn: (v: { id: string; kind: "ship" | "cancel" }) => (v.kind === "ship" ? fulfillOrder(v.id) : cancelOrder(v.id)),
    onSuccess: (_d, v) => { toast.success(v.kind === "ship" ? "تم الشحن — خُصمت القطع من المستودع" : "تم الإلغاء — عادت القطع إلى المتاح"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / PAGE_SIZE));
  return (
    <Page
      title="الطلبات"
      intro="طلبات البيع من حساباتك. المخزون الداخلي يتغيّر فقط للطلبات التي «تُشحن من مستودعنا»؛ طلبات «تشحنها bol.com» تُسجَّل فقط."
      
    >
      <div className="mb-4 flex gap-1">
        {[["all", "الكل"], ["placed", "بانتظار الشحن"], ["fulfilled", "تم الشحن"], ["cancelled", "ملغى"]].map(([k, l]) => (
          <Button key={k} size="sm" variant={status === k ? "default" : "outline"} onClick={() => { setStatus(k!); setPage(0); }}>{l}</Button>
        ))}
      </div>
      <Table label="الطلبات" head={["الطلب", "الحساب", "التاريخ", "المنتجات", "طريقة الشحن", "الحالة", ""]}>
        {(q.data?.rows ?? []).length === 0 && <Empty cols={7} text={q.isLoading ? "جارٍ التحميل…" : "لا توجد طلبات."} />}
        {(q.data?.rows ?? []).map((o) => {
          const lines = o.order_lines ?? [];
          const fms = new Set(lines.map((l) => l.fulfillment_method));
          const [label, tone] = statusAr[o.status as keyof typeof statusAr] ?? [o.status, "neutral"];
          return (
            <tr key={o.id}>
              <td className="px-4 py-2 num font-medium">#{o.order_number}{o.external_ref && <div className="text-[11px] text-muted-foreground" dir="ltr">{o.external_ref}</div>}</td>
              <td className="px-4 py-2 text-sm">{o.sales_channels?.name ?? "يدوي"}</td>
              <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(o.created_at)}</td>
              <td className="px-4 py-2 text-sm">{lines.map((l, i) => <div key={i}>{l.quantity} × {l.products?.name}</div>)}</td>
              <td className="px-4 py-2 text-sm">
                {[...fms].map((f) => <div key={f}>{f === "FBB" ? "تشحنه bol.com" : "يُشحن من مستودعنا"} <span className="text-[10px] text-muted-foreground">{f}</span></div>)}
              </td>
              <td className="px-4 py-2"><Tag tone={tone}>{label}</Tag></td>
              <td className="px-4 py-2">
                {perm.canOperate && o.status === "placed" && <div className="flex justify-end gap-1">
                  <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, kind: "ship" })}>تم الشحن</Button>
                  <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => confirm("إلغاء هذا الطلب؟") && act.mutate({ id: o.id, kind: "cancel" })}>إلغاء</Button>
                </div>}
              </td>
            </tr>
          );
        })}
      </Table>
      {pages > 1 && <div className="mt-3 flex items-center gap-2 text-sm">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</Button>
        <span>{page + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>التالي</Button>
      </div>}
      <div className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">سحب الطلبات من bol.com غير مفعّل بعد — ستظهر الطلبات هنا تلقائياً عند تفعيله.</div>
      {perm.isAdmin && <details className="mt-4 rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">بيئة الاختبار (للمطوّرين)</summary>
        <div className="mt-3"><Button size="sm" variant="outline" onClick={() => setOpen(true)}>إنشاء طلب اختبار</Button> <span className="text-xs text-muted-foreground">يحجز مخزوناً حقيقياً — للاختبار فقط.</span></div>
      </details>}
      <NewOrderDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}

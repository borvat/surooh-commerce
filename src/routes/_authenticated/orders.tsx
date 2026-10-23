import { nativeLabConfigured } from "@/lib/native-lab-client";
import { NativeOrderActions } from "@/components/app/native-order-actions";
import { useMemo, useState } from "react";
import { filterLoadedOrders, toOrderSearchOptions } from "@/lib/order-filters";
import { WarehousePrint } from "@/components/app/warehouse-print";
import { WarehouseBatchPrint } from "@/components/app/warehouse-batch-print";
import { planWarehouseBatch, type PickOrder } from "@/lib/warehouse-batch";
import { orgId } from "@/lib/inventory";
import type { WarehouseOrder } from "@/components/app/warehouse-print";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cancelOrder,
  errMsg,
  fulfillOrder,
  listOrders,
  listChannels,
  PAGE_SIZE,
} from "@/lib/inventory";
import { usePermissions } from "@/lib/auth";
import { fmtDate } from "@/components/app/ui-bits";
import { Page, Table, Empty, Tag } from "@/components/app/page";
import { NewOrderDialog } from "@/components/app/merchant";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "الطلبات · QNAN" },
      { name: "description", content: "طلبات البيع والشحن من المستودع أو bol في QNAN." },
      { property: "og:title", content: "الطلبات · QNAN" },
      { property: "og:description", content: "طلبات البيع والشحن من المستودع أو bol في QNAN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const statusAr = {
  placed: ["بانتظار الشحن", "warning"],
  fulfilled: ["تم الشحن", "success"],
  cancelled: ["ملغى", "neutral"],
} as const;

function OrdersPage() {
  const perm = usePermissions();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState("all");
  const [fulfillment, setFulfillment] = useState<"all" | "FBR" | "FBB">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [printOrder, setPrintOrder] = useState<WarehouseOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [printBatch, setPrintBatch] = useState<ReturnType<typeof planWarehouseBatch> | null>(null);
  const [batchAccountName, setBatchAccountName] = useState("");
  const channels = useQuery({ queryKey: ["sales-channels"], queryFn: listChannels });
  const [reference, setReference] = useState("");
  const q = useQuery({
    queryKey: ["orders", page, status, account, from, to, reference],
    queryFn: () => listOrders(toOrderSearchOptions({ page, status, account, from, to, reference })),
  });
  const act = useMutation({
    mutationFn: (v: { id: string; kind: "ship" | "cancel" }) =>
      v.kind === "ship" ? fulfillOrder(v.id) : cancelOrder(v.id),
    onSuccess: (_d, v) => {
      toast.success(
        v.kind === "ship"
          ? "تم الشحن — خُصمت القطع من المستودع"
          : "تم الإلغاء — عادت القطع إلى المتاح",
      );
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / PAGE_SIZE));
  const filtered = useMemo(
    () => filterLoadedOrders(q.data?.rows ?? [], { query, fulfillment }),
    [q.data?.rows, query, fulfillment],
  );
  const batchCandidates = filtered.filter(
    (o) =>
      selectedOrderIds.includes(o.id) &&
      o.status === "placed" &&
      o.channel_id === account &&
      !!o.external_ref,
  );
  async function prepareBatch() {
    if (
      !perm.canOperate ||
      account === "all" ||
      batchCandidates.length === 0 ||
      q.isFetching ||
      q.isError
    )
      return;
    try {
      const organizationId = await orgId();
      // Re-read selected orders before printing; stale browser snapshots are not shipment evidence.
      const fresh = await listOrders(
        toOrderSearchOptions({ page, status, account, from, to, reference }),
      );
      const chosen = fresh.rows.filter((o) => selectedOrderIds.includes(o.id));
      // Compare material picking data, not just the number of orders:
      // a status, quantity, SKU or fulfillment change must invalidate the print preview.
      const fingerprint = (items: typeof chosen) =>
        JSON.stringify(
          items
            .map((o) => ({
              id: o.id,
              org: o.organization_id,
              account: o.channel_id,
              externalRef: o.external_ref,
              status: o.status,
              lines: (o.order_lines ?? [])
                .map((l) => ({
                  sku: l.products?.sku ?? null,
                  quantity: l.quantity,
                  fulfillment: l.fulfillment_method,
                }))
                .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        );
      if (
        chosen.length !== batchCandidates.length ||
        fingerprint(chosen) !== fingerprint(batchCandidates)
      ) {
        toast.error("تغيّرت بيانات التجهيز أو الكميات. أعد تحميل الصفحة وحدد الطلبات مجدداً.");
        setSelectedOrderIds([]);
        return;
      }
      const orders: PickOrder[] = chosen.map((o) => ({
        id: o.id,
        organizationId: o.organization_id,
        channelId: o.channel_id ?? "",
        externalOrderId: o.external_ref ?? "",
        status: o.status as PickOrder["status"],
        lines: (o.order_lines ?? []).map((l) => ({
          sku: l.products?.sku ?? "",
          quantity: l.quantity,
          fulfillment: l.fulfillment_method === "FBB" ? ("FBB" as const) : ("FBR" as const),
        })),
      }));
      const result = planWarehouseBatch(orders, { organizationId, channelId: account });
      if (result.eligible.length === 0) {
        toast.error("لا توجد طلبات صالحة للتجهيز. تحقق من الحساب والمرجع وSKU.");
        return;
      }
      setBatchAccountName((channels.data ?? []).find((c) => c.id === account)?.name ?? account);
      setPrintBatch(result);
      if (result.rejected.length)
        toast.warning(`تم استبعاد ${result.rejected.length} طلب غير صالح`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  return (
    <Page
      title="الطلبات"
      actions={
        nativeLabConfigured() && perm.canOperate ? (
          <Button onClick={() => setOpen(true)}>إنشاء طلب اختبار</Button>
        ) : undefined
      }
      intro="طلبات البيع من حساباتك. المخزون الداخلي يتغيّر فقط للطلبات التي «تُشحن من مستودعنا»؛ طلبات «تشحنها bol.com» تُسجَّل فقط."
    >
      <div className="mb-4 flex gap-1">
        {[
          ["all", "الكل"],
          ["placed", "بانتظار الشحن"],
          ["fulfilled", "تم الشحن"],
          ["cancelled", "ملغى"],
        ].map(([k, l]) => (
          <Button
            key={k}
            size="sm"
            variant={status === k ? "default" : "outline"}
            onClick={() => {
              setStatus(k!);
              setPage(0);
              setSelectedOrderIds([]);
            }}
          >
            {l}
          </Button>
        ))}
      </div>
      <div className="mb-4 grid gap-2 rounded border p-3 md:grid-cols-5">
        <input
          aria-label="بحث الطلبات"
          className="rounded border p-2"
          placeholder="رقم الطلب، SKU، المنتج..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
            setSelectedOrderIds([]);
          }}
        />
        <select
          aria-label="حساب البيع"
          className="rounded border p-2"
          value={account}
          onChange={(e) => {
            setAccount(e.target.value);
            setPage(0);
            setSelectedOrderIds([]);
          }}
        >
          <option value="all">كل الحسابات</option>
          {(channels.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="طريقة الشحن"
          className="rounded border p-2"
          value={fulfillment}
          onChange={(e) => {
            setFulfillment(e.target.value as "all" | "FBR" | "FBB");
            setPage(0);
            setSelectedOrderIds([]);
          }}
        >
          <option value="all">كل طرق الشحن</option>
          <option value="FBR">شحن المستودع</option>
          <option value="FBB">شحن bol</option>
        </select>
        <input
          aria-label="من تاريخ"
          type="date"
          className="rounded border p-2"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(0);
            setSelectedOrderIds([]);
          }}
        />
        <input
          aria-label="إلى تاريخ"
          type="date"
          className="rounded border p-2"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(0);
            setSelectedOrderIds([]);
          }}
        />
        <input
          aria-label="مرجع الطلب الخارجي"
          className="rounded border p-2"
          placeholder="مرجع طلب bol"
          value={reference}
          onChange={(e) => {
            setReference(e.target.value);
            setPage(0);
            setSelectedOrderIds([]);
          }}
        />
        <p className="text-xs text-muted-foreground md:col-span-5">
          الحساب والتاريخ ومرجع الطلب تُفلتر على مستوى قاعدة البيانات ({q.data?.count ?? 0} طلب
          مطابق). البحث باسم المنتج أو SKU وطريقة الشحن يفحص الصفحة المحمّلة فقط؛ لا يمثل مجموع
          النتائج.
        </p>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span aria-live="polite">
          {q.isFetching
            ? "جارٍ تحديث النتائج…"
            : `مطابقة استعلام الحساب والتاريخ: ${q.data?.count ?? 0}`}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setPage(0);
            setStatus("all");
            setQuery("");
            setAccount("all");
            setFulfillment("all");
            setFrom("");
            setTo("");
            setReference("");
            setSelectedOrderIds([]);
          }}
        >
          مسح كل الفلاتر
        </Button>
      </div>
      {q.isError && (
        <p
          role="alert"
          className="mb-3 rounded border border-destructive p-3 text-sm text-destructive"
        >
          تعذّر تحميل الطلبات. لا تعتمد العدد المعروض، وأعد المحاولة.
        </p>
      )}
      {perm.canOperate && !nativeLabConfigured() && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
          <span>مختار من هذه الصفحة: {batchCandidates.length} طلب</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSelectedOrderIds(
                filtered
                  .filter(
                    (o) =>
                      o.status === "placed" &&
                      o.channel_id === account &&
                      o.external_ref &&
                      o.order_lines?.some((l) => l.fulfillment_method !== "FBB"),
                  )
                  .map((o) => o.id),
              )
            }
            disabled={account === "all" || q.isFetching}
          >
            تحديد طلبات المستودع بهذه الصفحة
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedOrderIds([])}>
            إلغاء التحديد
          </Button>
          <Button
            size="sm"
            disabled={account === "all" || !batchCandidates.length || q.isFetching || q.isError}
            onClick={prepareBatch}
          >
            تجهيز وطباعة مجموعة
          </Button>
          <span className="text-muted-foreground">
            اختر حساباً واحداً أولاً. الطباعة لا تغيّر حالة الشحن.
          </span>
        </div>
      )}
      <Table
        head={["تحديد", "الطلب", "الحساب", "التاريخ", "المنتجات", "طريقة الشحن", "الحالة", ""]}
      >
        {filtered.length === 0 && !q.isError && (
          <Empty
            cols={8}
            text={
              q.isLoading
                ? "جارٍ التحميل…"
                : (q.data?.count ?? 0) > 0
                  ? "لا توجد نتائج في هذه الصفحة بعد تطبيق الفلاتر المحلية."
                  : "لا توجد طلبات مطابقة للفلاتر."
            }
          />
        )}
        {filtered.map((o) => {
          const lines = o.order_lines ?? [];
          const fms = new Set(lines.map((l) => l.fulfillment_method));
          const remainderClosed =
            "native_remainder_closed" in o && o.native_remainder_closed === true;
          const [label, tone] = remainderClosed
            ? (["أُغلق باقي الطلب", "neutral"] as const)
            : statusAr[o.status as keyof typeof statusAr] ?? [
            o.status,
            "neutral",
          ];
          return (
            <tr key={o.id}>
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  aria-label={`تحديد الطلب ${o.order_number}`}
                  checked={selectedOrderIds.includes(o.id)}
                  disabled={
                    !perm.canOperate ||
                    account === "all" ||
                    o.channel_id !== account ||
                    remainderClosed ||
                    o.status !== "placed" ||
                    !o.external_ref ||
                    !lines.some((l) => l.fulfillment_method !== "FBB")
                  }
                  onChange={(e) =>
                    setSelectedOrderIds((ids) =>
                      e.target.checked
                        ? [...new Set([...ids, o.id])]
                        : ids.filter((id) => id !== o.id),
                    )
                  }
                />
              </td>
              <td className="px-4 py-2 num font-medium">
                #{o.order_number}
                {o.external_ref && (
                  <div className="text-[11px] text-muted-foreground" dir="ltr">
                    {o.external_ref}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-sm">{o.sales_channels?.name ?? "يدوي"}</td>
              <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(o.created_at)}</td>
              <td className="px-4 py-2 text-sm">
                {lines.map((l, i) => (
                  <div key={i}>
                    {l.quantity} × {l.products?.name}
                  </div>
                ))}
              </td>
              <td className="px-4 py-2 text-sm">
                {[...fms].map((f) => (
                  <div key={f}>
                    {f === "FBB" ? "تشحنه bol.com" : "يُشحن من مستودعنا"}{" "}
                    <span className="text-[10px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </td>
              <td className="px-4 py-2">
                <Tag tone={tone}>{label}</Tag>
              </td>
              <td className="px-4 py-2">
                {perm.canOperate && lines.some((l) => l.fulfillment_method !== "FBB") && (
                  <Button size="sm" variant="outline" onClick={() => setPrintOrder(o)}>
                    ورقة المستودع
                  </Button>
                )}
                {perm.canOperate && nativeLabConfigured() && <NativeOrderActions orderId={o.id} />}
                {perm.canOperate && !nativeLabConfigured() && o.status === "placed" && (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: o.id, kind: "ship" })}
                    >
                      تم الشحن
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() =>
                        confirm("إلغاء هذا الطلب؟") && act.mutate({ id: o.id, kind: "cancel" })
                      }
                    >
                      إلغاء
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      {pages > 1 && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
              setSelectedOrderIds([]);
            }}
          >
            السابق
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= pages}
            onClick={() => {
              setPage(page + 1);
              setSelectedOrderIds([]);
            }}
          >
            التالي
          </Button>
        </div>
      )}
      <div className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        سحب الطلبات من bol.com غير مفعّل بعد — ستظهر الطلبات هنا تلقائياً عند تفعيله.
      </div>
      {perm.isAdmin && (
        <details className="mt-4 rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            بيئة الاختبار (للمطوّرين)
          </summary>
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              إنشاء طلب اختبار
            </Button>{" "}
            <span className="text-xs text-muted-foreground">
              يحجز مخزوناً حقيقياً — للاختبار فقط.
            </span>
          </div>
        </details>
      )}
      <NewOrderDialog open={open} onOpenChange={setOpen} />
      {printOrder && <WarehousePrint order={printOrder} onClose={() => setPrintOrder(null)} />}
      {printBatch && (
        <WarehouseBatchPrint
          batch={printBatch}
          accountName={batchAccountName}
          onClose={() => setPrintBatch(null)}
        />
      )}
    </Page>
  );
}

/** Native read projections only: no legacy marketplace metrics or catalog writes. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { nativeProducts, nativeSnapshot } from "@/lib/native-projection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Table, Tag } from "./page";

export function NativeProductCatalog() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["native-product-catalog"],
    queryFn: async () => {
      const [snapshot, available] = await Promise.all([nativeSnapshot(), nativeProducts()]);
      return { snapshot, available };
    },
  });
  const needle = search.trim().toLocaleLowerCase();
  const rows =
    query.data?.snapshot.items.filter((item) =>
      [item.id, item.name, ...(item.barcodes ?? [])].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      ),
    ) ?? [];
  return (
    <Page
      title="المنتجات"
      intro="أصناف المستودع وباركوداتها ووحداتها ومكوّنات الباقات. تعديل تعريف الأصناف يحتاج صلاحية إدارة الأصناف في المحرك."
      actions={
        <Button asChild variant="outline">
          <Link to="/components">المخزون والاستلام</Link>
        </Button>
      }
    >
      <Input
        aria-label="بحث منتجات المستودع"
        placeholder="اسم المنتج أو SKU أو الباركود"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-4 max-w-md"
      />
      {query.isError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-2">
          <span>تعذّر تحديث المنتجات. {query.error.message}</span>
          <Button disabled={query.isFetching} onClick={() => query.refetch()}>
            إعادة تحميل المنتجات
          </Button>
        </div>
      )}
      {query.isFetching && (
        <p role="status" className="mb-2 text-sm">
          جارٍ تحديث الأصناف من المحرك…
        </p>
      )}
      {!rows.length && (
        <p role="status" className="rounded-xl border p-6 text-center">
          {query.isPending
            ? "جارٍ التحميل…"
            : query.isError
              ? "البيانات الحالية غير متاحة"
              : "لا توجد أصناف مطابقة"}
        </p>
      )}
      <div className="space-y-3 md:hidden">
        {rows.map((item) => {
          const available = query.data?.available.find((row) => row.id === item.id)?.available_qty;
          return (
            <article
              key={item.id}
              data-native-mobile-product={item.id}
              className="rounded-xl border bg-card p-4"
            >
              <b>{item.name}</b>
              <p dir="ltr" className="break-all font-mono text-xs">
                {item.id}
              </p>
              {!item.stock && <Tag>باقة من المكوّنات</Tag>}
              <dl className="my-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">الفعلي</dt>
                  <dd className="text-xl font-semibold num">{item.stock ? item.physical : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">المحجوز</dt>
                  <dd className="text-xl font-semibold num">{item.stock ? item.reserved : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">المتاح</dt>
                  <dd className="text-xl font-semibold num">{available ?? "—"}</dd>
                </div>
              </dl>
              <p className="text-sm">وحدة القياس: {item.uom}</p>
              <p className="break-all text-xs" dir="ltr">
                {item.barcodes?.join(" · ") || "—"}
              </p>
              {!!item.parts.length && (
                <ul className="mt-2 text-xs">
                  {item.parts.map((part) => (
                    <li key={part.id}>
                      {part.quantity} × {part.item}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
      <div className="hidden md:block">
        <Table
          head={[
            "المنتج / SKU",
            "الباركود",
            "وحدة القياس",
            "الفعلي",
            "المحجوز",
            "المتاح",
            "المكوّنات",
          ]}
        >
          {rows.map((item) => {
            const available = query.data?.available.find(
              (row) => row.id === item.id,
            )?.available_qty;
            return (
              <tr key={item.id} data-native-product={item.id}>
                <td className="px-4 py-3">
                  <b>{item.name}</b>
                  <div dir="ltr" className="font-mono text-xs">
                    {item.id}
                  </div>
                  {!item.stock && <Tag>باقة من المكوّنات</Tag>}
                </td>
                <td className="px-4 py-3 text-xs" dir="ltr">
                  {item.barcodes?.join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">{item.uom}</td>
                <td className="px-4 py-3 num">{item.stock ? item.physical : "—"}</td>
                <td className="px-4 py-3 num">{item.stock ? item.reserved : "—"}</td>
                <td className="px-4 py-3 num font-semibold">{available ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {item.parts.length ? (
                    <ul>
                      {item.parts.map((part) => (
                        <li key={part.id}>
                          {part.quantity} × {part.item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "صنف مفرد"
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        الفعلي والمحجوز للأصناف المخزنية؛ توفر الباقة يُحسب من مكوّناتها، ولا يُضاف لها رصيد مستقل.
      </p>
    </Page>
  );
}

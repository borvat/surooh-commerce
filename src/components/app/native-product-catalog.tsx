/** Native read projections only: no legacy marketplace metrics or catalog writes. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { nativeProducts, nativeSnapshot } from "@/lib/native-projection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Table, Empty, Tag } from "./page";

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
        {!rows.length && (
          <Empty
            cols={7}
            text={
              query.isPending
                ? "جارٍ التحميل…"
                : query.isError
                  ? "البيانات الحالية غير متاحة"
                  : "لا توجد أصناف مطابقة"
            }
          />
        )}
        {rows.map((item) => {
          const available = query.data?.available.find((row) => row.id === item.id)?.available_qty;
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
      <p className="mt-3 text-sm text-muted-foreground">
        الفعلي والمحجوز للأصناف المخزنية؛ توفر الباقة يُحسب من مكوّناتها، ولا يُضاف لها رصيد مستقل.
      </p>
    </Page>
  );
}

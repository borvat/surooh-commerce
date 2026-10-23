import { nativeLabConfigured } from "@/lib/native-lab-client";
import { NativeStockOperations } from "@/components/app/native-stock-operations";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/lib/auth";
import { Page, Table, Empty, Tag } from "@/components/app/page";
import { useCatalog } from "@/components/app/catalog";
import { ItemDialog, StockDialog, Photo, n } from "@/components/app/merchant";
import type { ComponentRow } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/components")({
  head: () => ({
    meta: [
      { title: "المخزون · QNAN" },
      { name: "description", content: "كميات المنتجات الفعلية والمتاحة في مستودع QNAN." },
      { property: "og:title", content: "المخزون · QNAN" },
      { property: "og:description", content: "كميات المنتجات الفعلية والمتاحة في مستودع QNAN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockPage,
});

function StockPage() {
  const perm = usePermissions();
  const cat = useCatalog();
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState<{ mode: "receive" | "adjust"; id?: string } | null>(null);
  const [edit, setEdit] = useState<ComponentRow | null>(null);
  const rows = cat.rows.filter(
    (r) =>
      r.comp &&
      !r.isBundle &&
      (!search || `${r.name} ${r.ean ?? ""}`.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <Page
      title="المخزون"
      intro="الكمية الحقيقية على رفوفك للمنتجات المفردة. أدخلها مرة واحدة هنا — كل بندل يستخدم هذا المنتج يحسب الكمية المتاحة منه تلقائياً."
      actions={
        perm.canOperate && (
          <>
            <Button size="lg" onClick={() => setStock({ mode: "receive" })}>
              + استلام بضاعة
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={nativeLabConfigured()}
              onClick={() => setStock({ mode: "adjust" })}
            >
              تعديل / جرد
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link to="/import">استيراد ملف</Link>
            </Button>
          </>
        )
      }
    >
      <Input
        className="mb-4 max-w-xs"
        placeholder="بحث…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Table head={["", "المنتج", "EAN", "في المستودع", "محجوز للطلبات", "المتاح", ""]}>
        {rows.length === 0 && (
          <Empty
            cols={7}
            text={
              cat.loaded
                ? "لا توجد منتجات مفردة في المخزون بعد. في «منتجات bol» اضغط «إضافة للمخزون» أو حدّد مكوّنات بندل."
                : "جارٍ التحميل…"
            }
          />
        )}
        {rows.map((r) => {
          const c = r.comp!;
          return (
            <tr key={r.id}>
              <td className="px-4 py-2">
                <Photo name={r.name} />
              </td>
              <td className="px-4 py-2 font-medium">{r.name}</td>
              <td className="px-4 py-2 num text-xs" dir="ltr">
                {r.ean ?? "—"}
              </td>
              <td className="px-4 py-2 num text-base">{n(c.physical_qty)}</td>
              <td className="px-4 py-2 num text-stock-reserved">{n(c.reserved_qty)}</td>
              <td className="px-4 py-2">
                <span className="num text-base font-semibold text-stock-available">
                  {n(c.available_qty)}
                </span>
                {(c.safety_stock ?? 0) > 0 && (
                  <div className="text-[11px] text-muted-foreground">
                    بعد إبقاء {n(c.safety_stock)} احتياطي
                  </div>
                )}
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center justify-end gap-2">
                  {c.is_low && <Tag tone="warning">منخفض</Tag>}
                  {perm.canOperate && (
                    <>
                      <Button
                        size="sm"
                        disabled={nativeLabConfigured()}
                        onClick={() => setStock({ mode: "adjust", id: c.id! })}
                      >
                        تحديد الكمية
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStock({ mode: "receive", id: c.id! })}
                      >
                        استلام
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>
                        إعدادات
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">
        المتاح = الموجود في المستودع − المحجوز للطلبات − الكمية الاحتياطية.
      </p>
      <StockDialog
        open={!!stock}
        onOpenChange={(o) => !o && setStock(null)}
        mode={stock?.mode ?? "receive"}
        itemId={stock?.id}
      />
      {nativeLabConfigured() && <NativeStockOperations canOperate={perm.canOperate} />}
      <ItemDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} item={edit} />
    </Page>
  );
}

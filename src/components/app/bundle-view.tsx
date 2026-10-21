import { Link } from "@tanstack/react-router";
import { AlertTriangle, Boxes } from "lucide-react";
import { Photo, n } from "@/components/app/merchant";
import type { CatalogRow } from "@/components/app/catalog";

export function bundleParts(product: CatalogRow, catalog: CatalogRow[]) {
  const parts = product.contents.map((c) => {
    const source = catalog.find((p) => p.id === c.product_id);
    const available = source?.comp?.available_qty ?? null;
    return {
      ...c,
      source,
      available,
      capacity: available == null ? 0 : Math.floor(Math.max(available, 0) / c.qty),
    };
  });
  const limiting = parts.length ? parts.reduce((a, b) => (b.capacity < a.capacity ? b : a)) : null;
  const total = limiting ? limiting.capacity : null;
  return { parts, limiting, total };
}

/** Visually explains WHY a bundle's availability is what it is. Read-only. */
export function BundleExplain({
  product,
  catalog,
}: {
  product: CatalogRow;
  catalog: CatalogRow[];
}) {
  const { parts, limiting, total } = bundleParts(product, catalog);
  if (!parts.length)
    return (
      <p className="border-s-4 border-warning bg-warning/10 px-3 py-2 text-sm">
        لم تُحدَّد مكوّنات هذا البندل بعد — لا يمكن حساب المتاح.
      </p>
    );
  const bolShown = product.listings.some(
    (l) => l.fulfillment_method !== "FBB" && (l.bol_stock ?? 0) > (total ?? 0),
  );
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">المكوّن</th>
              <th className="px-3 py-2 text-start">لكل بندل</th>
              <th className="px-3 py-2 text-start">المتاح منه</th>
              <th className="px-3 py-2 text-start">يكفي لـ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {parts.map((p) => (
              <tr
                key={p.component_id}
                className={limiting?.component_id === p.component_id ? "bg-warning/10" : ""}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Photo
                      name={p.source?.name ?? p.name}
                      src={p.source?.imageUrl ?? null}
                      size="h-10 w-10"
                    />
                    {p.source ? (
                      <Link
                        to="/products/$productId"
                        params={{ productId: p.source.id }}
                        className="line-clamp-2 font-medium hover:text-primary hover:underline"
                      >
                        {p.source.name}
                      </Link>
                    ) : (
                      <span>{p.name}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 num font-semibold">× {n(p.qty)}</td>
                <td className="px-3 py-2 num">
                  {p.available == null ? (
                    <span className="text-warning-foreground">غير مضاف للمخزون</span>
                  ) : (
                    n(p.available)
                  )}
                </td>
                <td className="px-3 py-2 num font-semibold">
                  {n(p.capacity)} بندل{" "}
                  {limiting?.component_id === p.component_id && (
                    <span className="ms-1 rounded bg-warning/30 px-1.5 text-[11px]">
                      العنصر المحدِّد
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3">
        <Boxes className="h-5 w-5 text-primary" />
        <div>
          <div className="text-xs text-muted-foreground">المتاح النهائي</div>
          <div className="num text-2xl font-semibold text-stock-available">
            {n(total ?? 0)} بندل
          </div>
        </div>
        {limiting && (
          <div className="text-sm">
            العنصر المحدِّد: <b>{limiting.source?.name ?? limiting.name}</b>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        هذا البندل يسحب من نفس المخزون المشترك مع منتجات أخرى. لا يوجد له مخزون مستقل.
      </p>
      {bolShown && (
        <p className="flex items-start gap-2 border-s-4 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          كمية bol المعروضة أكبر مما يمكن تجهيزه ({n(total ?? 0)}). وضع القراءة فقط — لم نغيّر شيئاً
          على bol.
        </p>
      )}
    </div>
  );
}

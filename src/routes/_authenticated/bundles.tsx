import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/auth";
import { Page, Table, Empty } from "@/components/app/page";
import { BundleEditor, useCatalog, type CatalogRow } from "@/components/app/catalog";
import { Photo, SharedNote, n } from "@/components/app/merchant";

export const Route = createFileRoute("/_authenticated/bundles")({
  head: () => ({ meta: [{ title: "البندلات / Sets · QNAN" }, { name: "description", content: "البندلات ومكوناتها والكميات المتاحة في QNAN." }, { property: "og:title", content: "البندلات / Sets · QNAN" }, { property: "og:description", content: "البندلات ومكوناتها والكميات المتاحة في QNAN." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BundlesPage,
});

function BundlesPage() {
  const perm = usePermissions();
  const cat = useCatalog();
  const [edit, setEdit] = useState<CatalogRow | null>(null);
  const rows = cat.rows.filter((r) => r.isBundle);
  return (
    <Page title="البندلات / Sets" intro="المنتجات التي تتكون من منتجات أخرى. الكمية المتاحة تُحسب من مخزون المكوّنات. لتحويل منتج إلى بندل اختر «بندل / طقم» في صفحة منتجات bol."
      actions={<Button size="lg" variant="outline" asChild><Link to="/products">منتجات bol</Link></Button>}>
      <div className="mb-4"><SharedNote /></div>
      <Table head={["", "البندل", "يتكون من", "المتاح للبيع", "القطعة التي ستنفد أولاً", ""]}>
        {rows.length === 0 && <Empty cols={6} text={cat.loaded ? "لا توجد بندلات بعد." : "جارٍ التحميل…"} />}
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-2"><Photo name={r.name} /></td>
            <td className="px-4 py-2 font-medium">{r.name}<div className="num text-[11px] text-muted-foreground" dir="ltr">{r.ean}</div></td>
            <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{r.contents.map((c) => <span key={c.component_id} className="rounded bg-muted px-2 py-0.5 text-xs"><b className="num">{c.qty}</b> × {c.name}</span>)}</div></td>
            <td className="px-4 py-2 num text-lg font-semibold text-stock-available">{r.contents.length ? n(r.available_qty) : "—"}</td>
            <td className="px-4 py-2 text-sm text-muted-foreground">{r.contents.find((c) => cat.rows.find((x) => x.comp?.sku === r.bottleneck_sku && x.id === c.product_id))?.name ?? ""}</td>
            <td className="px-4 py-2 text-end">{perm.isAdmin && <Button size="sm" variant="outline" onClick={() => setEdit(r)}>تعديل المكوّنات</Button>}</td>
          </tr>
        ))}
      </Table>
      <BundleEditor product={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}
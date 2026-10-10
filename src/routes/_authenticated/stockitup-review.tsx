import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { previewStockitupMappings } from "@/lib/stockitup-review-queue";
import type { ExternalMap, ExternalProduct } from "@/lib/stockitup-identity";

/** Human review preview. Pasted JSON stays in browser memory and is never submitted. */
export const Route = createFileRoute("/_authenticated/stockitup-review")({ component: StockitupReviewPage });
function StockitupReviewPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [productsText, setProductsText] = useState("");
  const [mappingsText, setMappingsText] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof previewStockitupMappings> | null>(null);
  const [error, setError] = useState("");
  function generate() {
    setPreview(null); setError("");
    try {
      if (!organizationId.trim()) throw new Error("حدد معرّف الشركة أولاً");
      if (productsText.length > 1000000 || mappingsText.length > 1000000) throw new Error("المدخلات كبيرة جداً");
      const products: unknown = JSON.parse(productsText);
      const mappings: unknown = JSON.parse(mappingsText || "[]");
      if (!Array.isArray(products) || !Array.isArray(mappings) || products.length > 2000 || mappings.length > 10000)
        throw new Error("المطلوب مصفوفتان JSON وبحد أقصى 2000 منتج");
      if (!products.every(p => p && typeof p.sellerId === "string" && typeof p.productId === "string" &&
          (p.extraEans == null || (Array.isArray(p.extraEans) && p.extraEans.every((e: unknown) => typeof e === "string")))) ||
          !mappings.every(m => m && ["organizationId", "sellerId", "productId", "suroohProductId"].every(k => typeof m[k] === "string")))
        throw new Error("حقول البيانات لا تطابق العقد المطلوب");
      setPreview(previewStockitupMappings(organizationId.trim(), products as ExternalProduct[], mappings as ExternalMap[]));
    } catch (e) { setError(e instanceof Error ? e.message : "تعذرت قراءة البيانات"); }
  }
  return <Page title="مراجعة ربط منتجات Stockitup" intro="أداة معاينة محلية فقط: لا تتصل بـStockitup ولا تحفظ أو تدمج أي منتج. لا تُدخل أسرار API أو بيانات شخصية.">
    <div className="space-y-4">
      <label className="block text-sm">معرّف الشركة<input className="mt-1 w-full rounded border p-2" value={organizationId} onChange={e => setOrganizationId(e.target.value)} placeholder="organization_id" /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">منتجات Stockitup (JSON)<textarea className="mt-1 h-40 w-full rounded border p-2 font-mono text-xs" value={productsText} onChange={e => setProductsText(e.target.value)} placeholder={'[{"sellerId":"1","productId":"21","ean":"...","extraEans":[]}]'} /></label>
        <label className="block text-sm">الربط المؤكد الموجود مسبقاً (JSON)<textarea className="mt-1 h-40 w-full rounded border p-2 font-mono text-xs" value={mappingsText} onChange={e => setMappingsText(e.target.value)} placeholder={'[{"organizationId":"...","sellerId":"1","productId":"21","suroohProductId":"..."}]'} /></label>
      </div>
      <Button onClick={generate}>إنشاء معاينة للقراءة فقط</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {preview && <section aria-label="نتائج المطابقة" className="space-y-3">
        <p className="text-sm">الإجمالي: {preview.totals.seen} | المؤكد: {preview.totals.matched} | يحتاج مراجعة: {preview.totals.needsReview}</p>
        <div className="overflow-x-auto rounded border"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-start">Seller / Product</th><th className="p-2 text-start">SKU</th><th className="p-2 text-start">EANs</th><th className="p-2 text-start">الحالة / السبب</th><th className="p-2 text-start">Surooh Master</th></tr></thead>
          <tbody>{preview.rows.map((r,i) => <tr key={i} className="border-b"><td className="p-2">{r.sellerId} / {r.productId}</td><td className="p-2">{r.sku || "—"}</td><td className="p-2">{r.eans.join(", ") || "—"}</td><td className="p-2">{r.status} / {r.reason}</td><td className="p-2">{r.suroohProductId || "يحتاج مراجعة"}</td></tr>)}</tbody>
        </table></div>
      </section>}
      <p className="text-xs text-muted-foreground">كل النتائج مؤقتة داخل الصفحة. لا توجد أزرار اعتماد، حفظ أو دمج؛ ولا يجوز اعتبار EAN أو SKU وحده إثبات تطابق.</p>
    </div>
  </Page>;
}

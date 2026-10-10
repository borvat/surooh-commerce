import { useMemo } from "react";
import { Button } from "@/components/ui/button";

type Line = { quantity?: number | null; fulfillment_method?: string | null; products?: { sku?: string | null; name?: string | null } | null };
export type WarehouseOrder = {
  id: string; order_number?: number | null; external_ref?: string | null; created_at?: string | null;
  sales_channels?: { name?: string | null } | null; order_lines?: Line[] | null;
};
type Props = { order: WarehouseOrder; onClose: () => void; shippingLabelUrl?: string | null };

/** A warehouse PICK LIST, not proof of fulfillment or a carrier-issued shipping label.
 * Print no customer's address unless it comes from a verified order shipment record.
 */
export function WarehousePrint({ order, onClose, shippingLabelUrl }: Props) {
  const lines = useMemo(() => (order.order_lines ?? []).filter(l => l.fulfillment_method !== "FBB"), [order.order_lines]);
  const qty = lines.reduce((n, l) => n + (l.quantity ?? 0), 0);
  return <div className="fixed inset-0 z-50 overflow-auto bg-background p-6" role="dialog" aria-modal="true" aria-label="ورقة تجهيز المستودع">
    <style>{`@media print { body * { visibility: hidden !important; } #surooh-warehouse-print, #surooh-warehouse-print * { visibility: visible !important; } #surooh-warehouse-print { position: absolute; top: 0; left: 0; right: 0; padding: 16mm; } .warehouse-actions { display: none !important; } }`}</style>
    <div className="warehouse-actions mb-4 flex gap-3">
      <Button type="button" onClick={() => window.print()}>طباعة ورقة التجهيز</Button>
      <Button type="button" variant="outline" onClick={onClose}>إغلاق</Button>
    </div>
    <article id="surooh-warehouse-print" className="mx-auto max-w-3xl rounded border bg-white p-8 text-black" dir="rtl">
      <header className="border-b pb-4"><h1 className="text-2xl font-bold">Surooh Commerce — ورقة تجهيز مستودع</h1>
        <p className="text-sm">ورقة اختيار وتجهيز داخلية، وليست إثبات شحن أو تسليم</p></header>
      <div className="my-4 grid grid-cols-2 gap-2 text-sm">
        <p>الطلب: <b>#{order.order_number ?? "—"}</b></p><p>المرجع الخارجي: {order.external_ref ?? "—"}</p>
        <p>الحساب: {order.sales_channels?.name ?? "يدوي"}</p><p>التاريخ: {order.created_at ? new Date(order.created_at).toLocaleString("nl-NL") : "—"}</p>
      </div>
      <table className="w-full border-collapse text-sm"><thead><tr className="border-b text-right"><th className="py-2">SKU</th><th>المنتج</th><th>الكمية</th><th>تم الالتقاط</th></tr></thead>
        <tbody>{lines.map((l, i) => <tr className="border-b" key={i}><td className="py-3">{l.products?.sku ?? "—"}</td><td>{l.products?.name ?? "—"}</td><td>{l.quantity ?? 0}</td><td>□</td></tr>)}</tbody></table>
      <p className="mt-4 font-bold">إجمالي قطع المستودع: {qty}</p>
      <p className="mt-6 border-t pt-3 text-sm">المجهّز: ________________  المدقق: ________________</p>
      <div className="mt-6 border-t pt-4 text-sm">
        <b>ملصق الشحن:</b> {shippingLabelUrl ? "ملصق رسمي متاح من شركة الشحن؛ اطبعه من الملف المعتمد بصورة مستقلة." : "غير متاح. يلزم ملصق رسمي من bol.com أو شركة الشحن. لا تُشحن الطرد بلا ملصق صالح."}
      </div>
    </article>
  </div>;
}

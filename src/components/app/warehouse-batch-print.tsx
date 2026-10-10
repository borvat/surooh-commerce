import { Button } from "@/components/ui/button";
import type { PickBatchResult } from "@/lib/warehouse-batch";

type Props = {
  batch: PickBatchResult;
  accountName: string;
  onClose: () => void;
};

/** Internal batch picking sheet only. Never an official shipping label or dispatch confirmation. */
export function WarehouseBatchPrint({ batch, accountName, onClose }: Props) {
  return <div role="dialog" aria-modal="true" aria-label="طباعة مجموعة تجهيز" className="fixed inset-0 z-50 overflow-auto bg-background p-5">
    <style>{`@media print {
      body * { visibility: hidden !important; }
      #commerce-pick-batch, #commerce-pick-batch * { visibility: visible !important; }
      #commerce-pick-batch { position: absolute; top: 0; left: 0; width: 100%; padding: 12mm; }
      .commerce-batch-actions { display: none !important; }
      @page { size: A4; margin: 12mm; }
    }`}</style>
    <div className="commerce-batch-actions mx-auto mb-4 flex max-w-4xl gap-2">
      <Button onClick={() => window.print()}>طباعة قائمة التجهيز</Button>
      <Button variant="outline" onClick={onClose}>إغلاق</Button>
    </div>
    <article id="commerce-pick-batch" dir="rtl" className="mx-auto max-w-4xl border bg-white p-6 text-black">
      <header className="border-b pb-3">
        <h1 className="text-xl font-bold">Surooh Commerce | قائمة تجهيز مجمّعة</h1>
        <p className="mt-2">الحساب: {accountName}</p>
        <p>عدد الطلبات: {batch.totals.orders} | القطع: {batch.totals.pieces} | أصناف SKU: {batch.totals.distinctSku}</p>
      </header>
      <h2 className="mt-5 font-bold">الأصناف المطلوب التقاطها</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead><tr className="border-b"><th className="p-2 text-right">SKU</th><th className="p-2 text-right">الكمية</th><th className="p-2 text-right">تم التقاطها</th></tr></thead>
        <tbody>{batch.skuTotals.map(l => <tr className="border-b" key={l.sku}><td className="p-2">{l.sku}</td><td className="p-2">{l.pieces}</td><td className="p-2">□</td></tr>)}</tbody>
      </table>
      <h2 className="mt-5 font-bold">الطلبات الداخلة بالمجموعة</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">{batch.eligible.map(o => <div className="border p-2" key={o.id}>#{o.externalOrderId} <span className="ms-2">□</span></div>)}</div>
      {batch.rejected.length > 0 && <p className="mt-4 text-sm">تم استبعاد {batch.rejected.length} طلب غير مؤهل؛ راجع شاشة الطلبات.</p>}
      <p className="mt-6 border-t pt-3 text-xs">مستند داخلي للتجهيز فقط؛ ليس ملصق شحن ولا إثبات تسليم أو شحن. تتطلب كل شحنة ملصق الناقل الأصلي.</p>
      <p className="mt-4 text-sm">المجهّز: __________ المدقق: __________ التاريخ: __________</p>
    </article>
  </div>;
}

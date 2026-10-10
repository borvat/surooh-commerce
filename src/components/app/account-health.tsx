import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { channelCredentialStatus } from "@/lib/inventory";
import { useCatalog } from "@/components/app/catalog";
import { productHealth } from "@/lib/product-master";
import { fmtDate } from "@/components/app/ui-bits";

/** Connection health (API) and data health (catalog quality) kept strictly separate. */
export function AccountHealth() {
  const cat = useCatalog();
  const creds = useQuery({ queryKey: ["cred-status"], queryFn: channelCredentialStatus });
  const real = cat.channels.filter((c) => !c.is_demo);
  if (!real.length) return null;
  return <div className="mt-6 space-y-4">
    <h2 className="text-lg font-semibold">صحة الحسابات</h2>
    {real.map((c) => {
      const cr = (creds.data ?? []).find((x) => x.channel_id === c.id);
      const offers = cat.listings.filter((l) => l.channel_id === c.id);
      const prods = cat.catalog.filter((r) => r.accounts.includes(c.id));
      const hs = prods.map((r) => productHealth(r));
      const verified = cr?.status === "verified";
      return <div key={c.id} className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-semibold">صحة الاتصال — {c.retailer_name ?? cat.chanLabel(c.id)}</h3>
          <Line ok={c.status === "connected"} t={c.status === "connected" ? "متصل" : "غير متصل"} />
          <Line ok={verified} t={verified ? `بيانات الدخول متحقَّق منها (…${cr?.client_id_last4 ?? ""})` : "بيانات الدخول غير متحقَّق منها"} />
          <Line ok={!!c.last_product_sync_at} t={`آخر قراءة ناجحة: ${c.last_product_sync_at ? fmtDate(c.last_product_sync_at) : "—"}`} />
          <Line ok={!cr?.last_error && c.status !== "error"} t={(cr?.last_error || (c.status === "error" && c.last_sync_message)) ? `آخر خطأ: ${(cr?.last_error || c.last_sync_message || "").slice(0, 140)}` : "لا أخطاء اتصال"} />
        </section>
        <section className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-semibold">صحة البيانات</h3>
          <Row l="عروض مسحوبة" v={offers.length} />
          <Row l="منتجات ربطها مؤكَّد" v={offers.filter((l) => l.mapping_status === "CONFIRMED").length} />
          <Row l="بحاجة مراجعة الربط" v={offers.filter((l) => l.mapping_status !== "CONFIRMED").length} warn />
          <Row l="اسم ناقص" v={hs.filter((h) => h.missingTitle).length} warn />
          <Row l="خصائص أساسية ناقصة" v={hs.filter((h) => h.missingCritical.length > 0).length} warn />
          <p className="mt-2 text-[11px] text-muted-foreground">مشاكل البيانات لا تعني مشكلة في الاتصال.</p>
        </section>
      </div>;
    })}
  </div>;
}
function Line({ ok, t }: { ok: boolean; t: string }) {
  return <div className="flex items-center gap-2 py-0.5 text-sm">{ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}{t}</div>;
}
function Row({ l, v, warn }: { l: string; v: number; warn?: boolean }) {
  return <div className="flex justify-between py-0.5 text-sm"><span>{l}</span><b className={`num ${warn && v > 0 ? "text-warning-foreground" : ""}`}>{v}</b></div>;
}
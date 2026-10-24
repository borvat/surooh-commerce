import { createFileRoute, Link } from "@tanstack/react-router";
import { nativeLabConfigured } from "@/lib/native-lab-client";
import { NativeDashboard } from "@/components/app/native-dashboard";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ordersTodayCount } from "@/lib/inventory";
import { Page, Card } from "@/components/app/page";
import { AccountCards, useCatalog } from "@/components/app/catalog";
import { SharedNote, n } from "@/components/app/merchant";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "الرئيسية · QNAN" },
      { name: "description", content: "نظرة على منتجات bol والمخزون والطلبات في QNAN." },
      { property: "og:title", content: "الرئيسية · QNAN" },
      { property: "og:description", content: "نظرة على منتجات bol والمخزون والطلبات في QNAN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return nativeLabConfigured() ? <NativeDashboard /> : <HomePage />;
}

function HomePage() {
  const cat = useCatalog();
  const today = useQuery({ queryKey: ["orders-today"], queryFn: ordersTodayCount });
  if (!cat.loaded)
    return (
      <Page title="الرئيسية">
        <div className="text-muted-foreground">جارٍ التحميل…</div>
      </Page>
    );
  if (!cat.imported) {
    return (
      <Page
        title="ربط حساب bol.com"
        intro="ابدأ بربط حسابك على bol.com. سنسحب منتجاتك تلقائياً، ثم تحدد البندلات وتُدخل مخزونك مرة واحدة."
      >
        <AccountCards compact />
      </Page>
    );
  }
  const c = cat.catalog;
  const stockItems = cat.rows.filter((r) => r.comp && !r.isBundle);
  const kpis = [
    { l: "منتجات bol", v: c.length, to: "/products" as const },
    { l: "بحاجة مراجعة", v: c.filter((r) => r.needsReview).length, to: "/products" as const },
    { l: "بندلات", v: c.filter((r) => r.isBundle).length, to: "/bundles" as const },
    { l: "طلبات اليوم", v: today.data ?? 0, to: "/orders" as const },
  ];
  const noStock = stockItems.filter((r) => (r.comp?.physical_qty ?? 0) === 0).length;
  return (
    <Page
      title="الرئيسية"
      actions={
        <>
          <Button size="lg" asChild>
            <Link to="/products">منتجات bol</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/components">المخزون</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/channels">حسابات bol</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.l} to={k.to}>
            <Card className="hover:border-primary">
              <div className="text-sm text-muted-foreground">{k.l}</div>
              <div className="mt-2 text-3xl font-semibold num">{n(k.v)}</div>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">الخطوات التالية</h2>
        <ol className="grid gap-2 text-sm">
          <li>1. في «منتجات bol» حدّد أي منتج هو بندل / طقم، واختر ما يتكون منه.</li>
          <li>
            2. في «المخزون» أدخل الكمية الفعلية للمنتجات المفردة مرة واحدة
            {noStock ? ` — ${noStock} منتج بدون كمية بعد` : ""}.
          </li>
          <li>3. راجع المنتجات الموجودة في حسابين وأكّد أنها نفس المنتج.</li>
          <li className="text-muted-foreground">
            4. بعد ذلك فقط: الطلبات ونشر الكميات إلى bol.com (غير مفعّل بعد).
          </li>
        </ol>
      </Card>
      <div className="mt-6">
        <SharedNote />
      </div>
    </Page>
  );
}

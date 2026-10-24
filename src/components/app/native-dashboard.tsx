import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { nativeSnapshot } from "@/lib/native-projection";
import { stockLocations } from "@/lib/native-stock-operations";
import { nativeDashboardMetrics } from "@/lib/native-dashboard";
import { Button } from "@/components/ui/button";
import { Page, Card } from "./page";
import { n } from "./merchant";

const labels = {
  pending_orders: "طلبات معلّقة",
  awaiting_pick: "بانتظار التجهيز",
  awaiting_pack: "بانتظار التعبئة",
  ready_to_ship: "جاهزة للشحن",
  closed_remainders: "طلبات أُغلق باقيها",
  stock_skus: "أصناف مخزنية",
  zero_available_skus: "أصناف بلا توفر",
  quarantine_skus: "أصناف في الحجر",
  inventory_value: "القيمة بكل المواقع · عملة الشركة",
} as const;

export function NativeDashboard() {
  const query = useQuery({
    queryKey: ["native-dashboard"],
    queryFn: async () => {
      const [snapshot, locations] = await Promise.all([nativeSnapshot(), stockLocations()]);
      return nativeDashboardMetrics(snapshot, locations);
    },
  });
  return (
    <Page
      title="الرئيسية"
      intro="حالة الطلبات والمخزون من آخر قراءة محفوظة في المحرك."
      actions={
        <>
          <Button asChild>
            <Link to="/components">الاستلام والمخزون</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/orders">مهام الطلبات</Link>
          </Button>
          <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
            تحديث المؤشرات
          </Button>
        </>
      }
    >
      {query.isError && (
        <p role="alert" className="mb-4">
          تعذّر تحديث المؤشرات. {query.error.message}
        </p>
      )}
      {query.isFetching && (
        <p role="status" className="mb-4 text-sm">
          جارٍ تحديث الحالة…
        </p>
      )}
      {query.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Object.entries(labels).map(([key, label]) => (
            <Card key={key}>
              <div data-native-metric={key}>
                <p className="text-sm text-muted-foreground">{label}</p>
                <strong data-native-value className="mt-2 block text-3xl num">
                  {n(query.data[key as keyof typeof labels])}
                </strong>
              </div>
            </Card>
          ))}
        </div>
      )}
      {query.data && (
        <Card className="mt-4 text-sm text-muted-foreground">
          الطلبات المعلّقة تستثني الملغى والمكتمل والمغلق باقيه. التعبئة والشحن يعدّان المهام النشطة
          فقط؛ الباقة لا تُعدّ صنف مخزون مستقل. الحجر لا يزيد المتاح للبيع. القيمة مجموع الأرصدة
          الأصلية بكل المواقع، وليست رصيد فواتير أو تحصيلات.
        </Card>
      )}
    </Page>
  );
}

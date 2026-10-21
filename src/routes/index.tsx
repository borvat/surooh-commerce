import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QNAN Inventory Core" },
      {
        name: "description",
        content: "Shared-component inventory with BOM-derived EAN availability.",
      },
      { property: "og:title", content: "QNAN Inventory Core" },
      {
        property: "og:description",
        content: "Shared-component inventory with BOM-derived EAN availability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-6 text-sidebar-foreground">
      <div className="max-w-lg">
        <div className="num text-xs uppercase tracking-widest text-sidebar-primary">QNAN</div>
        <h1 className="mt-1 text-3xl font-semibold text-sidebar-accent-foreground">
          إدارة المخزون
        </h1>
        <p className="mt-3 text-sm">
          أدخل مخزون مستودعك مرة واحدة، وسيحسب النظام تلقائياً كم يمكنك أن تبيع من كل منتج على
          bol.com — دون بيع ما لا تملكه.
        </p>
        <Button
          asChild
          className="mt-6 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
        >
          <Link to="/dashboard">ابدأ الآن</Link>
        </Button>
      </div>
    </div>
  );
}

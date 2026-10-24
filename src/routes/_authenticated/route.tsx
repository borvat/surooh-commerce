import { nativeLabConfigured, nativeLabCommand, configureNativeLab } from "@/lib/native-lab-client";
import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  LogOut,
  Boxes,
  Package,
  ShoppingCart,
  History,
  Store,
  Settings,
  Layers,
  ScanSearch,
  MessageSquareText,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "الرئيسية", Icon: Home },
  { to: "/products", label: "منتجات bol", Icon: Package },
  { to: "/review", label: "مراجعة المنتجات", Icon: ScanSearch },
  { to: "/bundles", label: "البندلات / Sets", Icon: Layers },
  { to: "/components", label: "المخزون", Icon: Boxes },
  { to: "/orders", label: "الطلبات", Icon: ShoppingCart },
  { to: "/assistant", label: "مساعد التجارة (تجريبي)", Icon: MessageSquareText },
  { to: "/channels", label: "حسابات bol", Icon: Store },
  { to: "/movements", label: "السجل", Icon: History },
  { to: "/settings", label: "الإعدادات", Icon: Settings },
] as const;
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (nativeLabConfigured()) {
      const me = await nativeLabCommand("identity", {}, `route:${crypto.randomUUID()}`);
      return { user: { id: String(me["id"]), email: String(me["email"]) } };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const roleAr: Record<string, string> = {
  admin: "مدير",
  warehouse: "موظف مستودع",
  viewer: "مشاهدة فقط",
};

function Shell() {
  const native = nativeLabConfigured();
  const navigation = native
    ? NAV.filter(({ to }) => !["/review", "/assistant", "/channels", "/settings"].includes(to))
    : NAV;
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    if (nativeLabConfigured()) {
      configureNativeLab(undefined);
      delete window.__SUROOH_NATIVE_SESSION__;
    } else await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <div className="text-base font-semibold text-sidebar-accent-foreground">
            {native ? "SUROOH WMS" : "QNAN"}
          </div>
          <div className="text-xs">{native ? "بيئة اختبار — بيانات مصطنعة" : "إدارة المخزون"}</div>
        </div>
        <nav className="flex-1 space-y-1 p-2 text-[15px]">
          {navigation.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-sidebar-accent"
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              }}
            >
              <Icon className="h-4 w-4" /> {native && to === "/products" ? "المنتجات" : label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <div className="truncate" dir="ltr">
            {me?.email}
          </div>
          <div className="text-sidebar-primary">{me?.role ? roleAr[me.role] : ""}</div>
          <button
            onClick={signOut}
            className="mt-2 flex items-center gap-1 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-3 w-3" /> تسجيل الخروج
          </button>
        </div>
      </aside>
      <nav className="flex gap-1 overflow-x-auto bg-sidebar p-2 text-sm text-sidebar-foreground md:hidden">
        {native && (
          <span className="shrink-0 self-center px-2 font-semibold">SUROOH WMS · اختبار</span>
        )}
        {navigation.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="whitespace-nowrap rounded px-3 py-1.5"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          >
            {native && to === "/products" ? "المنتجات" : label}
          </Link>
        ))}
      </nav>
      <main className="min-w-0 flex-1">
        {me && !me.role ? (
          <div className="p-10">
            <h1 className="text-lg font-semibold">لا يمكنك الدخول بعد</h1>
            <p className="mt-2 text-muted-foreground">
              أنت مسجّل باسم <span dir="ltr">{me.email}</span>، لكنك لست عضواً في أي شركة. اطلب من
              مدير الشركة إضافتك من صفحة الإعدادات.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}

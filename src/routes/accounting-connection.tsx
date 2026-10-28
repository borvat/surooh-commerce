import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/accounting-connection")({
  ssr: false,
  head: () => ({ meta: [{ title: "Surooh WMS · ربط هوية المحاسبة التجريبية" }] }),
  component: AccountingConnection,
});
type Identity = { company: string; user: string; can_review: boolean; csrf_token: string };
function AccountingConnection() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/wms-auth/session", {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!controller.signal.aborted) {
          if (response.ok) setIdentity(data as Identity);
          else if (response.status !== 401)
            setError(String(data.error ?? "تعذّر التحقق من الجلسة."));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("تعذّر الاتصال. أعد تحميل الصفحة للتحقق.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, []);
  async function action(kind: "login" | "session" | "logout") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/wms-auth/${kind}`, {
        method: kind === "session" ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(identity ? { "X-WMS-CSRF": identity.csrf_token } : {}),
        },
        ...(kind === "login" ? { body: JSON.stringify({ user, password }) } : {}),
      });
      const data = await response.json();
      if (kind === "logout") {
        setIdentity(null);
        if (!response.ok)
          setError(
            "أُغلقت الجلسة المحلية؛ لم يتأكد تسجيل الخروج لدى المحاسبة. لا تشارك الجهاز قبل مراجعة الجلسة الأصلية.",
          );
      } else if (response.ok) setIdentity(data as Identity);
      else {
        if (response.status === 401) setIdentity(null);
        setError(String(data.error ?? "تعذّر التحقق من الجلسة."));
      }
    } catch {
      setError("انقطع الاتصال. أعد التحقق من الجلسة قبل المتابعة.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  return (
    <main dir="rtl" className="mx-auto min-h-screen w-full max-w-2xl space-y-5 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">SUROOH WMS · اختبار التكامل</p>
        <h1 className="text-2xl font-semibold">التحقق من هوية المحاسبة</h1>
        <p className="text-sm text-muted-foreground">
          تُراجع الجلسة والصلاحيات لدى محرك المحاسبة نفسه. بيانات الدخول لا تُحفظ في المتصفح، ولا
          تُطلب مفاتيح API.
        </p>
      </header>
      {busy && <p role="status">جارٍ التحقق من الجلسة…</p>}
      {error && (
        <p
          role="alert"
          className="break-words rounded-lg border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {identity ? (
        <section
          aria-label="هوية المحاسبة المتحقق منها"
          className="space-y-4 rounded-xl border p-4"
        >
          <h2 className="text-lg font-semibold">هوية محاسبة متحقق منها</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">شركة الاختبار</dt>
              <dd className="font-semibold" dir="ltr">
                {identity.company}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">المستخدم</dt>
              <dd className="break-all text-sm" dir="ltr">
                {identity.user}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">صلاحية المراجعة المحاسبية</dt>
              <dd>{identity.can_review ? "متاحة لدى المحاسبة" : "غير متاحة لهذه الهوية"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => action("session")}>
              إعادة التحقق من الجلسة
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => action("logout")}>
              تسجيل الخروج
            </Button>
          </div>
        </section>
      ) : (
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action("login");
          }}
        >
          <p className="text-sm">
            استخدم هوية الاختبار المخصصة التي يجهّزها مسؤول المحاسبة عبر المسار الآمن.
          </p>
          <div className="space-y-1">
            <label htmlFor="native-user">البريد الخاص بالاختبار</label>
            <Input
              id="native-user"
              dir="ltr"
              className="min-w-0"
              autoComplete="username"
              type="email"
              required
              disabled={busy}
              value={user}
              onChange={(event) => setUser(event.target.value)}
              placeholder="writer@example.invalid"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="native-password">كلمة مرور الاختبار</label>
            <Input
              id="native-password"
              dir="ltr"
              autoComplete="current-password"
              type="password"
              required
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || !user || !password}>
            التحقق من هوية المحاسبة
          </Button>
        </form>
      )}
      <section aria-label="جاهزية دورة المستودع" className="space-y-3 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">دورة المستودع ما زالت قيد الربط</h2>
        <p className="text-sm">
          التحقق من الهوية لا يثبت جاهزية عمليات المستودع. لم يُعتمد بعد عقد الاستلام والشحنة
          والفاتورة المرتبطة والمرتجع الجزئي والإشعار الدائن على البيئة المشتركة.
        </p>
        <p className="text-sm text-muted-foreground">
          لا تُرسل هذه الشاشة أي حركة مخزون أو قيد مالي. يبقى ERPNext مصدر الكميات والقيم والقيود.
        </p>
      </section>
    </main>
  );
}

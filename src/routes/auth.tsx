import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · QNAN Inventory Core" },
      { name: "description", content: "Sign in to QNAN Inventory Core." },
      { property: "og:title", content: "Sign in · QNAN Inventory Core" },
      { property: "og:description", content: "Sign in to QNAN Inventory Core." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    if (mode === "up" && !res.data.session) { toast.success("تحقق من بريدك الإلكتروني لتأكيد الحساب."); return; }
    navigate({ to: "/dashboard" });
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error(String(r.error)); return; }
    if (r.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm rounded-md border bg-card p-6">
        <div className="mb-5">
          <div className="num text-xs uppercase tracking-widest text-muted-foreground">QNAN</div>
          <h1 className="text-lg font-semibold">إدارة المخزون</h1>
          <p className="text-sm text-muted-foreground">{mode === "in" ? "سجّل الدخول للمتابعة" : "إنشاء حساب جديد"}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>البريد الإلكتروني</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>كلمة المرور</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={busy}>{mode === "in" ? "تسجيل الدخول" : "إنشاء الحساب"}</Button>
        </form>
        {mode === "in" && <button type="button" className="mt-2 w-full text-center text-xs text-primary hover:underline" onClick={async () => {
          if (!email) { toast.error("اكتب بريدك الإلكتروني أولاً"); return; }
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
          if (error) toast.error(error.message); else toast.success("أرسلنا رابط تعيين كلمة المرور إلى بريدك.");
        }}>نسيت كلمة المرور؟</button>}
        <Button variant="outline" className="mt-3 w-full" onClick={google}>المتابعة باستخدام Google</Button>
        <button className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "ليس لديك حساب؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">يمكن لمدير الشركة إضافتك إلى الفريق بعد تسجيل دخولك لأول مرة.</p>
      </div>
    </div>
  );
}
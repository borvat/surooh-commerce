import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة المرور · QNAN" },
      { name: "description", content: "تعيين كلمة مرور جديدة لحسابك في QNAN." },
      { property: "og:title", content: "تعيين كلمة المرور · QNAN" },
      { property: "og:description", content: "تعيين كلمة مرور جديدة لحسابك في QNAN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ كلمة المرور الجديدة");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-md border bg-card p-6">
        <h1 className="text-lg font-semibold">تعيين كلمة مرور جديدة</h1>
        <div className="space-y-1"><Label>كلمة المرور الجديدة</Label><Input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>حفظ</Button>
      </form>
    </div>
  );
}
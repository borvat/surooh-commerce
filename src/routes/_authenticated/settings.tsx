import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMyOrg,
  listMembers,
  listWarehouses,
  setMemberRole,
  removeMember,
  errMsg,
  type Role,
} from "@/lib/inventory";
import { useMe, usePermissions } from "@/lib/auth";
import { PageHeader, Panel, StatusPill, Hint } from "@/components/app/ui-bits";
import { selectCls } from "@/components/app/forms";
import { ReadOnlyBanner } from "@/components/app/offer-card";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات · QNAN" },
      { name: "description", content: "الشركة والمستودع والفريق." },
      { property: "og:title", content: "الإعدادات · QNAN" },
      { property: "og:description", content: "الشركة والمستودع والفريق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-6 my-4 space-y-2 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SettingsPage() {
  const { isAdmin } = usePermissions();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const org = useQuery({ queryKey: ["org"], queryFn: getMyOrg });
  const orgId = org.data?.id;
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });
  const members = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => listMembers(orgId!),
    enabled: !!orgId,
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const set = useMutation({
    mutationFn: (v: { email: string; role: Role }) => setMemberRole(orgId!, v.email, v.role),
    onSuccess: () => {
      toast.success("تم الحفظ");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rm = useMutation({
    mutationFn: (uid: string) => removeMember(orgId!, uid),
    onSuccess: () => {
      toast.success("تمت الإزالة");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div>
      <PageHeader title="الإعدادات" description={`الشركة: ${org.data?.name ?? "…"}`} />
      <Section title="الشركة">
        <p className="text-sm">
          الاسم: <b>{org.data?.name ?? "…"}</b>. البيانات القانونية (الشعار، KvK، الضريبة، العنوان،
          البنك) محفوظة لكل حساب bol في{" "}
          <Link to="/channels" className="text-primary underline">
            حسابات bol
          </Link>
          .
        </p>
      </Section>
      <Section title="المستودعات">
        <Panel>
          <div className="border-b px-3 py-2 text-sm font-medium">المستودع</div>
          <table className="w-full text-sm">
            <tbody>
              {(wh.data ?? []).map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="num px-3 py-1.5">{w.code}</td>
                  <td>{w.name}</td>
                  <td className="px-3 text-right">
                    {w.is_default && <StatusPill tone="info">الرئيسي</StatusPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Section>
      <Section title="المستخدمون والصلاحيات">
        <Hint title="من يستطيع فعل ماذا؟">
          <b>مدير</b>: كل شيء. <b>موظف مستودع</b>: استلام البضاعة وتعديل المخزون والطلبات.{" "}
          <b>مشاهدة فقط</b>: يرى ولا يغيّر.
        </Hint>
        <Panel>
          <div className="border-b px-3 py-2 text-sm font-medium">الفريق</div>
          <table className="w-full text-sm">
            <tbody>
              {(members.data ?? []).map((u) => (
                <tr key={u.user_id} className="border-t">
                  <td className="px-3 py-1.5">{u.email}</td>
                  <td className="px-3 text-right">
                    {isAdmin && u.user_id !== me?.id ? (
                      <div className="flex justify-end gap-2">
                        <select
                          className={selectCls}
                          value={u.role}
                          onChange={(e) =>
                            set.mutate({ email: u.email, role: e.target.value as Role })
                          }
                        >
                          <option value="admin">مدير</option>
                          <option value="warehouse">موظف مستودع</option>
                          <option value="viewer">مشاهدة فقط</option>
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => confirm(`إزالة ${u.email}؟`) && rm.mutate(u.user_id)}
                        >
                          إزالة
                        </Button>
                      </div>
                    ) : (
                      <StatusPill tone="neutral">
                        {
                          (
                            {
                              admin: "مدير",
                              warehouse: "موظف مستودع",
                              viewer: "مشاهدة فقط",
                            } as Record<string, string>
                          )[u.role]
                        }
                      </StatusPill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 border-t p-3">
              <Input
                className="h-8 max-w-xs"
                placeholder="بريد شخص سجّل الدخول مرة واحدة على الأقل"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select
                className={selectCls}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="viewer">مشاهدة فقط</option>
                <option value="warehouse">موظف مستودع</option>
                <option value="admin">مدير</option>
              </select>
              <Button
                size="sm"
                disabled={!email.trim() || set.isPending}
                onClick={() => set.mutate({ email, role })}
              >
                إضافة للفريق
              </Button>
            </div>
          )}
        </Panel>
      </Section>
      <Section title="حسابات bol">
        <p className="text-sm">
          الربط وسحب المنتجات وصحة الاتصال والبيانات:{" "}
          <Link to="/channels" className="text-primary underline">
            حسابات bol
          </Link>
          .
        </p>
      </Section>
      <Section title="قواعد المخزون">
        <ul className="list-disc space-y-1 ps-5 text-sm">
          <li>المخزون يملكه «صنف المخزون» وليس الـ EAN أو عرض bol.</li>
          <li>
            ربط العروض بنفس المنتج لا يجمع المخزون أبداً — تختار مصدراً واحداً أو تُدخل العدد
            الصحيح.
          </li>
          <li>البندل والعبوة المتعددة بلا مخزون مستقل؛ المتاح يُحسب من المكوّنات المؤكَّدة.</li>
          <li>النسخ (Variants) لا تشارك المخزون أبداً.</li>
        </ul>
      </Section>
      <Section title="قواعد البيانات الأساسية للمنتج">
        <ul className="list-disc space-y-1 ps-5 text-sm">
          <li>الأولوية: يدوي ← bol ← مستنتج من الاسم.</li>
          <li>
            عند اختلاف العروض على خاصية أساسية (العلامة، الموديل، اللون، المقاس، العبوة، الكمية)
            تُعلَّم كتعارض ولا يُكتب فوقها.
          </li>
          <li>لا تُفعَّل أي علاقة (بندل، عبوة، طقم) بدون تأكيدك.</li>
        </ul>
      </Section>
      <Section title="وضع المزامنة">
        <ReadOnlyBanner />
      </Section>
      <Section title="التدقيق والأمان">
        <p className="text-sm">
          كل حركة مخزون مسجّلة ولا تُحذف —{" "}
          <Link to="/movements" className="text-primary underline">
            السجل
          </Link>
          . مفاتيح bol مشفّرة ولا تُعرض أبداً.
        </p>
      </Section>
      <details className="mx-6 my-4 rounded border p-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">أدوات المطوّرين (متقدم)</summary>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link to="/import" className="underline">
            استيراد ملفات CSV
          </Link>
          <Link to="/mappings" className="underline">
            Listing mapping (advanced)
          </Link>
          <Link to="/diagnostics" className="underline">
            Acceptance test
          </Link>
        </div>
      </details>
    </div>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/app/page";
import { Photo, n } from "@/components/app/merchant";
import {
  errMsg,
  resetProductAttribute,
  setProductAttribute,
  setProductFamily,
  setProductRelationship,
} from "@/lib/inventory";
import {
  productHealth,
  resolveMaster,
  REL_AR,
  SOURCE_AR,
  STATUS_AR,
  type MasterAttr,
} from "@/lib/product-master";
import type { CatalogRow } from "@/components/app/catalog";

const tone = {
  confirmed: "success",
  suggested: "warning",
  conflict: "danger",
  unknown: "neutral",
} as const;

export function MasterTable({ row, canEdit }: { row: CatalogRow; canEdit: boolean }) {
  const attrs = resolveMaster(row);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        البيانات الأساسية لمنتجنا (وليس لعرض bol). الإدخال اليدوي له الأولوية، وبيانات bol المنظّمة
        تُميَّز عن التخمين من الاسم. كل التعديلات داخلية فقط.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">الخاصية</th>
              <th className="px-3 py-2 text-start">القيمة</th>
              <th className="px-3 py-2 text-start">المصدر</th>
              <th className="px-3 py-2 text-start">الحالة</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {attrs.map((a) => (
              <AttrRow key={a.key} row={row} a={a} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttrRow({ row, a, canEdit }: { row: CatalogRow; a: MasterAttr; canEdit: boolean }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(a.value ?? "");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["product-attributes"] });
      await qc.invalidateQueries({ queryKey: ["product-families"] });
      await qc.invalidateQueries({ queryKey: ["product-links"] });
      toast.success(msg);
      setEdit(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  const save = (v: string | null, source: string, status: string) =>
    a.key === "product_family"
      ? run(() => setProductFamily(row.id, v), "حُفظت العائلة")
      : run(() => setProductAttribute(row.id, a.key, v, source, status), "حُفظ داخلياً");
  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2 font-medium">
        {a.label}
        {a.critical && <span className="ms-1 text-[10px] text-muted-foreground">أساسي</span>}
      </td>
      <td className="px-3 py-2" dir="auto">
        {edit ? (
          <div className="flex gap-1">
            <Input
              className="h-8 min-w-40"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              autoFocus
            />
            <Button
              size="sm"
              disabled={busy || !val.trim()}
              onClick={() => save(val, "manual", "confirmed")}
            >
              حفظ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
              إلغاء
            </Button>
          </div>
        ) : a.status === "conflict" ? (
          <div className="space-y-1">
            {a.candidates.map((c) => (
              <div key={c.value} className="flex items-center gap-2">
                <span className="num">{c.value}</span>
                <span className="text-xs text-muted-foreground">
                  ({SOURCE_AR[c.source]} · {c.offers} عرض)
                </span>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    disabled={busy}
                    onClick={() => save(c.value, c.source, "confirmed")}
                  >
                    اعتماد هذه
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className={a.value ? "num" : "text-muted-foreground"}>
            {a.value ?? (a.cleared ? "مُسحت (خاطئة)" : "—")}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {a.source ? SOURCE_AR[a.source] : "—"}
        {a.updatedAt && <div className="num">{new Date(a.updatedAt).toLocaleDateString("ar")}</div>}
      </td>
      <td className="px-3 py-2">
        <Tag tone={tone[a.status]}>{STATUS_AR[a.status]}</Tag>
      </td>
      <td className="px-3 py-2 text-end">
        {canEdit && !edit && (
          <div className="flex justify-end gap-1">
            {a.status === "suggested" && a.value && (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={busy}
                onClick={() => save(a.value, a.source ?? "inferred", "confirmed")}
              >
                تأكيد
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                setVal(a.value ?? "");
                setEdit(true);
              }}
            >
              {a.value ? "تعديل" : "إضافة"}
            </Button>
            {a.value && a.source === "inferred" && a.key !== "product_family" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive"
                disabled={busy}
                onClick={() => save(null, "manual", "unknown")}
              >
                مسح
              </Button>
            )}
            {a.key !== "product_family" && row.storedAttrs.some((s) => s.key === a.key) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={busy}
                onClick={() =>
                  run(() => resetProductAttribute(row.id, a.key), "رجعت القيمة للمصدر الأصلي")
                }
              >
                استرجاع
              </Button>
            )}
            {a.key === "product_family" && a.value && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive"
                disabled={busy}
                onClick={() => save(null, "manual", "unknown")}
              >
                إزالة
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function HealthPanel({ row }: { row: CatalogRow }) {
  const h = productHealth(row);
  const items: [boolean, string][] = [
    [!h.missingTitle, h.missingTitle ? "اسم المنتج ناقص" : "اسم المنتج موجود"],
    [
      !h.missingCritical.length,
      h.missingCritical.length
        ? `خصائص أساسية ناقصة: ${h.missingCritical.join("، ")}`
        : "الخصائص الأساسية مكتملة",
    ],
    [
      !h.conflicts.length,
      h.conflicts.length ? `تعارض بين العروض: ${h.conflicts.join("، ")}` : "لا تعارض بين العروض",
    ],
    [
      !h.unmappedOffers,
      h.unmappedOffers ? `${h.unmappedOffers} عرض ربطه غير مؤكَّد` : "كل العروض مربوطة ومؤكَّدة",
    ],
    [
      !h.noInventory,
      row.isBundle
        ? "البندل بلا مخزون مستقل (يُحسب من المكوّنات)"
        : h.noInventory
          ? "لا يوجد صنف مخزون لهذا المنتج"
          : "له صنف مخزون",
    ],
    ...(row.isBundle
      ? [
          [
            !h.relationshipReview,
            h.relationshipReview ? "العلاقة (المكوّنات) بحاجة مراجعة" : "العلاقة مؤكَّدة",
          ] as [boolean, string],
        ]
      : []),
  ];
  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">جودة بيانات المنتج</h3>
        <span className="num text-sm">
          اكتمال الهوية <b>{h.score}%</b>
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded bg-muted">
        <div
          className={`h-full ${h.score >= 80 ? "bg-success" : h.score >= 50 ? "bg-warning" : "bg-destructive"}`}
          style={{ width: `${h.score}%` }}
        />
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map(([ok, t]) => (
          <li key={t} className="flex items-center gap-2">
            {ok ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning" />
            )}
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IdentityPanel({
  row,
  account,
}: {
  row: CatalogRow;
  account: (id: string) => string;
}) {
  const eans = [...new Set(row.listings.map((l) => l.external_ean).filter(Boolean))];
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <Box title="المنتج (هويتنا)" note="البطاقة الداخلية الموحّدة">
        <div className="font-medium">{row.name}</div>
        <div className="text-xs text-muted-foreground" dir="ltr">
          {row.masterReference || row.sku}
        </div>
      </Box>
      <Box
        title={`عروض bol (${row.listings.length})`}
        note="إعلانات على المتجر — كل عرض يبقى ظاهراً ومنفصلاً"
      >
        {row.listings.map((l) => (
          <div key={l.id} className="text-xs">
            <span>{account(l.channel_id)}</span> ·{" "}
            <span dir="ltr" className="num">
              {l.external_ean ?? "—"}
            </span>
          </div>
        ))}
      </Box>
      <Box title={`EAN (${eans.length})`} note="رقم تعريف فقط — لا يملك المخزون">
        <div dir="ltr" className="num text-sm">
          {eans.join(" · ") || "—"}
        </div>
      </Box>
    </section>
  );
}

export function InventoryIdentity({ row }: { row: CatalogRow }) {
  if (row.isBundle)
    return (
      <Box title="صنف المخزون" note="لا مخزون فعلي مستقل للبندل في هذه المرحلة">
        <div className="text-sm">يُحسب من مكوّناته</div>
      </Box>
    );
  if (!row.comp)
    return (
      <Box title="صنف المخزون" note="أدخل العدد الفعلي أدناه لإنشائه">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleDashed className="h-4 w-4" /> غير موجود
        </div>
      </Box>
    );
  return (
    <Box title="صنف المخزون" note="هوية مستقلة — ليست الـ EAN. الربط لا يجمع المخزون أبداً.">
      <div className="text-sm font-medium" dir="ltr">
        {row.comp.sku}
      </div>
      <div className="text-xs text-muted-foreground">
        فعلي <b className="num">{n(row.comp.physical_qty ?? 0)}</b> · محجوز{" "}
        <b className="num">{n(row.comp.reserved_qty ?? 0)}</b> · متاح{" "}
        <b className="num">{n(row.comp.available_qty ?? 0)}</b>
      </div>
    </Box>
  );
}

function Box({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{title}</div>
      {children}
      <div className="mt-2 text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}

export function RelationshipPanel({ row, canEdit }: { row: CatalogRow; canEdit: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const type =
    row.relationshipType ??
    (row.isBundle ? (row.contents.length === 1 ? "MULTIPACK" : "BUNDLE") : null);
  const confirmed = row.relationshipStatus === "confirmed";
  async function set(t: string, status: string) {
    setBusy(true);
    try {
      await setProductRelationship(row.id, t, status);
      await qc.invalidateQueries({ queryKey: ["product-links"] });
      toast.success("حُفظ نوع العلاقة داخلياً");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">نوع العلاقة</h3>
        {type && <Tag tone="neutral">{REL_AR[type]?.[0]}</Tag>}
        <Tag tone={confirmed ? "success" : "warning"}>{confirmed ? "مؤكَّدة" : "بحاجة مراجعة"}</Tag>
      </div>
      {type && <p className="mt-1 text-xs text-muted-foreground">{REL_AR[type]?.[1]}</p>}
      {type === "MULTIPACK" && row.contents.length > 1 && (
        <p className="mt-1 text-xs text-warning-foreground">
          تنبيه: العبوة المتعددة يجب أن تتكون من منتج أساسي واحد.
        </p>
      )}
      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["MULTIPACK", "BUNDLE", "KIT", "SET"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={type === t ? "default" : "outline"}
              disabled={busy}
              onClick={() => set(t, confirmed ? "confirmed" : "needs_review")}
            >
              {REL_AR[t]![0]}
            </Button>
          ))}
          {!confirmed && type && (
            <Button
              size="sm"
              disabled={busy || !row.contents.length}
              onClick={() => set(type, "confirmed")}
            >
              تأكيد العلاقة
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export function FamilyPanel({ row, catalog }: { row: CatalogRow; catalog: CatalogRow[] }) {
  const members = row.familyId ? catalog.filter((r) => r.familyId === row.familyId) : [];
  if (!row.familyId)
    return (
      <p className="text-sm text-muted-foreground">
        هذا المنتج غير مُسند لعائلة. أضف «عائلة المنتج» من تبويب «بيانات المنتج الأساسية» لتجميع
        النسخ (للتنظيم فقط — المخزون لا يُشارك).
      </p>
    );
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">
        العائلة: {row.familyName}{" "}
        <span className="num text-muted-foreground">({members.length})</span>
      </h3>
      <p className="text-xs text-muted-foreground">
        تجميع تنظيمي فقط. لكل نسخة مخزونها المستقل ولا يُشارك تلقائياً أبداً.
      </p>
      <div className="divide-y rounded-lg border">
        {members.map((v) => {
          const attrs = resolveMaster(v);
          const traits = ["color", "size", "model", "pack_quantity"]
            .map((k) => attrs.find((a) => a.key === k)?.value)
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={v.id}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 ${v.id === row.id ? "bg-accent/40" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Photo name={v.name} src={v.imageUrl} size="h-10 w-10" />
                <div className="min-w-0">
                  <Link
                    to="/products/$productId"
                    params={{ productId: v.id }}
                    className="line-clamp-1 font-medium text-primary hover:underline"
                  >
                    {v.name}
                  </Link>
                  <div className="text-xs text-muted-foreground" dir="auto">
                    {traits || "—"}
                  </div>
                </div>
              </div>
              <div className="text-sm">
                {v.isBundle ? (
                  "بندل"
                ) : v.comp ? (
                  <>
                    متاح <b className="num">{n(v.comp.available_qty ?? 0)}</b>
                  </>
                ) : (
                  <span className="text-muted-foreground">لا مخزون</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

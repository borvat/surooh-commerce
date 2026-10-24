import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Empty } from "./page";
import { useMe } from "@/lib/auth";
import { nativeLabEndpoint } from "@/lib/native-lab-client";
import {
  stockJournalKey,
  readStockCommand,
  writeStockCommand,
  clearStockCommand,
  type StockCommand,
} from "@/lib/native-stock-journal";
import {
  stockLocations,
  runStockOperation,
  type StockOperation,
} from "@/lib/native-stock-operations";

export function NativeStockOperations({ canOperate }: { canOperate: boolean }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const endpoint = nativeLabEndpoint();
  const journalKey = endpoint && me?.id ? stockJournalKey(endpoint, me.id) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [journalError, setJournalError] = useState("");
  const query = useQuery({ queryKey: ["native-locations"], queryFn: stockLocations });
  const [mode, setMode] = useState<StockOperation>("stock_transfer");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [rate, setRate] = useState("");
  const [quarantine, setQuarantine] = useState(false);
  const [countStart, setCountStart] = useState<{
    warehouse: string;
    item: string;
    expected: number;
    version: string;
  } | null>(null);
  // Once sent, freeze the exact command. Response-loss retries must reuse its key and body.
  const [command, setCommand] = useState<StockCommand | null>(null);
  useEffect(() => {
    setLoadedKey(null);
    setCommand(null);
    if (!journalKey) return;
    try {
      setCommand(readStockCommand(window.sessionStorage, journalKey));
      setJournalError("");
      setLoadedKey(journalKey);
    } catch {
      setJournalError(
        "تعذّر قراءة سجل العملية المعلّقة. أوقف الإدخال واطلب مراجعة المستند في المحرك؛ لا تمسح السجل لإعادة التنفيذ.",
      );
    }
  }, [journalKey]);
  const mutation = useMutation({
    mutationFn: (value: NonNullable<typeof command>) =>
      runStockOperation(value.operation, value.payload, value.id),
    onSettled: () => qc.invalidateQueries(),
  });
  const snapshot = query.data;
  const stock = snapshot?.bins.find((row) => row.warehouse === source && row.item_code === item);
  const locked = command !== null;
  const acknowledged = mutation.isSuccess && mutation.variables?.id === command?.id;
  function submit() {
    // A refreshed balance cannot prove whether an unanswered command committed.
    // Keep its identity frozen until the boundary acknowledges that same command.
    if (
      locked ||
      mutation.isPending ||
      query.isFetching ||
      query.isError ||
      !snapshot ||
      !journalKey ||
      loadedKey !== journalKey ||
      journalError
    )
      return;
    if (
      mode === "stock_count" &&
      (!countStart || countStart.warehouse !== source || countStart.item !== item)
    )
      return;
    const value = {
      operation: mode,
      id: crypto.randomUUID(),
      payload:
        mode === "location_create"
          ? { label, quarantine }
          : mode === "stock_transfer"
            ? { source, target, item, qty: Number(qty), reason }
            : {
                warehouse: source,
                item,
                qty: Number(qty),
                expected_qty: countStart!.expected,
                expected_version: countStart!.version,
                reason,
                ...(rate ? { valuation_rate: Number(rate) } : {}),
              },
    };
    try {
      writeStockCommand(window.sessionStorage, journalKey, value);
    } catch {
      setJournalError(
        "تعذّر حفظ هوية العملية قبل الإرسال. لم تُرسل العملية؛ أعد تحميل الصفحة للتحقق من السجل.",
      );
      return;
    }
    setCommand(value);
    mutation.mutate(value);
  }
  const locationOptions = snapshot?.locations.map((row) => (
    <option key={row.name} value={row.name}>
      {row.warehouse_name}
      {row.is_rejected_warehouse ? " · حجر" : ""}
    </option>
  ));
  return (
    <section className="mt-8 space-y-4" aria-label="مواقع التخزين والجرد">
      <h2 className="text-lg font-semibold">مواقع التخزين والجرد</h2>
      <p className="text-sm text-muted-foreground">
        الطلبات تستخدم مخزون موقع التجهيز فقط: {snapshot?.fulfillment_warehouse ?? "…"}. انقل
        البضاعة إليه قبل بيعها. مواقع الحجر لا تضيف كمية متاحة للبيع.
      </p>
      {query.isError && <p role="alert">تعذّر تحديث مواقع التخزين. {query.error.message}</p>}
      <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
        تحديث المواقع
      </Button>
      <Table head={["الموقع", "المنتج", "الفعلي", "المحجوز", "القيمة"]}>
        {!snapshot?.bins.length && (
          <Empty cols={5} text={query.isPending ? "جارٍ التحميل…" : "لا توجد أرصدة مواقع"} />
        )}
        {snapshot?.bins.map((row) => (
          <tr key={`${row.warehouse}:${row.item_code}`}>
            <td className="px-4 py-2">{row.warehouse}</td>
            <td className="px-4 py-2">{row.item_code}</td>
            <td className="px-4 py-2 num">{row.actual_qty}</td>
            <td className="px-4 py-2 num">{row.reserved_stock}</td>
            <td className="px-4 py-2 num">{row.stock_value}</td>
          </tr>
        ))}
      </Table>
      {canOperate && (
        <form
          className="space-y-3 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <fieldset
            disabled={
              locked ||
              query.isFetching ||
              query.isError ||
              !snapshot ||
              !journalKey ||
              loadedKey !== journalKey ||
              !!journalError
            }
            className="grid gap-3 sm:grid-cols-2"
          >
            <label>
              العملية
              <select
                aria-label="العملية"
                className="block w-full rounded border p-2"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as StockOperation);
                  setCountStart(null);
                }}
              >
                <option value="stock_transfer">تحويل بين المواقع</option>
                <option value="stock_count">جرد وتسوية</option>
                <option value="location_create">إضافة موقع</option>
              </select>
            </label>
            {mode === "location_create" ? (
              <>
                <label>
                  اسم الموقع
                  <Input
                    required
                    maxLength={80}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={quarantine}
                    onChange={(e) => setQuarantine(e.target.checked)}
                  />{" "}
                  موقع حجر للبضاعة
                </label>
              </>
            ) : (
              <>
                <label>
                  الموقع {mode === "stock_transfer" ? "المصدر" : "المعدود"}
                  <select
                    aria-label={mode === "stock_transfer" ? "الموقع المصدر" : "الموقع المعدود"}
                    required
                    className="block w-full rounded border p-2"
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value);
                      setCountStart(null);
                    }}
                  >
                    <option value="">اختر الموقع</option>
                    {locationOptions}
                  </select>
                </label>
                {mode === "stock_transfer" && (
                  <label>
                    الموقع الوجهة
                    <select
                      aria-label="الموقع الوجهة"
                      required
                      className="block w-full rounded border p-2"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="">اختر الوجهة</option>
                      {locationOptions}
                    </select>
                  </label>
                )}
                <label>
                  رمز المنتج
                  <Input
                    required
                    value={item}
                    onChange={(e) => {
                      setItem(e.target.value);
                      setCountStart(null);
                    }}
                  />
                </label>
                <label>
                  {mode === "stock_count" ? "الكمية المعدودة" : "الكمية المنقولة"}
                  <Input
                    required
                    type="number"
                    min={mode === "stock_count" ? 0 : 1}
                    step={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
                {mode === "stock_count" && (
                  <>
                    <p className="text-sm">
                      الكمية عند بدء الجرد: {countStart?.expected ?? "لم يبدأ"}. يُرفض الجرد عند
                      وجود حجز أو تغيّر الرصيد.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!source || !item || !!countStart}
                      onClick={() =>
                        setCountStart({
                          warehouse: source,
                          item,
                          expected: stock?.actual_qty ?? 0,
                          version: stock?.movement_version ?? "EMPTY",
                        })
                      }
                    >
                      بدء الجرد وحفظ الرصيد للمقارنة
                    </Button>
                    <label>
                      تكلفة الوحدة عند عدم وجود تقييم سابق
                      <Input
                        type="number"
                        min="0.000001"
                        step="any"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <label>
                  سبب العملية
                  <Input
                    required
                    maxLength={240}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </>
            )}
            <Button type="submit" disabled={mode === "stock_count" && !countStart}>
              تأكيد العملية
            </Button>
          </fieldset>
          {mutation.isPending && <p role="status">جارٍ تنفيذ العملية…</p>}
          {journalError && <p role="alert">{journalError}</p>}
          {command && !acknowledged && !mutation.isPending && (
            <div role="alert" className="space-y-2">
              <p>
                {mutation.error?.message ??
                  "توجد عملية محفوظة لم تُؤكد نتيجتها. تحقّق من نفس العملية قبل بدء عملية أخرى."}
              </p>
              <p className="break-all text-xs" dir="ltr">
                {command.operation} · {command.id}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={!journalKey || loadedKey !== journalKey || !!journalError}
                onClick={() => command && mutation.mutate(command)}
              >
                إعادة التحقق من نفس العملية
              </Button>
            </div>
          )}
          {acknowledged && <p role="status">تم تأكيد العملية وحفظ مستندها.</p>}
          {locked && acknowledged && (
            <Button
              type="button"
              variant="ghost"
              disabled={query.isFetching || query.isError}
              onClick={() => {
                try {
                  clearStockCommand(window.sessionStorage, journalKey!, command!);
                } catch {
                  setJournalError(
                    "تعذّر إغلاق سجل العملية. أعد تحميل الصفحة قبل إدخال عملية جديدة.",
                  );
                  return;
                }
                setCommand(null);
                setCountStart(null);
                mutation.reset();
              }}
            >
              بدء عملية جديدة بعد مراجعة الرصيد
            </Button>
          )}
        </form>
      )}
    </section>
  );
}

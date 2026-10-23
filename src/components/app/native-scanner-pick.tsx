import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { NativeSnapshot } from "@/lib/native-projection";
import {
  scanPlan,
  scannedCounts,
  scannerPick,
  type Scan,
  type ScanLine,
} from "@/lib/native-scanner";

export function NativeScannerPick({
  snapshot,
  orderId,
  disabled,
}: {
  snapshot: NativeSnapshot;
  orderId: string;
  disabled: boolean;
}) {
  const [plan, setPlan] = useState<ScanLine[] | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => scannerPick(orderId, scans, requestId),
    onSettled: () => qc.invalidateQueries(),
  });
  const counts = plan ? scannedCounts(plan, scans) : {};
  const complete = !!plan && plan.every((line) => counts[line.item] === line.quantity);
  const frozen = !mutation.isIdle;
  function start() {
    try {
      setPlan(scanPlan(snapshot, orderId));
      setScans([]);
      setCode("");
      setError("");
      setRequestId(crypto.randomUUID());
      mutation.reset();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function addScan() {
    try {
      const next = [...scans, { code: code.trim(), qty: 1 }];
      scannedCounts(plan!, next);
      setScans(next);
      setCode("");
      setError("");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" disabled={disabled} onClick={start}>
        تجهيز بالمسح
      </Button>
      {!plan && error && (
        <span role="alert" className="text-xs">
          {error}
        </span>
      )}
      <Dialog
        open={!!plan}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPlan(null);
        }}
      >
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>تجهيز الطلب بالمسح</DialogTitle>
            <DialogDescription>
              امسح رمز المنتج أو الباركود ثم Enter لكل وحدة. تُراجع الكميات قبل تأكيد التجهيز.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm" dir="ltr">
            {orderId}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addScan();
            }}
            className="flex gap-2"
          >
            <Input
              autoFocus
              aria-label="رمز المنتج أو الباركود"
              value={code}
              disabled={frozen || disabled}
              onChange={(event) => setCode(event.target.value)}
              maxLength={140}
              autoComplete="off"
            />
            <Button type="submit" disabled={frozen || disabled || !code.trim()}>
              إضافة المسح
            </Button>
          </form>
          <ul className="space-y-2">
            {plan?.map((line) => (
              <li key={line.item} className="rounded border p-2">
                <span>{line.name}</span>
                <span className="mx-2 num">
                  {counts[line.item] ?? 0} / {line.quantity}
                </span>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {line.codes.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          {error && <p role="alert">{error}</p>}
          {mutation.isError && (
            <p role="alert">{mutation.error.message} أعد التحقق بنفس العملية قبل بدء غيرها.</p>
          )}
          {mutation.isSuccess && (
            <p role="status">تم تأكيد قائمة التجهيز. حدّث الطلب لعرض الخطوة التالية.</p>
          )}
          {mutation.isPending && <p role="status">جارٍ التحقق وحفظ التجهيز…</p>}
          <div className="flex gap-2">
            <Button
              disabled={!complete || disabled || mutation.isPending || mutation.isSuccess}
              onClick={() => mutation.mutate()}
            >
              {mutation.isError ? "إعادة التحقق من نفس العملية" : "تأكيد التجهيز"}
            </Button>
            <Button
              variant="outline"
              disabled={frozen || !scans.length}
              onClick={() => {
                setScans(scans.slice(0, -1));
                setError("");
              }}
            >
              تراجع عن آخر مسح
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

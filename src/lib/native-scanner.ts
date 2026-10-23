import { nativeLabCommand } from "./native-lab-client";
import type { NativeSnapshot } from "./native-projection";

export type ScanLine = { item: string; name: string; quantity: number; codes: string[] };
export type Scan = { code: string; qty: number };

export function scanPlan(snapshot: NativeSnapshot, orderId: string): ScanLine[] {
  const order = snapshot.orders.find((row) => row.id === orderId);
  if (!order || order.status !== "placed" || order.pick_list || order.delivery_note)
    throw new Error("الطلب غير متاح للتجهيز بالمسح. حدّث حالته.");
  const lines = new Map<string, ScanLine>();
  for (const row of order.lines) {
    const item = snapshot.items.find((item) => item.id === row.item);
    if (!item?.stock || !Number.isSafeInteger(row.quantity) || row.quantity < 1)
      throw new Error("يتطلب المسح منتجات مخزنية وكميات بوحدات كاملة.");
    const line = lines.get(row.item) ?? {
      item: row.item,
      name: item.name,
      quantity: 0,
      codes: [...new Set([item.id, ...(item.barcodes ?? [])])],
    };
    line.quantity += row.quantity;
    lines.set(row.item, line);
  }
  if (!lines.size) throw new Error("الطلب بلا بنود قابلة للمسح.");
  return [...lines.values()];
}

export function scannedCounts(plan: ScanLine[], scans: Scan[]): Record<string, number> {
  const counts: Record<string, number> = Object.create(null);
  for (const scan of scans) {
    const matches = plan.filter((line) => line.codes.includes(scan.code));
    const line = matches[0];
    if (matches.length !== 1 || !line) throw new Error("رمز غير معروف أو ملتبس ضمن الطلب.");
    if (!Number.isSafeInteger(scan.qty) || scan.qty < 1) throw new Error("كمية المسح غير صحيحة.");
    const quantity = (counts[line.item] ?? 0) + scan.qty;
    counts[line.item] = quantity;
    if (quantity > line.quantity) throw new Error("الكمية الممسوحة تتجاوز كمية الطلب.");
  }
  return counts;
}

export function scannerPick(orderId: string, scans: Scan[], requestId: string) {
  if (!orderId || !scans.length) throw new Error("امسح بنود الطلب أولاً.");
  return nativeLabCommand("scan_pick", { order_id: orderId, scans }, requestId);
}

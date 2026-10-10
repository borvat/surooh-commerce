/**
 * ONE PRODUCT -> ONE STOCK -> ONE REFERENCE -> MANY EAN/OFFERS.
 * The canonical product's inventory item owns stock. bol offer quantities/references are
 * remote observations only; every confirmed FBR offer's target = canonical available + master reference.
 * Informational only while bol is read-only.
 */
import type { CatalogRow } from "@/components/app/catalog";
import { bundleParts } from "@/components/app/bundle-view";

export type SyncState = "IN_SYNC" | "OUT_OF_SYNC" | "READ_ONLY_PENDING" | "NO_STOCK" | "NO_OFFERS";
export const SYNC_AR: Record<SyncState, [string, "success" | "warning" | "danger" | "neutral"]> = {
  IN_SYNC: ["متطابق مع bol", "success"],
  OUT_OF_SYNC: ["غير متطابق مع bol", "danger"],
  READ_ONLY_PENDING: ["غير متطابق — بانتظار تفعيل المزامنة", "warning"],
  NO_STOCK: ["المخزون الأساسي غير محدد", "warning"],
  NO_OFFERS: ["لا عروض مؤكَّدة", "neutral"],
};

const READ_ONLY = true; // mirrors BOL_WRITE_ENABLED=false on the server

export function unified(row: CatalogRow, all: CatalogRow[]) {
  const target: number | null = row.isBundle ? (row.contents.length ? bundleParts(row, all).total ?? null : null) : row.comp ? row.comp.available_qty ?? 0 : null;
  const masterRef = row.masterReference?.trim() || null;
  const refCandidates = [...new Set(row.listings.map((l) => l.reference?.trim()).filter((x): x is string => !!x))];
  const confirmed = row.listings.filter((l) => l.mapping_status === "CONFIRMED");
  const pending = row.listings.filter((l) => l.mapping_status !== "CONFIRMED");
  const offers = row.listings.map((l) => {
    const isPending = l.mapping_status !== "CONFIRMED";
    const fbb = l.fulfillment_method === "FBB";
    const qtyOk = fbb || isPending || target == null ? null : Math.min(target, 999) === (l.bol_stock ?? 0);
    const refOk = isPending || !masterRef ? null : (l.reference?.trim() || "") === masterRef;
    const status = isPending ? "بانتظار تأكيد الربط" : fbb ? "تشحنه bol — خارج مخزوننا" : target == null ? "المخزون الأساسي غير محدد" : qtyOk && refOk !== false ? "متطابق" : "غير متطابق";
    return { l, isPending, fbb, targetQty: fbb || isPending || target == null ? null : Math.min(target, 999), targetRef: isPending ? null : masterRef, qtyOk, refOk, status };
  });
  const active = offers.filter((o) => !o.isPending && !o.fbb);
  const qtyDrift = active.some((o) => o.qtyOk === false);
  const refDrift = active.some((o) => o.refOk === false) || (!masterRef && new Set(confirmed.map((l) => l.reference?.trim() || "")).size > 1);
  const remoteQtys = [...new Set(offers.filter((o) => !o.fbb).map((o) => o.l.bol_stock ?? 0))]; // observations incl. pending
  const state: SyncState = !active.length ? "NO_OFFERS" : target == null ? "NO_STOCK" : qtyDrift || refDrift ? (READ_ONLY ? "READ_ONLY_PENDING" : "OUT_OF_SYNC") : "IN_SYNC";
  return { target, masterRef, refCandidates, confirmed, pending, offers, state, qtyDrift, refDrift, remoteMismatch: remoteQtys.length > 1 };
}
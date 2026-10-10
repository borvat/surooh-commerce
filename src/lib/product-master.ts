/**
 * Product Master: structured, sourced attributes for our canonical product.
 * Precedence: manual (owner) > bol structured data > inferred from title.
 * Offers that disagree on a critical attribute produce a conflict — never a silent overwrite.
 * Internal only; nothing here is ever sent to bol.com.
 */
import type { CatalogRow } from "@/components/app/catalog";
import { features } from "@/lib/product-intelligence";

export const ATTRS = [
  ["brand", "العلامة التجارية", true], ["manufacturer", "الشركة المصنّعة", false], ["model", "الموديل", true], ["mpn", "رقم القطعة (MPN)", false],
  ["product_family", "عائلة المنتج", false], ["variant_name", "اسم النسخة", false], ["color", "اللون", true], ["size", "المقاس", true],
  ["material", "المادة", false], ["capacity", "السعة", false], ["power", "القدرة", false], ["dimensions", "الأبعاد", false],
  ["weight", "الوزن", false], ["pack_quantity", "عدد القطع في العبوة", true], ["unit_quantity", "الكمية لكل قطعة", true], ["unit_type", "وحدة القياس", false],
] as const;
export type AttrKey = (typeof ATTRS)[number][0];
export type Source = "bol" | "imported" | "inferred" | "manual";
export type Status = "confirmed" | "suggested" | "conflict" | "unknown";
export type MasterAttr = { key: AttrKey; label: string; critical: boolean; value: string | null; source: Source | null; status: Status; updatedAt: string | null; candidates: { value: string; source: Source; offers: number }[]; cleared: boolean };

export const SOURCE_AR: Record<Source, string> = { bol: "bol", imported: "ملف مستورد", inferred: "مستنتج من الاسم", manual: "يدوي" };
export const STATUS_AR: Record<Status, string> = { confirmed: "مؤكَّد", suggested: "مقترح", conflict: "تعارض", unknown: "غير معروف" };

const norm = (v: string) => v.trim().toLowerCase();

export function resolveMaster(row: CatalogRow): MasterAttr[] {
  const f = features(row);
  const lastRead = row.listings.map((l) => l.enriched_at ?? l.attrs_synced_at ?? l.last_synced_at).filter(Boolean).sort().at(-1) ?? null;
  // Per-offer structured values from bol (owner per-offer corrections count as manual)
  const perOffer = (pick: (l: CatalogRow["listings"][number]) => [string | null, Source] | null) => {
    const m = new Map<string, { value: string; source: Source; offers: number }>();
    for (const l of row.listings) {
      const hit = pick(l); if (!hit || !hit[0]) continue;
      const k = norm(hit[0]); const cur = m.get(k);
      if (cur) cur.offers++; else m.set(k, { value: hit[0].trim(), source: hit[1], offers: 1 });
    }
    return [...m.values()];
  };
  const bolCands: Partial<Record<AttrKey, { value: string; source: Source; offers: number }[]>> = {
    color: perOffer((l) => (l.variant_color ? [l.variant_color, "manual"] : l.bol_colour ? [l.bol_colour, "bol"] : null)),
    pack_quantity: perOffer((l) => (l.variant_pack != null ? [String(l.variant_pack), "manual"] : l.bol_pack != null ? [String(l.bol_pack), "bol"] : null)),
    variant_name: perOffer((l) => (l.variant_label ? [l.variant_label, "manual"] : null)),
  };
  const inferred: Partial<Record<AttrKey, string | null>> = { brand: f.brand && !/^[\d.,x×-]+$/i.test(f.brand) ? f.brand : null, model: f.model || null, size: f.size || null };

  return ATTRS.map(([key, label, critical]) => {
    const stored = row.storedAttrs.find((a) => a.key === key);
    const cands = bolCands[key] ?? [];
    const base = { key, label, critical, candidates: cands, cleared: false } as const;
    if (stored) {
      if (!stored.value_text) return { ...base, value: null, source: stored.source as Source, status: "unknown" as Status, updatedAt: stored.updated_at, cleared: true };
      return { ...base, value: stored.value_text, source: stored.source as Source, status: stored.status as Status, updatedAt: stored.updated_at };
    }
    if (key === "product_family" && row.familyName) return { ...base, value: row.familyName, source: "manual" as Source, status: "confirmed" as Status, updatedAt: null };
    if (cands.length > 1) return { ...base, value: null, source: null, status: (critical ? "conflict" : "suggested") as Status, updatedAt: lastRead };
    if (cands.length === 1) {
      const c = cands[0]!;
      return { ...base, value: c.value, source: c.source, status: (c.source === "manual" || c.source === "bol" ? "confirmed" : "suggested") as Status, updatedAt: lastRead };
    }
    const inf = inferred[key];
    if (inf) return { ...base, value: inf, source: "inferred" as Source, status: "suggested" as Status, updatedAt: null };
    return { ...base, value: null, source: null, status: "unknown" as Status, updatedAt: null };
  });
}

export type Health = {
  score: number; missingCritical: string[]; conflicts: string[]; unmappedOffers: number; missingTitle: boolean;
  noInventory: boolean; relationshipReview: boolean; needsAttention: boolean; missingMaster: boolean; relationshipIssue: boolean;
};

export function productHealth(row: CatalogRow, attrs = resolveMaster(row)): Health {
  const crit = attrs.filter((a) => a.critical);
  const known = crit.filter((a) => a.value && a.status !== "conflict").length;
  const conflicts = attrs.filter((a) => a.status === "conflict").map((a) => a.label);
  const missingCritical = crit.filter((a) => !a.value && a.status !== "conflict" && !a.cleared).map((a) => a.label);
  const unmappedOffers = row.listings.filter((l) => l.mapping_status !== "CONFIRMED").length;
  const missingTitle = !row.name || /^\d{8,14}$/.test(row.name.trim());
  const noInventory = !row.isBundle && !row.comp;
  const relationshipReview = row.isBundle && (row.relationshipStatus !== "confirmed" || !row.contents.length);
  const missingMaster = missingTitle || known < 2;
  return {
    score: Math.round(((known + (missingTitle ? 0 : 1)) / (crit.length + 1)) * 100),
    missingCritical, conflicts, unmappedOffers, missingTitle, noInventory, relationshipReview,
    missingMaster, relationshipIssue: relationshipReview,
    needsAttention: conflicts.length > 0 || unmappedOffers > 0 || noInventory || relationshipReview || missingTitle,
  };
}

export const REL_AR: Record<string, [string, string]> = {
  MULTIPACK: ["عبوة متعددة (Multipack)", "نفس المنتج الأساسي بعدد أكبر"],
  BUNDLE: ["بندل", "عدة منتجات مختلفة معاً"],
  KIT: ["عُدّة (Kit)", "قطع مختلفة مجمّعة لاستعمال واحد"],
  SET: ["طقم (Set)", "مجموعة قطع مختلفة تُباع معاً"],
};
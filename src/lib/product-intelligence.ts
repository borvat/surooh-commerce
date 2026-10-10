import { resolveMaster, type AttrKey, type MasterAttr } from "@/lib/product-master";
/**
 * Product intelligence: compares imported bol products using several signals
 * (brand, family, model, size, pack, colour, bol contents) and explains WHY.
 * Pure functions — no writes. Every relationship still needs owner confirmation.
 */
import type { CatalogRow } from "@/components/app/catalog";

export type Confidence = "high" | "medium" | "low";
export type Evidence = { ok: boolean; text: string; critical?: boolean; warn?: boolean };

const STOP = new Set(["de", "het", "een", "en", "met", "voor", "van", "the", "and", "for", "with", "set", "stuks", "stuk", "st", "pcs", "x", "pack", "delig"]);

function fold(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function brandOf(name: string): string {
  const m = name.match(/^\s*([A-Za-z0-9&]+)\s*®/) ?? name.match(/([A-Za-z0-9&]+)®/);
  if (m?.[1]) return m[1].toLowerCase();
  const first = fold(name).split(/[^a-z0-9]+/).find(Boolean) ?? "";
  return /^[A-Z0-9]{2,}$/.test(name.trim().split(/\s+/)[0] ?? "") ? first : "";
}

/** Normalised family: meaningful words without brand, numbers-with-units, pack words. */
export function familyOf(name: string): string {
  return fold(name)
    .replace(/[a-z0-9&]+®/g, " ")
    .replace(/\d+([.,]\d+)?\s*(ml|cl|l|ltr|liter|cm|mm|m|kg|g|gram|inch|w|v|mah)\b/g, " ")
    .replace(/\b\d+\s*(x|st|stuks|stuk|pcs|pack|delig|rollen|stuks?)\b/g, " ")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .split(" ").filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
    .slice(0, 5).join(" ");
}

export function sizeOf(name: string): string | null {
  const m = fold(name).match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l|ltr|liter|cm|mm|kg|g|gram|inch|w|mah)\b/);
  return m ? `${m[1]!.replace(",", ".")}${m[2]}` : null;
}

export function modelOf(name: string): string | null {
  const m = name.match(/\b(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9-]{3,}\b/);
  if (!m) return null;
  const v = m[0].toLowerCase();
  return /^\d+(ml|cl|l|ltr|cm|mm|kg|g|gram|st|x|pcs|w|mah|stuks)$/.test(v) ? null : v;
}

export function packOf(r: CatalogRow): number | null {
  const packs = [...new Set(r.listings.map((l) => l.variant_pack ?? l.bol_pack).filter((v): v is number => typeof v === "number" && v > 0))];
  if (packs.length === 1) return packs[0] ?? null;
  if (packs.length > 1) return null;
  const m = fold(r.name ?? "").match(/\b(\d+)\s*(x|st|stuks|stuk|pcs|pack|rollen)\b/);
  return m ? Number(m[1]) : null;
}

export function colorOf(r: CatalogRow): string {
  const c = [...new Set(r.listings.map((l) => (l.variant_color || l.bol_colour || "").trim().toLowerCase()).filter(Boolean))];
  return c.length === 1 ? c[0] ?? "" : "";
}

export type Features = { brand: string; family: string; model: string | null; size: string | null; pack: number | null; color: string; accounts: string[]; words: Set<string> };
export function features(r: CatalogRow): Features {
  const name = r.name ?? "";
  const family = familyOf(name);
  return { brand: brandOf(name), family, model: modelOf(name), size: sizeOf(name), pack: packOf(r), color: colorOf(r), accounts: r.accounts, words: new Set(family.split(" ").filter(Boolean)) };
}

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Evidence + conflicts for "is this the same physical product?" */
export function compareSame(a: CatalogRow, b: CatalogRow) {
  const fa = features(a), fb = features(b);
  const ma = resolveMaster(a), mb = resolveMaster(b);
  const ev: Evidence[] = [];
  const sim = similarity(fa.words, fb.words);
  // Titles never hard-block; they only inform confidence.
  ev.push(sim >= 0.6 ? { ok: true, text: "الاسم متطابق تقريباً" } : sim >= 0.35 ? { ok: true, text: "الاسم متشابه جزئياً" } : { ok: false, warn: true, text: "الاسم مختلف — يحتاج حكمك (لا يمنع الربط)" });
  const trusted = (x?: MasterAttr) => !!x?.value && x.status === "confirmed" && x.source !== "inferred";
  const CRIT: [AttrKey[], string][] = [[["brand"], "العلامة"], [["model", "mpn"], "الموديل"], [["color"], "اللون"], [["size"], "المقاس"], [["pack_quantity"], "العبوة"], [["unit_quantity"], "الكمية لكل قطعة"]];
  for (const [keys, label] of CRIT) {
    for (const key of keys) {
      const x = ma.find((m) => m.key === key), y = mb.find((m) => m.key === key);
      if (x?.status === "conflict" || y?.status === "conflict") { ev.push({ ok: false, warn: true, text: `${label}: عروض أحدهما غير متفقة — راجِع البيانات الأساسية` }); continue; }
      if (!x?.value && !y?.value) { if (key === "pack_quantity") ev.push({ ok: false, warn: true, text: "عدد القطع غير معروف — لا يمنع الربط" }); continue; }
      if (!x?.value || !y?.value) { ev.push({ ok: false, warn: true, text: `${label} غير معروف لأحدهما — غير مؤكد` }); continue; }
      const same = x.value.trim().toLowerCase() === y.value.trim().toLowerCase();
      const both = trusted(x) && trusted(y);
      if (same) ev.push({ ok: true, text: `نفس ${label} (${x.value})${both ? "" : " — غير مؤكد"}` });
      else if (both) ev.push({ ok: false, critical: true, text: `تعارض مؤكد في ${label} (${x.value} / ${y.value})` });
      else ev.push({ ok: false, warn: true, text: `اختلاف/تخمين غير مؤكد في ${label} (${x.value} / ${y.value}) — يحتاج حكمك` });
    }
  }
  if (a.imageUrl && b.imageUrl && a.imageUrl === b.imageUrl) ev.push({ ok: true, text: "نفس الصورة (دعم فقط، لا يؤكد وحده)" });
  const diffAccount = fa.accounts.some((x) => !fb.accounts.includes(x));
  if (diffAccount) ev.push({ ok: true, text: "في حساب bol مختلف فقط" });
  const critical = ev.some((e) => !e.ok && e.critical);
  const okCount = ev.filter((e) => e.ok).length;
  const warns = ev.filter((e) => e.warn).length;
  const confidence: Confidence = critical ? "low" : warns === 0 && sim >= 0.6 && okCount >= 3 ? "high" : warns >= 3 ? "low" : "medium";
  return { evidence: ev, critical, confidence, sim };
}

export type SameSuggestion = { key: string; rows: CatalogRow[]; evidence: Evidence[]; confidence: Confidence; critical: boolean };
export type MultipackSuggestion = { key: string; base: CatalogRow; items: { row: CatalogRow; ratio: number }[]; evidence: Evidence[]; conflicts: string[]; confidence: Confidence };
export type VariantSuggestion = { key: string; rows: CatalogRow[]; differ: string[]; confidence: Confidence };
export type ReviewItem = { key: string; row: CatalogRow; reasons: string[] };

export const keyOf = (kind: string, ids: string[]) => `${kind}:${[...ids].sort().join(",")}`;

function families(rows: CatalogRow[]) {
  const m = new Map<string, CatalogRow[]>();
  for (const r of rows) {
    const f = features(r);
    if (f.family.split(" ").length < 2) continue;
    const k = `${f.brand}|${f.family}`;
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return [...m.values()].filter((g) => g.length > 1);
}

export function analyze(all: CatalogRow[], rejected: Set<string> = new Set()) {
  const rows = all.filter((r) => !r.isBundle && r.listings.length > 0);
  const same: SameSuggestion[] = [];
  const multipack: MultipackSuggestion[] = [];
  const variants: VariantSuggestion[] = [];
  for (const fam of families(rows)) {
    const fs = new Map(fam.map((r) => [r.id, features(r)]));
    // Same product: identical pack/colour/size/model
    const buckets = new Map<string, CatalogRow[]>();
    for (const r of fam) {
      const f = fs.get(r.id)!;
      const k = `${f.pack ?? "?"}|${f.color}|${f.size ?? ""}|${f.model ?? ""}`;
      buckets.set(k, [...(buckets.get(k) ?? []), r]);
    }
    for (const g of buckets.values()) {
      if (g.length < 2) continue;
      const key = keyOf("same", g.map((r) => r.id));
      if (rejected.has(key)) continue;
      const cmp = compareSame(g[0]!, g[1]!);
      same.push({ key, rows: g, evidence: cmp.evidence, confidence: cmp.confidence, critical: cmp.critical });
    }
    // Multipack: same colour+size, different known packs
    const byCS = new Map<string, CatalogRow[]>();
    for (const r of fam) { const f = fs.get(r.id)!; if (!f.pack) continue; const k = `${f.color}|${f.size ?? ""}`; byCS.set(k, [...(byCS.get(k) ?? []), r]); }
    for (const g of byCS.values()) {
      const packs = [...new Set(g.map((r) => fs.get(r.id)!.pack!))].sort((a, b) => a - b);
      if (packs.length < 2) continue;
      const basePack = packs[0]!;
      const base = g.filter((r) => fs.get(r.id)!.pack === basePack).sort((a, b) => (b.comp?.physical_qty ?? 0) - (a.comp?.physical_qty ?? 0))[0]!;
      const items = g.filter((r) => fs.get(r.id)!.pack! > basePack).map((row) => ({ row, ratio: fs.get(row.id)!.pack! / basePack }));
      const key = keyOf("multipack", [base.id, ...items.map((i) => i.row.id)]);
      if (rejected.has(key)) continue;
      const conflicts = items.filter((i) => !Number.isInteger(i.ratio)).map((i) => `${i.row.name}: النسبة ليست عدداً صحيحاً (${i.ratio.toFixed(2)})`);
      if (items.some((i) => i.row.isBundle)) conflicts.push("أحد المنتجات بندل بالفعل");
      const bf = fs.get(base.id)!;
      const evidence: Evidence[] = [
        { ok: true, text: "نفس العائلة والاسم" },
        ...(bf.brand ? [{ ok: true, text: "نفس العلامة التجارية" }] : []),
        ...(bf.color ? [{ ok: true, text: `نفس اللون (${bf.color})` }] : []),
        { ok: true, text: `عبوات مختلفة: ${packs.join(" / ")} قطعة` },
        ...(basePack === 1 ? [{ ok: true, text: "يوجد منتج مفرد يصلح كأساس" }] : [{ ok: false, text: `أصغر عبوة ${basePack} قطع — ليست مفردة` }]),
      ];
      multipack.push({ key, base, items: items.map((i) => ({ ...i, ratio: Math.round(i.ratio) })), evidence, conflicts, confidence: conflicts.length ? "low" : basePack === 1 && bf.color ? "high" : "medium" });
    }
    // Variants: same pack, different colour or size
    const byPack = new Map<string, CatalogRow[]>();
    for (const r of fam) { const f = fs.get(r.id)!; byPack.set(String(f.pack ?? "?"), [...(byPack.get(String(f.pack ?? "?")) ?? []), r]); }
    for (const g of byPack.values()) {
      const colors = new Set(g.map((r) => fs.get(r.id)!.color).filter(Boolean));
      const sizes = new Set(g.map((r) => fs.get(r.id)!.size).filter(Boolean));
      if (colors.size < 2 && sizes.size < 2) continue;
      if (g.every((r) => r.familyKey && r.familyKey === g[0]!.familyKey)) continue;
      const key = keyOf("variant", g.map((r) => r.id));
      if (rejected.has(key)) continue;
      const differ = [...(colors.size > 1 ? [`ألوان: ${[...colors].join("، ")}`] : []), ...(sizes.size > 1 ? [`مقاسات: ${[...sizes].join("، ")}`] : [])];
      variants.push({ key, rows: g, differ, confidence: colors.size > 1 && g.length === colors.size ? "high" : "medium" });
    }
  }
  const review: ReviewItem[] = rows.flatMap((r) => {
    const reasons: string[] = [];
    if (r.needsReview) reasons.push("ربط العرض بالمنتج لم يُؤكَّد بعد");
    if (r.listings.some((l) => l.variant_pack == null && l.bol_pack == null)) reasons.push("عدد القطع غير معروف");
    const packs = new Set(r.listings.map((l) => l.variant_pack ?? l.bol_pack).filter(Boolean));
    if (packs.size > 1) reasons.push("العروض داخل البطاقة بعبوات مختلفة");
    const cols = new Set(r.listings.map((l) => (l.variant_color || l.bol_colour || "").toLowerCase()).filter(Boolean));
    if (cols.size > 1) reasons.push("العروض داخل البطاقة بألوان مختلفة");
    return reasons.length && (r.needsReview || packs.size > 1 || cols.size > 1) ? [{ key: `review:${r.id}`, row: r, reasons }] : [];
  });
  const byConf = (a: { confidence: Confidence }, b: { confidence: Confidence }) => rank(a.confidence) - rank(b.confidence);
  return { same: same.sort(byConf), multipack: multipack.sort(byConf), variants: variants.sort(byConf), review };
}
const rank = (c: Confidence) => (c === "high" ? 0 : c === "medium" ? 1 : 2);

/** Likely components for a bundle: products in the same family with a smaller pack. */
export function suggestComponents(bundle: CatalogRow, all: CatalogRow[]) {
  const fb = features(bundle);
  const contents = bundle.listings.map((l) => l.bol_contents ?? "").join(" ").toLowerCase();
  return all
    .filter((r) => r.id !== bundle.id && !r.isBundle && r.active)
    .map((r) => {
      const f = features(r);
      const sim = similarity(fb.words, f.words);
      const ev: Evidence[] = [];
      if (fb.brand && f.brand === fb.brand) ev.push({ ok: true, text: "نفس العلامة" });
      if (sim >= 0.35) ev.push({ ok: true, text: sim >= 0.6 ? "نفس عائلة المنتج" : "اسم متشابه" });
      if (fb.color && f.color) ev.push(fb.color === f.color ? { ok: true, text: `نفس اللون (${f.color})` } : { ok: false, text: `لون مختلف (${f.color})` });
      let qty = 1;
      if (fb.pack && f.pack && fb.pack > f.pack && fb.pack % f.pack === 0) { qty = fb.pack / f.pack; ev.push({ ok: true, text: `العبوة ${fb.pack} = ${qty} × ${f.pack}` }); }
      const words = [...f.words].filter((w) => w.length > 3);
      if (contents && words.some((w) => contents.includes(w))) ev.push({ ok: true, text: "مذكور في محتويات العلبة على bol" });
      if (r.comp) ev.push({ ok: true, text: "له مخزون في مستودعنا" });
      const score = ev.filter((e) => e.ok).length + sim * 2;
      const confidence: Confidence = score >= 4.5 ? "high" : score >= 3 ? "medium" : "low";
      return { row: r, qty, evidence: ev, confidence, score };
    })
    .filter((s) => s.score >= 2 && s.evidence.some((e) => e.text.includes("عائلة") || e.text.includes("متشابه") || e.text.includes("محتويات")))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export const confLabel: Record<Confidence, string> = { high: "ثقة عالية", medium: "ثقة متوسطة", low: "ثقة منخفضة" };
/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas/semicolons, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const header = (clean.shift() ?? []).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/^\ufeff/, ""),
  );
  return clean.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export const CSV_TEMPLATES = {
  components: {
    title: "Components / physical stock",
    columns: [
      "component_sku",
      "name",
      "barcode",
      "warehouse",
      "physical_qty",
      "safety_stock",
      "low_stock_threshold",
    ],
    example: "GAS-001,Gas Bottle,,WH-MAIN,3000,50,100",
    help: "physical_qty is the counted shelf quantity. The system books the difference as an adjustment in the stock history.",
  },
  products: {
    title: "Products / EANs",
    columns: ["product_sku", "name", "ean", "type"],
    example: "GAS-10,Gas Bottle 10-pack,8712345678906,BUNDLE",
    help: "type is SIMPLE (exactly 1× one component) or BUNDLE.",
  },
  bom: {
    title: "Bundles / BOM",
    columns: ["product_sku", "component_sku", "quantity_required"],
    example: "GAS4-BURNER1,GAS-001,4\nGAS4-BURNER1,BURNER-001,1",
    help: "Each product in the file gets its recipe replaced by exactly the lines in the file.",
  },
  listings: {
    title: "Channel listing mappings",
    columns: [
      "channel_code",
      "product_sku",
      "external_offer_id",
      "external_ean",
      "fulfillment_method",
      "inventory_owner",
      "mapping_status",
    ],
    example: "CH-1,GAS-10,,8712345678906,FBR,INTERNAL,SUGGESTED",
    help: "FBR must be INTERNAL, FBB must be BOL. Only CONFIRMED mappings are ever used for stock sync.",
  },
} as const;

export function downloadTemplate(kind: keyof typeof CSV_TEMPLATES) {
  const t = CSV_TEMPLATES[kind];
  const blob = new Blob([t.columns.join(",") + "\n" + t.example + "\n"], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `qnan-${kind}-template.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

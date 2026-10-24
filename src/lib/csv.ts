/** RFC-4180 CSV reader. Reject ambiguous input before any import can be applied. */
export function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^\ufeff/, "");
  // Count delimiters in the first logical record, ignoring quoted names.
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (ch === "\n" || ch === "\r") break;
      if (ch === ",") commas++;
      if (ch === ";") semicolons++;
    }
  }
  const sep = semicolons > commas ? ";" : ",";
  const rows: { cells: string[]; line: number }[] = [];
  let row: string[] = [];
  let cell = "";
  let state: "plain" | "quoted" | "closed" = "plain";
  let line = 1;
  let startLine = 1;
  const fail = (message: string): never => {
    throw new Error(`CSV · السطر ${line}: ${message}`);
  };
  const finish = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push({ cells: row, line: startLine });
    row = [];
    cell = "";
    state = "plain";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (state === "quoted") {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') state = "closed";
      else {
        cell += ch;
        if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) line++;
      }
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
      state = "plain";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      finish();
      line++;
      startLine = line;
    } else if (ch === '"') {
      if (state !== "plain" || cell !== "") fail("علامة اقتباس في موضع غير صالح");
      state = "quoted";
    } else {
      if (state === "closed") fail("نص بعد إغلاق علامة الاقتباس");
      cell += ch;
    }
  }
  if (state === "quoted") fail("علامة اقتباس غير مغلقة");
  if (cell !== "" || row.length || state === "closed") finish();
  const first = rows.shift();
  if (!first) return [];
  const header = first.cells.map((value) => value.trim().toLowerCase());
  if (header.some((value) => !value)) throw new Error("CSV: اسم عمود فارغ");
  if (new Set(header).size !== header.length) throw new Error("CSV: أسماء أعمدة مكررة");
  return rows.map(({ cells, line: rowLine }) => {
    if (cells.length !== header.length)
      throw new Error(
        `CSV · السطر ${rowLine}: عدد الحقول ${cells.length}؛ المطلوب ${header.length}`,
      );
    return Object.fromEntries(header.map((name, i) => [name, cells[i]!.trim()]));
  });
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

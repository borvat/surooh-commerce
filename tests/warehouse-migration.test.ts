import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("../supabase/migrations/20261010213000_warehouse_events_staging.sql", import.meta.url), "utf8");
describe("warehouse audit migration safety", () => {
  test("uses correct paired PL/pgSQL delimiters", () => {
    const matches = sql.match(/\$\$/g) ?? [];
    expect(matches.length).toBe(4);
    expect(sql).not.toMatch(/AS \$\nBEGIN/);
  });
  test("blocks client table mutation and protects order/channel ownership", () => {
    expect(sql).toContain("REVOKE ALL ON public.warehouse_events FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("warehouse_events_no_update_delete");
    expect(sql).toContain("o.channel_id = NEW.channel_id");
    expect(sql).toContain("c.organization_id = NEW.organization_id");
  });
});

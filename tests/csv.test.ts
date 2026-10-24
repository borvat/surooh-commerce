import { describe, expect, test } from "bun:test";
import { parseCsv } from "../src/lib/csv";

describe("CSV input integrity before import (no database writes)", () => {
  test("keeps quoted delimiters, escaped quotes and multiline values", () => {
    expect(parseCsv('\ufeffSKU,Name,Qty\r\nA,"Box, ""blue""\r\nlarge",1.5\r\n')).toEqual([
      { sku: "A", name: 'Box, "blue"\r\nlarge', qty: "1.5" },
    ]);
  });
  test("chooses semicolon outside quoted header names", () => {
    expect(parseCsv('"name,with,commas";qty\nBox;2')).toEqual([
      { "name,with,commas": "Box", qty: "2" },
    ]);
  });
  test("preserves empty trailing cells and ignores blank records", () => {
    expect(parseCsv("sku,name\n\nA,\nB,Box\n")).toEqual([
      { sku: "A", name: "" },
      { sku: "B", name: "Box" },
    ]);
    expect(parseCsv("")).toEqual([]);
  });
  test("rejects duplicate normalized or empty header names", () => {
    expect(() => parseCsv("SKU, sku\nA,B")).toThrow("مكررة");
    expect(() => parseCsv("sku,\nA,B")).toThrow("فارغ");
  });
  test("rejects excess and missing fields with the physical row number", () => {
    expect(() => parseCsv("sku,qty\nA,1,EXTRA")).toThrow("السطر 2");
    expect(() => parseCsv('sku,name,qty\nA,"two\nlines",1\nB,Box')).toThrow("السطر 4");
  });
  test("rejects unclosed, mid-cell and trailing quote syntax", () => {
    for (const csv of ['sku,name\nA,"Box', 'sku,name\nA,Bo"x', 'sku,name\nA,"Box"x'])
      expect(() => parseCsv(csv)).toThrow("CSV");
  });
});

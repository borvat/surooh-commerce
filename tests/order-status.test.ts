import { describe, expect, test } from "bun:test";
import { matchesOrderStatus } from "../src/lib/order-filters";

describe("native order status filtering", () => {
  const closed = { status: "placed", native_remainder_closed: true };
  test("closed remainders leave the waiting shipment queue and remain discoverable", () => {
    const waiting = { status: "placed", native_remainder_closed: false };
    const rows = [waiting, closed, { status: "fulfilled" }, { status: "cancelled" }];
    expect(rows.filter((row) => matchesOrderStatus(row, "placed"))).toEqual([waiting]);
    expect(rows.filter((row) => matchesOrderStatus(row, "closed"))).toEqual([closed]);
    expect(rows.filter((row) => matchesOrderStatus(row, "all"))).toEqual(rows);
    expect(rows.filter((row) => matchesOrderStatus(row))).toEqual(rows);
  });
  test("legacy and other terminal statuses keep their original meaning", () => {
    expect(matchesOrderStatus({ status: "placed" }, "placed")).toBe(true);
    expect(matchesOrderStatus({ status: "placed" }, "closed")).toBe(false);
    expect(matchesOrderStatus(closed, "fulfilled")).toBe(false);
    expect(matchesOrderStatus(closed, "cancelled")).toBe(false);
    expect(matchesOrderStatus({ status: "fulfilled" }, "fulfilled")).toBe(true);
    expect(matchesOrderStatus({ status: "cancelled" }, "cancelled")).toBe(true);
  });
});

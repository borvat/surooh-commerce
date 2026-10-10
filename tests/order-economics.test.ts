import { describe, expect, test } from "bun:test";
import { calculateOrderEconomics as calc, type CostSource, type OrderEconomicsInput } from "../src/lib/order-economics";
const verified = (cents: number): CostSource => ({ cents, evidence: "VERIFIED", reference: "test" });
const base = (): OrderEconomicsInput => ({
  currency: "EUR", quantity: 2,
  netSalesCents: verified(5000), landedUnitCostCents: verified(1000),
  marketplaceFeeCents: verified(500), outboundShippingCents: verified(400),
  packingCents: verified(100), returnsAndRefundsCents: verified(0), otherCostsCents: verified(0)
});
describe("order economics controls", () => {
  test("calculates verified contribution in integer cents", () => {
    const r = calc(base());
    expect(r.status).toBe("VERIFIED");
    expect(r.contributionCents).toBe(2000);
    expect(r.contributionMarginPct).toBe(40);
  });
  test("never invents margin when a cost is missing", () => {
    const o = base(); o.outboundShippingCents = { cents: null, evidence: "MISSING_INPUT" };
    const r = calc(o); expect(r.status).toBe("MISSING_INPUT");
    expect(r.contributionCents).toBeNull();
    expect(r.missingFields).toContain("outboundShippingCents");
  });
  test("marks unverified inputs as estimated, even when arithmetic is exact", () => {
    const o = base(); o.marketplaceFeeCents.evidence = "ESTIMATED";
    expect(calc(o).status).toBe("ESTIMATED");
  });
  test("returns reduce contribution without changing purchase cost", () => {
    const o = base(); o.returnsAndRefundsCents = verified(1000);
    expect(calc(o).contributionCents).toBe(1000);
  });
  test("verified money without documentary reference is treated as estimated", () => {
    const o = base();
    o.netSalesCents = { cents: 5000, evidence: "VERIFIED" };
    const result = calc(o);
    expect(result.status).toBe("ESTIMATED");
    expect(result.estimatedFields).toContain("netSalesCents");
  });
  test("rejects bad quantity and unsafe or negative money", () => {
    const o = base(); o.quantity = 0;
    expect(() => calc(o)).toThrow();
    o.quantity = 2; o.marketplaceFeeCents = verified(-1);
    expect(calc(o).status).toBe("MISSING_INPUT");
  });
});

/**
 * Pure monetary calculation in integer euro cents.
 * All inputs must be verified or explicitly marked estimates by the caller.
 * This is contribution margin, NOT statutory net profit, tax filing, or an accounting posting.
 * Amounts here are exclusive of recoverable VAT. Do not assume VAT is recoverable.
 */
export type EvidenceLevel = "VERIFIED" | "ESTIMATED" | "MISSING_INPUT";
export type CostSource = { cents: number | null; evidence: EvidenceLevel; reference?: string };
export type OrderEconomicsInput = {
  currency: "EUR";
  quantity: number;
  netSalesCents: CostSource;
  landedUnitCostCents: CostSource;
  marketplaceFeeCents: CostSource;
  outboundShippingCents: CostSource;
  packingCents: CostSource;
  returnsAndRefundsCents: CostSource;
  otherCostsCents: CostSource;
};
export type OrderEconomicsResult = {
  status: EvidenceLevel;
  contributionCents: number | null;
  contributionMarginPct: number | null;
  missingFields: string[];
  estimatedFields: string[];
};
const COST_KEYS = [
  "marketplaceFeeCents", "outboundShippingCents", "packingCents",
  "returnsAndRefundsCents", "otherCostsCents"
] as const;
function validMoney(c: CostSource) {
  return c.cents !== null && Number.isSafeInteger(c.cents) && c.cents >= 0;
}
export function calculateOrderEconomics(input: OrderEconomicsInput): OrderEconomicsResult {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw new Error("Invalid order quantity");
  const fields: { key: string; value: CostSource }[] = [
    { key: "netSalesCents", value: input.netSalesCents },
    { key: "landedUnitCostCents", value: input.landedUnitCostCents },
    ...COST_KEYS.map(key => ({ key, value: input[key] }))
  ];
  const missingFields = fields.filter(f => !validMoney(f.value) || f.value.evidence === "MISSING_INPUT").map(f => f.key);
  const estimatedFields = fields.filter(f => f.value.evidence === "ESTIMATED").map(f => f.key);
  if (missingFields.length) return { status: "MISSING_INPUT", contributionCents: null, contributionMarginPct: null, missingFields, estimatedFields };
  const sales = input.netSalesCents.cents!;
  const inventory = input.landedUnitCostCents.cents! * input.quantity;
  const fees = COST_KEYS.reduce((sum, key) => sum + input[key].cents!, 0);
  const contribution = sales - inventory - fees;
  if (![inventory, fees, contribution].every(Number.isSafeInteger)) throw new Error("Money amount exceeds safe integer range");
  return {
    status: estimatedFields.length ? "ESTIMATED" : "VERIFIED",
    contributionCents: contribution,
    contributionMarginPct: sales > 0 ? Math.round((contribution / sales) * 10000) / 100 : null,
    missingFields, estimatedFields
  };
}

/** For reporting only. Monetary records must retain their separate underlying VAT transactions. */
export function euro(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Invalid cents");
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

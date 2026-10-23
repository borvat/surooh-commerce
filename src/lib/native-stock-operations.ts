import { nativeLabCommand } from "./native-lab-client";

export type LocationStock = {
  company: "TEST-A";
  fulfillment_warehouse: string;
  locations: { name: string; warehouse_name: string; is_rejected_warehouse: number }[];
  bins: {
    warehouse: string;
    item_code: string;
    actual_qty: number;
    reserved_stock: number;
    valuation_rate: number;
    stock_value: number;
    movement_version: string;
  }[];
};

export async function stockLocations(): Promise<LocationStock> {
  const result = await nativeLabCommand("stock_locations", {}, crypto.randomUUID());
  if (
    result["company"] !== "TEST-A" ||
    typeof result["fulfillment_warehouse"] !== "string" ||
    !Array.isArray(result["locations"]) ||
    !Array.isArray(result["bins"])
  )
    throw new Error("Invalid warehouse snapshot");
  const value = result as LocationStock;
  const names = new Set<string>();
  for (const location of value.locations) {
    if (
      !location ||
      typeof location.name !== "string" ||
      !location.name ||
      names.has(location.name) ||
      typeof location.warehouse_name !== "string" ||
      ![0, 1].includes(location.is_rejected_warehouse)
    )
      throw new Error("Invalid warehouse location");
    names.add(location.name);
  }
  if (!names.has(value.fulfillment_warehouse)) throw new Error("Missing fulfillment location");
  const keys = new Set<string>();
  for (const bin of value.bins) {
    if (
      !bin ||
      !names.has(bin.warehouse) ||
      typeof bin.item_code !== "string" ||
      !bin.item_code ||
      typeof bin.movement_version !== "string" ||
      !bin.movement_version ||
      ![bin.actual_qty, bin.reserved_stock, bin.valuation_rate, bin.stock_value].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      )
    )
      throw new Error("Invalid warehouse balance");
    const key = JSON.stringify([bin.warehouse, bin.item_code]);
    if (keys.has(key)) throw new Error("Duplicate warehouse balance");
    keys.add(key);
  }
  return value;
}

export type StockOperation = "location_create" | "stock_transfer" | "stock_count";
export function quarantineReturn(delivery: string, warehouse: string) {
  if (!delivery || !warehouse) throw new Error("Delivery and quarantine location required");
  return nativeLabCommand(
    "return_quarantine",
    { delivery_note: delivery, warehouse, reason: "Customer return awaiting inspection" },
    `ui:return-quarantine:${delivery}`,
  );
}
export function runStockOperation(
  operation: StockOperation,
  payload: Record<string, unknown>,
  requestId: string,
) {
  return nativeLabCommand(operation, payload, requestId);
}

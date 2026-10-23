/** Read-only ERPNext projections. Nothing here persists quantities or valuation. */
import type { Database } from "@/integrations/supabase/types";
import { nativeLabCommand } from "./native-lab-client";
export type NativeItem = {
  id: string;
  name: string;
  stock: boolean;
  barcodes?: string[];
  uom: string;
  created_at: string;
  updated_at: string;
  physical: number;
  reserved: number;
  value: number;
  parts: { item: string; quantity: number; id: string; created_at: string; updated_at: string }[];
};
export type NativeOrder = {
  id: string;
  status: "placed" | "fulfilled" | "cancelled";
  created_at: string;
  updated_at: string;
  pick_list: string | null;
  packing_slip: string | null;
  delivery_note: string | null;
  return_note?: string | null;
  lines: { item: string; quantity: number }[];
};
export type NativeSnapshot = {
  company: string;
  warehouse: string;
  items: NativeItem[];
  orders: NativeOrder[];
  movements: {
    name: string;
    item_code: string;
    actual_qty: number;
    stock_value_difference: number;
    voucher_type: string;
    voucher_no: string;
    posting_date: string;
  }[];
};
export async function nativeSnapshot(): Promise<NativeSnapshot> {
  const result = await nativeLabCommand("snapshot", {}, `read:${crypto.randomUUID()}`);
  if (
    result["company"] !== "TEST-A" ||
    !Array.isArray(result["items"]) ||
    !Array.isArray(result["orders"]) ||
    !Array.isArray(result["movements"])
  )
    throw new Error("Invalid native projection");
  return result as unknown as NativeSnapshot;
}
export async function nativeComponents(): Promise<
  Database["public"]["Views"]["v_component_availability"]["Row"][]
> {
  const data = await nativeSnapshot();
  return data.items
    .filter((x) => x.stock)
    .map((x) => ({
      id: x.id,
      name: x.name,
      sku: x.id,
      organization_id: data.company,
      active: true,
      archived_at: null,
      barcode: null,
      unit_of_measure: x.uom,
      created_at: x.created_at,
      updated_at: x.updated_at,
      physical_qty: x.physical,
      reserved_qty: x.reserved,
      available_qty: x.physical - x.reserved,
      safety_stock: null,
      low_stock_threshold: null,
      is_low: null,
    }));
}
export async function nativeProducts(): Promise<
  Database["public"]["Views"]["v_product_availability"]["Row"][]
> {
  const data = await nativeSnapshot();
  return data.items.map((x) => {
    const parts = x.parts.length ? x.parts : [{ item: x.id, quantity: 1 }];
    const available = parts.map((p) => {
      const item = data.items.find((v) => v.id === p.item);
      return Math.floor(Math.max(0, (item?.physical ?? 0) - (item?.reserved ?? 0)) / p.quantity);
    });
    const min = Math.min(...available);
    return {
      id: x.id,
      name: x.name,
      sku: x.id,
      organization_id: data.company,
      active: true,
      archived_at: null,
      created_at: x.created_at,
      updated_at: x.updated_at,
      ean: null,
      available_qty: min,
      bom_line_count: parts.length,
      bottleneck_sku: parts[available.indexOf(min)]?.item ?? null,
      product_type: x.parts.length ? "BUNDLE" : "SIMPLE",
    };
  });
}
export async function nativeBom(): Promise<Database["public"]["Tables"]["bom_lines"]["Row"][]> {
  const data = await nativeSnapshot();
  return data.items.flatMap((x) =>
    (x.parts.length
      ? x.parts
      : x.stock
        ? [
            {
              item: x.id,
              quantity: 1,
              id: x.id,
              created_at: x.created_at,
              updated_at: x.updated_at,
            },
          ]
        : []
    ).map((p) => ({
      id: p.id,
      product_id: x.id,
      component_id: p.item,
      quantity_required: p.quantity,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
  );
}
export async function nativeLinks() {
  return (await nativeSnapshot()).items.map((x) => ({
    id: x.id,
    stock_component_id: x.stock ? x.id : null,
    image_url: null,
    is_demo: false,
    primary_listing_id: null,
    master_reference: x.id,
    family_key: null,
    family_id: null,
    relationship_type: x.parts.length ? "BUNDLE" : null,
    relationship_status: x.parts.length ? "CONFIRMED" : "none",
  }));
}
type OrderProjection = Database["public"]["Tables"]["orders"]["Row"] & {
  sales_channels: { name: string } | null;
  order_lines: {
    quantity: number;
    fulfillment_method: "FBR" | "FBB";
    inventory_owner: string | null;
    remote_status: string | null;
    products: {
      sku: string;
      name: string;
      ean: string | null;
      master_reference: string | null;
    } | null;
  }[];
};
export async function nativeOrders(): Promise<OrderProjection[]> {
  const data = await nativeSnapshot();
  return data.orders.map((x) => ({
    id: x.id,
    organization_id: data.company,
    warehouse_id: data.warehouse,
    status: x.status,
    created_at: x.created_at,
    updated_at: x.updated_at,
    created_by: null as string | null,
    note: null as string | null,
    order_number: Number(x.id.split("-").at(-1)),
    external_ref: x.id,
    channel_id: null,
    cancelled_at: null,
    fulfilled_at: null,
    sales_channels: null as { name: string } | null,
    order_lines: x.lines.map((l) => ({
      quantity: l.quantity,
      fulfillment_method: "FBR" as "FBR" | "FBB",
      inventory_owner: "INTERNAL",
      remote_status: null,
      products: {
        sku: l.item,
        name: data.items.find((i) => i.id === l.item)?.name ?? l.item,
        ean: null,
        master_reference: l.item,
      },
    })),
  }));
}

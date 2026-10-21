import type { OrderSearchOptions } from "./inventory";

/** Pure, client-side filtering for the currently loaded order page.
 * IMPORTANT: pagination happens on the server. A filtered result is not a global count;
 * for complete historical filtering, add authorized database-side filters.
 */
export type OrderFilterInput = {
  order_number?: number | string | null;
  external_ref?: string | null;
  created_at?: string | null;
  status?: string | null;
  sales_channels?: { name?: string | null } | null;
  order_lines?: Array<{
    fulfillment_method?: string | null;
    quantity?: number | null;
    products?: { sku?: string | null; name?: string | null } | null;
  }> | null;
};
export type OrderFilters = {
  query?: string;
  account?: string;
  fulfillment?: "all" | "FBR" | "FBB";
  from?: string;
  to?: string;
};
export function filterLoadedOrders<T extends OrderFilterInput>(rows: T[], filters: OrderFilters): T[] {
  const needle = (filters.query ?? "").trim().toLocaleLowerCase();
  const start = filters.from ? Date.parse(filters.from + "T00:00:00") : NaN;
  const end = filters.to ? Date.parse(filters.to + "T23:59:59.999") : NaN;
  return rows.filter(o => {
    if (filters.account && filters.account !== "all" && o.sales_channels?.name !== filters.account) return false;
    if (filters.fulfillment && filters.fulfillment !== "all" && !o.order_lines?.some(l => l.fulfillment_method === filters.fulfillment)) return false;
    const date = o.created_at ? Date.parse(o.created_at) : NaN;
    if (Number.isFinite(start) && !(date >= start)) return false;
    if (Number.isFinite(end) && !(date <= end)) return false;
    if (!needle) return true;
    const haystack = [
      o.order_number, o.external_ref, o.status, o.sales_channels?.name,
      ...(o.order_lines ?? []).flatMap(l => [l.products?.sku, l.products?.name])
    ].filter(v => v != null).join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

/** Keep empty UI filters absent while preserving the existing server-query behavior. */
export function toOrderSearchOptions(input: {
  page: number; status: string; account: string; from: string; to: string; reference: string;
}): OrderSearchOptions {
  return {
    page: input.page,
    status: input.status,
    ...(input.account !== "all" ? { accountId: input.account } : {}),
    ...(input.from ? { from: input.from } : {}),
    ...(input.to ? { to: input.to } : {}),
    ...(input.reference ? { externalRef: input.reference } : {}),
  };
}

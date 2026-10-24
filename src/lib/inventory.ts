import {
  nativeComponents,
  nativeProducts,
  nativeBom,
  nativeLinks,
  nativeOrders,
} from "./native-projection";
/**
 * Inventory service layer. All UI and future channel integrations (bol.com)
 * go through this module. Every stock mutation is executed by a transactional
 * database function — never computed in client state.
 */
import { supabase as legacySupabase } from "@/integrations/supabase/client";
import { nativeLabCommand, nativeLabConfigured } from "./native-lab-client";
import { matchesOrderStatus } from "./order-filters";

// A selected native session may never silently reach the legacy stock writer.
const supabase = new Proxy(legacySupabase, {
  get(target, property, receiver) {
    if (nativeLabConfigured())
      throw new Error("Legacy inventory access disabled during native lab session");
    return Reflect.get(target, property, receiver);
  },
});
import type { Database } from "@/integrations/supabase/types";

export type MovementType = Database["public"]["Enums"]["movement_type"];
export type Role = Database["public"]["Enums"]["app_role"];
export type ComponentRow = Database["public"]["Views"]["v_component_availability"]["Row"];
export type ProductRow = Database["public"]["Views"]["v_product_availability"]["Row"];

export type FulfillmentMethod = Database["public"]["Enums"]["fulfillment_method"];
export type MappingStatus = Database["public"]["Enums"]["mapping_status"];
export type ListingSyncRow = Database["public"]["Views"]["v_listing_sync"]["Row"];

export const PAGE_SIZE = 50;

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return "Something went wrong";
}

function check<T>(res: { data: T; error: unknown; count?: number | null }) {
  if (res.error) throw res.error;
  return res.data;
}

/** The signed-in user's company. The database also enforces/derives it on insert. */
export async function orgId(): Promise<string> {
  if (nativeLabConfigured())
    return String(
      (await nativeLabCommand("identity", {}, `identity:${crypto.randomUUID()}`))["company"],
    );
  const { data, error } = await supabase.rpc("current_org_id");
  if (error) throw error;
  if (!data) throw new Error("You are not a member of any company");
  return data as string;
}

// ---------- Components ----------
export async function listComponents(opts: { search?: string; page?: number; status?: string }) {
  const page = opts.page ?? 0;
  let q = supabase
    .from("v_component_availability")
    .select("*", { count: "exact" })
    .order("sku")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (opts.search)
    q = q.or(
      `sku.ilike.%${opts.search}%,name.ilike.%${opts.search}%,barcode.ilike.%${opts.search}%`,
    );
  if (opts.status === "active") q = q.eq("active", true);
  if (opts.status === "inactive") q = q.eq("active", false);
  if (opts.status === "low") q = q.eq("is_low", true).eq("active", true);
  const res = await q;
  if (res.error) throw res.error;
  return { rows: res.data ?? [], count: res.count ?? 0 };
}

export async function allComponents() {
  if (nativeLabConfigured()) return nativeComponents();
  return check(await supabase.from("v_component_availability").select("*").order("sku")) ?? [];
}

export async function getComponent(id: string) {
  return check(await supabase.from("v_component_availability").select("*").eq("id", id).single());
}

export async function componentDependents(componentId: string) {
  const lines =
    check(
      await supabase
        .from("bom_lines")
        .select("product_id, quantity_required")
        .eq("component_id", componentId),
    ) ?? [];
  if (!lines.length) return [];
  const products =
    check(
      await supabase
        .from("v_product_availability")
        .select("*")
        .in(
          "id",
          lines.map((l) => l.product_id!),
        ),
    ) ?? [];
  return products
    .map((p) => ({
      ...p,
      quantity_required: lines.find((l) => l.product_id === p.id)!.quantity_required,
    }))
    .sort((a, b) => (a.sku ?? "").localeCompare(b.sku ?? ""));
}

export async function saveComponent(input: {
  id?: string | undefined;
  sku: string;
  name: string;
  barcode: string | null;
  unit_of_measure: string;
  safety_stock: number;
  low_stock_threshold: number;
  active: boolean;
}) {
  const { id, ...rest } = input;
  const payload = { ...rest, archived_at: rest.active ? null : new Date().toISOString() };
  if (id) {
    check(await supabase.from("components").update(payload).eq("id", id));
    return id;
  }
  const row = check(
    await supabase
      .from("components")
      .insert({ ...payload, organization_id: await orgId() })
      .select("id")
      .single(),
  );
  return row!.id as string;
}

// ---------- Products / BOM ----------
export async function listProducts(opts: {
  search?: string;
  page?: number;
  status?: string;
  type?: string;
}) {
  const page = opts.page ?? 0;
  let q = supabase
    .from("v_product_availability")
    .select("*", { count: "exact" })
    .order("sku")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (opts.search)
    q = q.or(`sku.ilike.%${opts.search}%,name.ilike.%${opts.search}%,ean.ilike.%${opts.search}%`);
  if (opts.status === "active") q = q.eq("active", true);
  if (opts.status === "inactive") q = q.eq("active", false);
  if (opts.status === "zero") q = q.eq("available_qty", 0);
  if (opts.type === "SIMPLE" || opts.type === "BUNDLE") q = q.eq("product_type", opts.type);
  const res = await q;
  if (res.error) throw res.error;
  return { rows: res.data ?? [], count: res.count ?? 0 };
}

export async function allProducts() {
  if (nativeLabConfigured()) return nativeProducts();
  return check(await supabase.from("v_product_availability").select("*").order("sku")) ?? [];
}

export async function saveProduct(input: {
  id?: string | undefined;
  sku: string;
  name: string;
  ean: string | null;
  product_type: "SIMPLE" | "BUNDLE";
  active: boolean;
}) {
  const { id, ...rest } = input;
  const payload = { ...rest, archived_at: rest.active ? null : new Date().toISOString() };
  if (id) {
    check(await supabase.from("products").update(payload).eq("id", id));
    return id;
  }
  const row = check(
    await supabase
      .from("products")
      .insert({ ...payload, organization_id: await orgId() })
      .select("id")
      .single(),
  );
  return row!.id as string;
}

export async function getBom(productId: string) {
  return (
    check(
      await supabase
        .from("bom_lines")
        .select("id, component_id, quantity_required, components(sku, name)")
        .eq("product_id", productId)
        .order("created_at"),
    ) ?? []
  );
}

export async function allBomLines() {
  if (nativeLabConfigured()) return nativeBom();
  return (
    check(
      await supabase
        .from("bom_lines")
        .select("product_id, component_id, quantity_required, components(sku)"),
    ) ?? []
  );
}

export async function setBom(
  productId: string,
  lines: { component_id: string; quantity_required: number }[],
) {
  check(await supabase.rpc("set_product_bom", { _product_id: productId, _lines: lines }));
}

export async function ordersTodayCount() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const res = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  if (res.error) throw res.error;
  return res.count ?? 0;
}

// ---------- Stock movements ----------
export async function listMovements(opts: {
  page?: number;
  type?: string;
  componentId?: string;
  limit?: number;
}) {
  const page = opts.page ?? 0;
  const size = opts.limit ?? PAGE_SIZE;
  let q = supabase
    .from("stock_movements")
    .select("*, components(sku, name), orders(order_number)", { count: "exact" })
    .order("id", { ascending: false })
    .range(page * size, page * size + size - 1);
  if (opts.type && opts.type !== "all") q = q.eq("movement_type", opts.type as MovementType);
  if (opts.componentId) q = q.eq("component_id", opts.componentId);
  const res = await q;
  if (res.error) throw res.error;
  return { rows: res.data ?? [], count: res.count ?? 0 };
}

export async function postMovement(input: {
  componentId: string;
  type: MovementType;
  quantity: number;
  reason: string;
  reference?: string;
  nativeRate?: number;
}) {
  if (nativeLabConfigured()) {
    if (
      input.type !== "receipt" ||
      !input.reference ||
      !input.nativeRate ||
      !Number.isFinite(input.nativeRate) ||
      input.nativeRate <= 0
    )
      throw new Error(
        "Native receipt requires a stable request ID and positive unit cost; other adjustments are unsupported",
      );
    await nativeLabCommand(
      "receive",
      { items: [{ item: input.componentId, qty: input.quantity, rate: input.nativeRate }] },
      input.reference,
    );
    return;
  }
  check(
    await supabase.rpc("post_stock_movement", {
      _component_id: input.componentId,
      _movement_type: input.type,
      _quantity: input.quantity,
      _reason: input.reason,
      ...(input.reference ? { _reference: input.reference } : {}),
    }),
  );
}

// ---------- Orders ----------
export type OrderSearchOptions = {
  page?: number;
  status?: string;
  accountId?: string;
  externalRef?: string;
  from?: string;
  to?: string;
};
/** Server-filtered through tenant-scoped Supabase RLS.
 * Product text and SKU require a verified server-side search RPC and are not supported here.
 */
export async function listOrders(opts: OrderSearchOptions) {
  if (nativeLabConfigured()) {
    const rows = (await nativeOrders()).filter(
      (x) =>
        matchesOrderStatus(x, opts.status) &&
        (!opts.externalRef || x.external_ref?.includes(opts.externalRef)) &&
        (!opts.accountId || x.channel_id === opts.accountId) &&
        (!opts.from || Date.parse(x.created_at) >= Date.parse(`${opts.from}T00:00:00Z`)) &&
        (!opts.to || Date.parse(x.created_at) < Date.parse(`${opts.to}T00:00:00Z`) + 86400000),
    );
    const start = (opts.page ?? 0) * PAGE_SIZE;
    return { rows: rows.slice(start, start + PAGE_SIZE), count: rows.length };
  }
  const page = opts.page ?? 0;
  let q = supabase
    .from("orders")
    .select(
      "*, sales_channels(name), order_lines(quantity, fulfillment_method, inventory_owner, remote_status, products(sku, name, ean, master_reference))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (opts.status && opts.status !== "all")
    q = q.eq("status", opts.status as "placed" | "fulfilled" | "cancelled");
  if (opts.accountId) q = q.eq("channel_id", opts.accountId);
  if (opts.externalRef?.trim())
    q = q.ilike(
      "external_ref",
      `%${opts.externalRef.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
    );
  if (opts.from) q = q.gte("created_at", opts.from + "T00:00:00Z");
  if (opts.to) {
    const nextDay = new Date(opts.to + "T00:00:00Z");
    if (!Number.isNaN(nextDay.getTime())) {
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      q = q.lt("created_at", nextDay.toISOString());
    }
  }
  const res = await q;
  if (res.error) throw res.error;
  return { rows: res.data ?? [], count: res.count ?? 0 };
}

export async function placeOrder(input: {
  lines: { product_id: string; quantity: number; fulfillment_method?: FulfillmentMethod }[];
  channelId?: string;
  externalRef?: string;
  note?: string;
}) {
  if (nativeLabConfigured()) {
    if (!input.externalRef) throw new Error("Native order requires a stable external request ID");
    if (input.channelId || input.lines.some((line) => line.fulfillment_method === "FBB"))
      throw new Error("Only synthetic manual internal orders are supported by this native probe");
    const result = await nativeLabCommand("order", { lines: input.lines }, input.externalRef);
    return String(result["order_id"]);
  }
  return check(
    await supabase.rpc("place_order", {
      _lines: input.lines,
      ...(input.channelId ? { _channel_id: input.channelId } : {}),
      ...(input.externalRef ? { _external_ref: input.externalRef } : {}),
      ...(input.note ? { _note: input.note } : {}),
    }),
  );
}

export async function fulfillOrder(id: string) {
  if (nativeLabConfigured()) {
    await nativeLabCommand("ship", { order_id: id }, `ship:${id}`);
    return;
  }
  check(await supabase.rpc("fulfill_order", { _order_id: id }));
}
export async function cancelOrder(id: string) {
  if (nativeLabConfigured()) {
    await nativeLabCommand("cancel", { order_id: id }, `cancel:${id}`);
    return;
  }
  check(await supabase.rpc("cancel_order", { _order_id: id }));
}

// ---------- Channels / Settings ----------
export async function listChannels() {
  if (nativeLabConfigured()) return [];
  return (
    check(
      await supabase.from("sales_channels").select("*, channel_listings(count)").order("code"),
    ) ?? []
  );
}

export async function listWarehouses() {
  return check(await supabase.from("warehouses").select("*").order("code")) ?? [];
}

// ---------- Organization ----------
export async function getMyOrg() {
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return null;
  return check(await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle());
}
export async function listMembers(orgId: string) {
  const [m, p] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", orgId),
    supabase.from("profiles").select("id, email, display_name"),
  ]);
  const members = check(m) ?? [];
  const profiles = check(p) ?? [];
  return members.map((x) => ({
    ...x,
    email: profiles.find((u) => u.id === x.user_id)?.email ?? x.user_id,
  }));
}
export async function setMemberRole(orgId: string, email: string, role: Role) {
  check(await supabase.rpc("set_member_role", { _org: orgId, _email: email, _role: role }));
}
export async function removeMember(orgId: string, userId: string) {
  check(await supabase.rpc("remove_member", { _org: orgId, _user_id: userId }));
}

export async function listAudit(page = 0) {
  const res = await supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("id", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (res.error) throw res.error;
  return { rows: res.data ?? [], count: res.count ?? 0 };
}

export async function reconciliation() {
  return check(await supabase.from("v_stock_reconciliation").select("*")) ?? [];
}

// ---------- Channel settings, listings & sync safety ----------
export async function updateChannelSettings(
  id: string,
  v: { stock_buffer: number; stock_cap: number | null },
) {
  check(await supabase.from("sales_channels").update(v).eq("id", id));
}
export async function listListingSync() {
  return (
    check(
      await supabase.from("v_listing_sync").select("*").order("channel_code").order("product_sku"),
    ) ?? []
  );
}
export async function saveListing(input: {
  id?: string | undefined;
  channel_id: string;
  product_id: string | null;
  external_offer_id: string | null;
  external_ean: string | null;
  fulfillment_method: FulfillmentMethod;
  mapping_status: MappingStatus;
  active: boolean;
  note?: string | null;
}) {
  const row = {
    ...input,
    inventory_owner: input.fulfillment_method === "FBB" ? ("BOL" as const) : ("INTERNAL" as const),
  };
  const { id, ...rest } = row;
  if (id) check(await supabase.from("channel_listings").update(rest).eq("id", id));
  else
    check(
      await supabase.from("channel_listings").insert({ ...rest, organization_id: await orgId() }),
    );
}
export async function planStockSync(channelId: string) {
  return check(await supabase.rpc("plan_stock_sync", { _channel_id: channelId })) as number;
}
export async function listOutbox() {
  return (
    check(
      await supabase
        .from("inventory_outbox")
        .select("*")
        .order("id", { ascending: false })
        .limit(50),
    ) ?? []
  );
}

// ---------- CSV imports (server validates; apply is all-or-nothing) ----------
export type ImportKind = "components" | "products" | "bom" | "listings";
export type ImportResult = {
  ok: boolean;
  applied: boolean;
  errors: { row: number; message: string }[];
  warnings?: { row: number; message: string }[];
  rows: number;
  creates?: number;
  updates?: number;
  products?: number;
};
export async function runImport(kind: ImportKind, rows: Record<string, string>[], apply: boolean) {
  const fn = (
    {
      components: "import_components",
      products: "import_products",
      bom: "import_bom",
      listings: "import_listings",
    } as const
  )[kind];
  return check(await supabase.rpc(fn, { _rows: rows, _apply: apply })) as unknown as ImportResult;
}

// ---------- Acceptance test (runs in the database, fully rolled back) ----------
export type AcceptanceResult = {
  ok: boolean;
  error?: string;
  checks: { step: string; check: string; expected: number; actual: number; pass: boolean }[];
};
export async function runAcceptanceTest() {
  return check(await supabase.rpc("run_acceptance_test")) as unknown as AcceptanceResult;
}

// ---------- bol-first catalog ----------
export async function listCatalogListings() {
  if (nativeLabConfigured()) return [];
  return (
    check(
      await supabase
        .from("channel_listings")
        .select(
          "id, channel_id, product_id, external_offer_id, external_ean, bol_product_id, reference, title, bol_stock, bol_corrected_stock, fulfillment_method, mapping_status, active, for_sale, remote_modified_at, last_synced_at, unit_price, condition, enriched_at, attrs_synced_at, variant_label, variant_color, variant_pack, bol_colour, bol_pack, bol_contents",
        )
        .eq("active", true)
        .order("created_at"),
    ) ?? []
  );
}
export async function listProductLinks() {
  if (nativeLabConfigured()) return nativeLinks();
  return (
    check(
      await supabase
        .from("products")
        .select(
          "id, stock_component_id, image_url, is_demo, primary_listing_id, master_reference, family_key, family_id, relationship_type, relationship_status",
        ),
    ) ?? []
  );
}
export async function channelCredentialStatus() {
  return (check(await supabase.rpc("channel_credential_status")) ?? []) as {
    channel_id: string;
    client_id_last4: string;
    status: string;
    last_error: string | null;
    updated_at: string;
  }[];
}
export async function setBundleContents(
  productId: string,
  items: { product_id: string; qty: number }[],
  requestId?: string,
) {
  if (nativeLabConfigured()) {
    if (!requestId) throw new Error("Native bundle edits require a stable command identity");
    await nativeLabCommand("bundle", { product_id: productId, contents: items }, requestId);
    return;
  }
  check(await supabase.rpc("set_bundle_contents", { _product_id: productId, _items: items }));
}
export async function setProductNormal(productId: string) {
  check(await supabase.rpc("set_product_normal", { _product_id: productId }));
}
export async function setStockItem(productId: string) {
  return check(
    await supabase.rpc("set_product_as_stock_item", { _product_id: productId }),
  ) as string;
}
export async function confirmListing(listingId: string, productId: string) {
  check(await supabase.rpc("confirm_listing", { _listing_id: listingId, _product_id: productId }));
}

export async function setChannelCompany(channelId: string, company: Record<string, unknown>) {
  const { error } = await supabase.rpc(
    "set_channel_company" as never,
    { _channel_id: channelId, _company: company } as never,
  );
  if (error) throw error;
}
/** Links offers to ONE internal product. Stock is never summed: pass keepTarget or an explicit stockValue. */
export async function mergeProducts(
  target: string,
  sources: string[],
  stock?: { keepTarget?: boolean; stockValue?: number | null },
  masterReference?: string | null,
) {
  check(
    await supabase.rpc(
      "merge_products" as never,
      {
        _target: target,
        _sources: sources,
        ...(stock?.stockValue != null ? { _stock_value: stock.stockValue } : {}),
        ...(stock?.keepTarget ? { _keep_target: true } : {}),
        ...(masterReference?.trim() ? { _master_reference: masterReference.trim() } : {}),
      } as never,
    ),
  );
}

// ---------- Review decisions (internal only, never sent to bol) ----------
export async function listReviewDecisions() {
  const { data, error } = await supabase
    .from("product_review_decisions" as never)
    .select("kind, product_ids, decision");
  if (error) throw error;
  return (data ?? []) as unknown as { kind: string; product_ids: string[]; decision: string }[];
}
export async function saveReviewDecision(
  kind: "same" | "multipack" | "variant",
  productIds: string[],
  decision: "confirmed" | "rejected",
) {
  const { error } = await supabase
    .from("product_review_decisions" as never)
    .insert({ organization_id: await orgId(), kind, product_ids: productIds, decision } as never);
  if (error) throw error;
}
export async function setFamily(productIds: string[], familyKey: string | null) {
  check(
    await supabase
      .from("products")
      .update({ family_key: familyKey } as never)
      .in("id", productIds),
  );
}
export async function unmergeListing(listingId: string) {
  check(await supabase.rpc("unmerge_listing" as never, { _listing_id: listingId } as never));
}
export async function setPrimaryListing(listingId: string) {
  check(await supabase.rpc("set_primary_listing" as never, { _listing_id: listingId } as never));
}
export async function setProductMaster(productId: string, name: string, masterReference: string) {
  check(
    await supabase.rpc(
      "set_product_master" as never,
      { _product_id: productId, _name: name, _master_reference: masterReference } as never,
    ),
  );
}
export async function setListingVariant(
  listingId: string,
  label: string,
  color: string,
  pack: number | null,
) {
  check(
    await supabase.rpc(
      "set_listing_variant" as never,
      { _listing_id: listingId, _label: label, _color: color, _pack: pack } as never,
    ),
  );
}

// ---------- Product Master (internal only — never sent to bol) ----------
export type StoredAttribute = {
  product_id: string;
  key: string;
  value_text: string | null;
  source: string;
  status: string;
  updated_at: string;
};
export async function listProductAttributes() {
  if (nativeLabConfigured()) return [];
  return (check(
    await supabase
      .from("product_attributes" as never)
      .select("product_id, key, value_text, source, status, updated_at")
      .limit(20000),
  ) ?? []) as StoredAttribute[];
}
export async function listFamilies() {
  if (nativeLabConfigured()) return [];
  return (check(
    await supabase
      .from("product_families" as never)
      .select("id, name")
      .order("name"),
  ) ?? []) as { id: string; name: string }[];
}
export async function setProductAttribute(
  productId: string,
  key: string,
  value: string | null,
  source: string,
  status: string,
) {
  check(
    await supabase.rpc(
      "set_product_attribute" as never,
      {
        _product_id: productId,
        _key: key,
        _value: value,
        _source: source,
        _status: status,
      } as never,
    ),
  );
}
export async function resetProductAttribute(productId: string, key: string) {
  check(
    await supabase.rpc(
      "reset_product_attribute" as never,
      { _product_id: productId, _key: key } as never,
    ),
  );
}
export async function setProductFamily(productId: string, name: string | null) {
  check(
    await supabase.rpc(
      "set_product_family" as never,
      { _product_id: productId, _name: name } as never,
    ),
  );
}
export async function setProductRelationship(
  productId: string,
  type: string | null,
  status: string,
) {
  check(
    await supabase.rpc(
      "set_product_relationship" as never,
      { _product_id: productId, _type: type, _status: status } as never,
    ),
  );
}

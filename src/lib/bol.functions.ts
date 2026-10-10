import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database> };

async function requireAdminForChannel(ctx: Ctx, channelId: string) {
  const { data: ch, error } = await ctx.supabase.from("sales_channels").select("id, organization_id").eq("id", channelId).maybeSingle();
  if (error || !ch) throw new Error("Account not found");
  const { data: ok } = await ctx.supabase.rpc("has_org_role", { _org: ch.organization_id, _roles: ["admin"] });
  if (!ok) throw new Error("Only company admins can manage bol.com accounts");
  return ch;
}

async function loadToken(channelId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptSecret, bolToken } = await import("./bol.server");
  const { data: cred } = await supabaseAdmin.from("channel_credentials").select("*").eq("channel_id", channelId).maybeSingle();
  if (!cred) throw new Error("No bol.com login details saved for this account yet");
  const secret = await decryptSecret(cred.secret_ciphertext, cred.secret_iv);
  return bolToken(cred.client_id, secret);
}

async function markCred(channelId: string, status: string, err: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("channel_credentials").update({ status, last_error: err, updated_at: new Date().toISOString() }).eq("channel_id", channelId);
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const saveBolCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid(), clientId: z.string().trim().min(8).max(200), clientSecret: z.string().trim().min(8).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const ch = await requireAdminForChannel(context, data.channelId);
    const { encryptSecret, bolToken } = await import("./bol.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const enc = await encryptSecret(data.clientSecret);
    const { error } = await supabaseAdmin.from("channel_credentials").upsert({
      channel_id: ch.id, organization_id: ch.organization_id, client_id: data.clientId, client_id_last4: data.clientId.slice(-4),
      secret_ciphertext: enc.ciphertext, secret_iv: enc.iv, status: "saved", last_error: null, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    try {
      await bolToken(data.clientId, data.clientSecret);
      await markCred(ch.id, "verified", null);
      await context.supabase.rpc("set_channel_status", { _channel_id: ch.id, _status: "connected", _message: "" });
      await supabaseAdmin.from("sales_channels").update({ is_demo: false }).eq("id", ch.id);
      return { ok: true as const };
    } catch (e) {
      await markCred(ch.id, "error", msg(e));
      await context.supabase.rpc("set_channel_status", { _channel_id: ch.id, _status: "error", _message: msg(e) });
      return { ok: false as const, error: msg(e) };
    }
  });

export const startBolImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminForChannel(context, data.channelId);
    const { startOfferExport } = await import("./bol.server");
    try {
      const token = await loadToken(data.channelId);
      return { processId: await startOfferExport(token) };
    } catch (e) {
      await context.supabase.rpc("set_channel_status", { _channel_id: data.channelId, _status: "error", _message: msg(e) });
      throw e;
    }
  });

export const checkBolImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid(), processId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminForChannel(context, data.channelId);
    const { checkProcess, downloadOfferExport } = await import("./bol.server");
    const token = await loadToken(data.channelId);
    const ps = await checkProcess(token, data.processId);
    if (ps.status === "PENDING") return { state: "pending" as const };
    if (ps.status !== "SUCCESS" || !ps.entityId) throw new Error(`bol.com export failed: ${ps.errorMessage ?? ps.status}`);
    const offers = await downloadOfferExport(token, ps.entityId);
    const { data: res, error } = await context.supabase.rpc("upsert_bol_offers", { _channel_id: data.channelId, _offers: offers, _full: true });
    if (error) throw new Error(error.message);
    return { state: "done" as const, result: res as ImportSummary };
  });

export type ImportSummary = { imported: number; new_products: number; needs_review: number; bundles: number };

/** Resolve an offer's actual bol webshop page by its EAN, not by a search query. */
export const getBolProductPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: listing, error } = await context.supabase.from("channel_listings")
      .select("id, channel_id, external_ean, bol_product_id")
      .eq("id", data.listingId).maybeSingle();
    if (error || !listing) throw new Error("لم نجد هذا العرض في حسابك");
    if (listing.bol_product_id) return { productId: listing.bol_product_id };
    if (!listing.external_ean || !/^\d{8,14}$/.test(listing.external_ean)) return { productId: null };
    const { fetchBolProductId } = await import("./bol.server");
    const productId = await fetchBolProductId(await loadToken(listing.channel_id), listing.external_ean);
    if (productId) {
      const { data: channel } = await context.supabase.from("sales_channels").select("organization_id").eq("id", listing.channel_id).single();
      if (channel) {
        const { data: admin } = await context.supabase.rpc("has_org_role", { _org: channel.organization_id, _roles: ["admin"] });
        if (admin) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("channel_listings").update({ bol_product_id: productId }).eq("id", listing.id);
        }
      }
    }
    return { productId };
  });

/** Pull the connected shop's own identity from bol.com (name, retailer id, rating). */
export const syncBolShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminForChannel(context, data.channelId);
    const { fetchRetailer } = await import("./bol.server");
    const token = await loadToken(data.channelId);
    const info = await fetchRetailer(token);
    const { error } = await context.supabase.rpc("set_channel_retailer", { _channel_id: data.channelId, _info: info as never });
    if (error) throw new Error(error.message);
    return { name: info.displayName ?? null, retailerId: info.retailerId ? String(info.retailerId) : null };
  });

async function pooled<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/** Fill in real names, photos and prices for a batch of imported offers. */
export const enrichBolCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid(), limit: z.number().int().min(1).max(60).default(30), force: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminForChannel(context, data.channelId);
    const { fetchOfferDetail, fetchPrimaryImage, fetchBolProductId } = await import("./bol.server");

    let q = context.supabase.from("channel_listings").select("external_offer_id, external_ean, product_id", { count: "exact" })
      .eq("channel_id", data.channelId).eq("active", true).not("external_offer_id", "is", null);
    if (!data.force) q = q.is("enriched_at", null);
    const { data: rows, count, error } = await q.order("created_at", { ascending: true }).limit(data.limit);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { done: true as const, processed: 0, remaining: 0 };

    const token = await loadToken(data.channelId);
    const seenImage = new Map<string, string | null>();
    const seenProductId = new Map<string, string | null>();

    const payload = await pooled(rows, 5, async (r) => {
      try {
        const d = await fetchOfferDetail(token, r.external_offer_id!);
        const ean = d.ean ?? r.external_ean;
        let imageUrl: string | null = null;
        let bolProductId: string | null = null;
        if (ean) {
          if (!seenImage.has(ean)) seenImage.set(ean, await fetchPrimaryImage(token, ean));
          imageUrl = seenImage.get(ean) ?? null;
          if (!seenProductId.has(ean)) seenProductId.set(ean, await fetchBolProductId(token, ean).catch(() => null));
          bolProductId = seenProductId.get(ean) ?? null;
        }
        return {
          offerId: d.offerId, title: d.title, unitPrice: d.unitPrice, condition: d.condition,
          stock: d.stock, correctedStock: d.correctedStock, forSale: d.forSale, countries: d.countries,
          imageUrl, bolProductId, force: data.force,
        };
      } catch {
        return { offerId: r.external_offer_id!, title: null, imageUrl: null };
      }
    });

    const { error: applyErr } = await context.supabase.rpc("apply_bol_enrichment", { _channel_id: data.channelId, _rows: payload as never });
    if (applyErr) throw new Error(applyErr.message);
    const remaining = Math.max(0, (count ?? rows.length) - rows.length);
    return { done: remaining === 0, processed: rows.length, remaining };
  });

export const syncBolAttributes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid(), limit: z.number().int().min(1).max(60).default(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminForChannel(context, data.channelId);
    const { data: rows, count, error } = await context.supabase.from("channel_listings").select("external_ean", { count: "exact" })
      .eq("channel_id", data.channelId).eq("active", true).not("external_ean", "is", null).is("attrs_synced_at", null)
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { done: true as const, remaining: 0 };
    const { fetchCatalogAttributes } = await import("./bol.server");
    const token = await loadToken(data.channelId);
    const eans = [...new Set(rows.map((r) => r.external_ean!))];
    const payload = await pooled(eans, 4, async (ean) => ({ ean, ...((await fetchCatalogAttributes(token, ean)) ?? {}) }));
    const { error: e2 } = await context.supabase.rpc("apply_bol_attributes" as never, { _channel_id: data.channelId, _rows: payload } as never);
    if (e2) throw new Error(e2.message);
    const remaining = Math.max(0, (count ?? rows.length) - rows.length);
    return { done: remaining === 0, remaining };
  });

const DEMO: Record<string, { offerId: string; ean: string; title: string; reference: string; stock: number; fm: "FBR" | "FBB" }[]> = {
  "CH-1": [
    { offerId: "DEMO1-GAS1", ean: "8712345000011", title: "Gas Bottle", reference: "GAS-1", stock: 0, fm: "FBR" },
    { offerId: "DEMO1-GAS4", ean: "8712345000042", title: "4 Gas Bottles", reference: "GAS-4", stock: 0, fm: "FBR" },
    { offerId: "DEMO1-GAS10", ean: "8712345000103", title: "10 Gas Bottles", reference: "GAS-10", stock: 0, fm: "FBR" },
    { offerId: "DEMO1-G4B1", ean: "8712345000417", title: "4 Gas + Burner", reference: "GAS4-BURNER1", stock: 0, fm: "FBR" },
    { offerId: "DEMO1-G6S1", ean: "8712345000615", title: "6 Gas + Stove", reference: "GAS6-STOVE1", stock: 0, fm: "FBR" },
    { offerId: "DEMO1-BURN", ean: "8712345000509", title: "Burner", reference: "BURNER-1", stock: 0, fm: "FBR" },
    { offerId: "DEMO1-STOV", ean: "8712345000608", title: "Stove", reference: "STOVE-1", stock: 0, fm: "FBR" },
  ],
  "CH-2": [
    { offerId: "DEMO2-GAS10", ean: "8712345000103", title: "10 Gas Bottles", reference: "Q2-GAS10", stock: 0, fm: "FBR" },
    { offerId: "DEMO2-GAS10-LVB", ean: "8712345000103", title: "10 Gas Bottles (LVB)", reference: "Q2-GAS10-LVB", stock: 40, fm: "FBB" },
    { offerId: "DEMO2-G4B1", ean: "8712345000417", title: "4 Gas + Burner", reference: "Q2-G4B1", stock: 0, fm: "FBR" },
    { offerId: "DEMO2-NEW", ean: "8712345000998", title: "Gas Hose 1.5m", reference: "Q2-HOSE", stock: 0, fm: "FBR" },
  ],
};

export const importDemoOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminForChannel(context, data.channelId);
    const { data: ch } = await context.supabase.from("sales_channels").select("code, status").eq("id", data.channelId).single();
    if (ch?.status === "connected") throw new Error("This account is connected to real bol.com data; demo data is not allowed here");
    const list = DEMO[ch?.code ?? ""] ?? DEMO["CH-1"]!;
    const offers = list.map((o) => ({ offerId: o.offerId, ean: o.ean, title: o.title, reference: o.reference, stock: o.stock, fulfilmentMethod: o.fm, forSale: true, demo: true, countries: ["NL", "BE"] }));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sales_channels").update({ is_demo: true }).eq("id", data.channelId);
    const { data: res, error } = await context.supabase.rpc("upsert_bol_offers", { _channel_id: data.channelId, _offers: offers, _full: true });
    if (error) throw new Error(error.message);
    return res as ImportSummary;
  });

/** Owner edits one offer; change goes straight to bol.com, then is mirrored locally. */
export const updateBolOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    listingId: z.string().uuid(),
    reference: z.string().trim().max(100).optional(),
    forSale: z.boolean().optional(),
    price: z.number().min(1).max(9999).optional(),
    stock: z.number().int().min(0).max(999).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { updateOffer, assertBolWritesEnabled } = await import("./bol.server");
    assertBolWritesEnabled();
    const { data: l, error } = await context.supabase.from("channel_listings")
      .select("id, channel_id, external_offer_id, fulfillment_method").eq("id", data.listingId).maybeSingle();
    if (error || !l?.external_offer_id) throw new Error("العرض غير موجود");
    await requireAdminForChannel(context, l.channel_id);
    if (data.stock !== undefined && l.fulfillment_method === "FBB") throw new Error("مخزون FBB تديره bol.com ولا يمكن تعديله");
    const token = await loadToken(l.channel_id);
    try {
      await updateOffer(token, l.external_offer_id, data);
    } catch (e) {
      throw new Error(`رفض bol.com التعديل: ${msg(e)}`);
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.reference !== undefined) patch["reference"] = data.reference;
    if (data.forSale !== undefined) patch["for_sale"] = data.forSale;
    if (data.price !== undefined) patch["unit_price"] = data.price;
    if (data.stock !== undefined) { patch["bol_stock"] = data.stock; patch["last_pushed_qty"] = data.stock; patch["last_pushed_at"] = new Date().toISOString(); }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("channel_listings").update(patch as never).eq("id", l.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });
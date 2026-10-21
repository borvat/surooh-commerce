// Server-only: bol.com Retailer API + credential encryption. Never import from client code.
import { parseCsv } from "@/lib/csv";

const API = "https://api.bol.com";
const V10_JSON = "application/vnd.retailer.v10+json";
const V10_CSV = "application/vnd.retailer.v10+csv";

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key() {
  const secret = process.env["BOL_CREDENTIALS_KEY"];
  if (!secret) throw new Error("Secure credential storage is not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    new TextEncoder().encode(plain),
  );
  return { ciphertext: b64(new Uint8Array(ct)), iv: b64(iv) };
}

export async function decryptSecret(ciphertext: string, iv: string) {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await key(),
    unb64(ciphertext),
  );
  return new TextDecoder().decode(pt);
}

export async function bolToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://login.bol.com/token?grant_type=client_credentials", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: "application/json",
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`bol.com login failed [${res.status}]: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as { access_token?: string };
  if (!json.access_token) throw new Error("bol.com login returned no token");
  return json.access_token;
}

async function call(token: string, path: string, init: RequestInit & { accept?: string } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: init.accept ?? V10_JSON,
      ...(init.body ? { "Content-Type": V10_JSON } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`bol.com ${path} failed [${res.status}]: ${text.slice(0, 300)}`);
  return text;
}

type ProcessStatus = {
  processStatusId?: string | number;
  status?: string;
  entityId?: string;
  errorMessage?: string;
};

export async function startOfferExport(token: string) {
  const ps = JSON.parse(
    await call(token, "/retailer/offers/export", {
      method: "POST",
      body: JSON.stringify({ format: "CSV" }),
    }),
  ) as ProcessStatus;
  if (!ps.processStatusId) throw new Error("bol.com did not start the export");
  return String(ps.processStatusId);
}

export async function checkProcess(token: string, id: string) {
  return JSON.parse(
    await call(token, `/shared/process-status/${encodeURIComponent(id)}`),
  ) as ProcessStatus;
}

export type BolOffer = {
  offerId: string;
  ean: string | null;
  reference: string | null;
  title: string | null;
  stock: number | null;
  correctedStock: number | null;
  fulfilmentMethod: "FBR" | "FBB";
  forSale: boolean | null;
  modifiedAt: string | null;
  countries: string[] | null;
};

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    const hit = Object.keys(r).find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit && r[hit] !== undefined && r[hit] !== "") return r[hit]!;
  }
  return null;
};
const int = (v: string | null) =>
  v == null || v === "" || isNaN(Number(v)) ? null : Math.trunc(Number(v));

export async function downloadOfferExport(token: string, reportId: string): Promise<BolOffer[]> {
  const csv = await call(token, `/retailer/offers/export/${encodeURIComponent(reportId)}`, {
    accept: V10_CSV,
  });
  return parseCsv(csv)
    .map((r) => {
      const onHold = pick(r, "onHoldByRetailer");
      const fm = (
        pick(r, "fulfilmentType", "fulfilmentMethod", "fulfillmentMethod") ?? "FBR"
      ).toUpperCase();
      return {
        offerId: pick(r, "offerId") ?? "",
        ean: pick(r, "ean"),
        reference: pick(r, "referenceCode", "reference"),
        title: pick(r, "unknownProductTitle", "title"),
        stock: int(pick(r, "stockAmount", "stock")),
        correctedStock: int(pick(r, "correctedStock")),
        fulfilmentMethod: fm === "FBB" || fm === "LVB" ? ("FBB" as const) : ("FBR" as const),
        forSale: onHold == null ? null : onHold.toLowerCase() !== "true",
        modifiedAt: pick(r, "mutationDateTime"),
        countries: null,
      };
    })
    .filter((o) => o.offerId);
}

export type BolRetailer = {
  retailerId?: string | number;
  displayName?: string;
  registrationDate?: string;
  retailerRating?: { rating?: number | string } & Record<string, unknown>;
};

/** Shop identity of the connected account (name, retailer id, rating). */
export async function fetchRetailer(token: string): Promise<BolRetailer> {
  return JSON.parse(await call(token, "/retailer/retailers/current")) as BolRetailer;
}

export type OfferDetail = {
  offerId: string;
  ean: string | null;
  reference: string | null;
  title: string | null;
  unitPrice: number | null;
  stock: number | null;
  correctedStock: number | null;
  fulfilmentMethod: "FBR" | "FBB";
  forSale: boolean | null;
  condition: string | null;
  countries: string[] | null;
};

type RawOffer = {
  offerId?: string;
  ean?: string;
  reference?: string;
  onHoldByRetailer?: boolean;
  pricing?: { bundlePrices?: { quantity?: number; unitPrice?: number }[] };
  stock?: { amount?: number; correctedStock?: number };
  fulfilment?: { method?: string };
  store?: { productTitle?: string; visible?: { countryCode?: string }[] };
  condition?: { name?: string };
};

/** Full offer record: real product title, selling price, stock, countries. */
export async function fetchOfferDetail(token: string, offerId: string): Promise<OfferDetail> {
  const o = JSON.parse(
    await call(token, `/retailer/offers/${encodeURIComponent(offerId)}`),
  ) as RawOffer;
  const single =
    o.pricing?.bundlePrices?.find((b) => (b.quantity ?? 1) === 1) ?? o.pricing?.bundlePrices?.[0];
  const fm = (o.fulfilment?.method ?? "FBR").toUpperCase();
  const countries = (o.store?.visible ?? [])
    .map((v) => v.countryCode)
    .filter((c): c is string => !!c);
  return {
    offerId: o.offerId ?? offerId,
    ean: o.ean ?? null,
    reference: o.reference ?? null,
    title: o.store?.productTitle ?? null,
    unitPrice: typeof single?.unitPrice === "number" ? single.unitPrice : null,
    stock: o.stock?.amount ?? null,
    correctedStock: o.stock?.correctedStock ?? null,
    fulfilmentMethod: fm === "FBB" || fm === "LVB" ? "FBB" : "FBR",
    forSale: o.onHoldByRetailer == null ? null : !o.onHoldByRetailer,
    condition: o.condition?.name ?? null,
    countries: countries.length ? countries : null,
  };
}

/** Official bol.com product photo for an EAN, or null when bol has none. */
export async function fetchPrimaryImage(token: string, ean: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const json = JSON.parse(
        await call(token, `/retailer/products/${encodeURIComponent(ean)}/assets?usage=PRIMARY`),
      ) as {
        assets?: { variants?: { size?: string; url?: string }[] }[];
      };
      const variants = json.assets?.flatMap((a) => a.variants ?? []) ?? [];
      const order = ["medium", "large", "small"];
      const best =
        order.map((s) => variants.find((v) => v.size === s)).find(Boolean) ?? variants[0];
      return best?.url ?? null;
    } catch (e) {
      // bol throttles bursts; back off and retry, otherwise give up quietly
      if (!/\[429\]|\[50\d\]/.test(String(e))) return null;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

/** bol's webshop product ID (BPID), distinct from both EAN and offer ID. */
export async function fetchBolProductId(token: string, ean: string): Promise<string | null> {
  const result = JSON.parse(
    await call(token, `/retailer/products/${encodeURIComponent(ean)}/product-ids`),
  ) as { bolProductId?: string };
  return result.bolProductId && /^\d+$/.test(result.bolProductId) ? result.bolProductId : null;
}

export type OfferChange = {
  reference?: string | undefined;
  forSale?: boolean | undefined;
  price?: number | undefined;
  stock?: number | undefined;
};

/** Global kill switch: bol.com is READ-ONLY until the owner explicitly enables writes in a later release. */
export const BOL_WRITE_ENABLED = false as boolean;
export function assertBolWritesEnabled() {
  if (!BOL_WRITE_ENABLED) throw new Error("وضع القراءة فقط — لا يُرسل أي تعديل إلى bol.com حالياً");
}

/** Send owner edits to bol.com. Blocked while BOL_WRITE_ENABLED is false. */
export async function updateOffer(token: string, offerId: string, ch: OfferChange) {
  assertBolWritesEnabled();
  const id = encodeURIComponent(offerId);
  const sent: string[] = [];
  if (ch.reference !== undefined || ch.forSale !== undefined) {
    const raw = JSON.parse(await call(token, `/retailer/offers/${id}`)) as {
      reference?: string;
      onHoldByRetailer?: boolean;
      unknownProductTitle?: string;
      fulfilment?: Record<string, unknown>;
    };
    const body: Record<string, unknown> = {
      reference: ch.reference ?? raw.reference ?? "",
      onHoldByRetailer: ch.forSale !== undefined ? !ch.forSale : !!raw.onHoldByRetailer,
      fulfilment: raw.fulfilment ?? { method: "FBR" },
    };
    if (raw.unknownProductTitle) body["unknownProductTitle"] = raw.unknownProductTitle;
    await call(token, `/retailer/offers/${id}`, { method: "PUT", body: JSON.stringify(body) });
    sent.push("offer");
  }
  if (ch.price !== undefined) {
    await call(token, `/retailer/offers/${id}/price`, {
      method: "PUT",
      body: JSON.stringify({ pricing: { bundlePrices: [{ quantity: 1, unitPrice: ch.price }] } }),
    });
    sent.push("price");
  }
  if (ch.stock !== undefined) {
    await call(token, `/retailer/offers/${id}/stock`, {
      method: "PUT",
      body: JSON.stringify({ amount: ch.stock, managedByRetailer: true }),
    });
    sent.push("stock");
  }
  return sent;
}

/** Colour / pieces per package / box contents from bol's catalog, or null when bol has no catalog entry. */
export async function fetchCatalogAttributes(
  token: string,
  ean: string,
): Promise<{ colour: string | null; pack: number | null; contents: string | null } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `${API}/retailer/content/catalog-products/${encodeURIComponent(ean)}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: V10_JSON, "Accept-Language": "nl" },
        },
      );
      if (res.status === 429 || res.status >= 500) throw new Error(`[${res.status}]`);
      if (!res.ok) return null;
      const j = (await res.json()) as {
        attributes?: { id?: string; values?: { value?: string }[] }[];
      };
      const get = (...ids: string[]) => {
        for (const id of ids) {
          const v = j.attributes
            ?.find((a) => a.id === id)
            ?.values?.map((x) => x.value)
            .filter(Boolean)
            .join(", ");
          if (v && v !== "-") return v;
        }
        return null;
      };
      const packRaw = get("Number Pieces In Package", "Pack Quantity", "Number of Items");
      const pack = packRaw && /^\d+/.test(packRaw) ? parseInt(packRaw, 10) : null;
      return {
        colour: get("Colour", "Colour Group"),
        pack: pack && pack > 0 ? pack : null,
        contents: get("Whats In The Box"),
      };
    } catch (e) {
      if (!/\[429\]|\[50\d\]/.test(String(e))) return null;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

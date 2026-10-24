/** Same-origin session bridge. Native credentials/cookies never reach browser JavaScript. */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "__Host-surooh_wms_native";
const TTL = 15 * 60;
const PREFIX = "/api/wms-auth/";
type BridgeConfig = {
  origin: string;
  accountingOrigin: string;
  company: "TEST-A" | "TEST-B";
  key: Buffer;
  /** Explicit local integration fixtures only; never read from an HTTP request. */
  loopbackSite?: "wms-native-a.invalid" | "wms-native-b.invalid";
  fixtureTimeoutMs?: number;
  now?: () => number;
};
type Session = { sid: string; nativeCsrf: string; csrf: string; user: string; expires: number };
class Rejection extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function textBody(response: Response | Request, max: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new Rejection(413, "حجم الطلب أو الرد غير مسموح.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts).toString("utf8");
}
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createAccountingSessionBridge(config: BridgeConfig) {
  const origin = new URL(config.origin),
    native = new URL(config.accountingOrigin);
  if (config.key.length !== 32 || !["TEST-A", "TEST-B"].includes(config.company))
    throw new Error("Explicit company and 256-bit server key required");
  for (const url of [origin, native]) {
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      throw new Error("Only fixed origin URLs are accepted");
    if (
      url.protocol !== "https:" &&
      !(config.loopbackSite && url.protocol === "http:" && url.hostname === "127.0.0.1")
    )
      throw new Error("HTTPS required outside explicit loopback fixtures");
  }
  if (config.loopbackSite) {
    if (origin.hostname !== "127.0.0.1" || native.hostname !== "127.0.0.1")
      throw new Error("Local fixtures require loopback on both sides");
    if (
      config.fixtureTimeoutMs !== undefined &&
      (!Number.isInteger(config.fixtureTimeoutMs) ||
        config.fixtureTimeoutMs < 1 ||
        config.fixtureTimeoutMs > 15_000)
    )
      throw new Error("Invalid fixture timeout");
  } else if (
    origin.origin !== "https://surooh-wms-isolated-test.onrender.com" ||
    native.origin !== "https://surooh-accounting-test-b.onrender.com"
  ) {
    throw new Error("Only the verified existing WMS and Accounting TEST-B services are admitted");
  }
  if (!config.loopbackSite && config.fixtureTimeoutMs !== undefined)
    throw new Error("Timeout overrides are restricted to local fixtures");
  const aad = Buffer.from(
    JSON.stringify(["accounting-session-v1", origin.origin, native.origin, config.company]),
  );
  const now = config.now ?? (() => Date.now());
  const cookie = (value: string, age: number) =>
    `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  const reply = (status: number, data: unknown, value?: string) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(value ? { "Set-Cookie": value } : {}),
      },
    });
  const clear = () => cookie("", 0);
  function seal(value: Session) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", config.key, iv);
    cipher.setAAD(aad);
    const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
  }
  function session(request: Request): Session {
    const entries = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((x) => x.trim())
      .filter((x) => x.startsWith(COOKIE + "="));
    if (entries.length !== 1) throw new Rejection(401, "سجّل الدخول إلى جلسة المحاسبة التجريبية.");
    try {
      const encoded = entries[0]!.slice(COOKIE.length + 1);
      if (!/^[A-Za-z0-9_-]{40,4096}$/.test(encoded)) throw new Error();
      const bytes = Buffer.from(encoded, "base64url");
      const decipher = createDecipheriv("aes-256-gcm", config.key, bytes.subarray(0, 12));
      decipher.setAAD(aad);
      decipher.setAuthTag(bytes.subarray(12, 28));
      const value = JSON.parse(
        Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString(),
      ) as Session;
      if (
        typeof value.user !== "string" ||
        !value.user.endsWith("@example.invalid") ||
        typeof value.sid !== "string" ||
        !/^[A-Za-z0-9_-]{16,200}$/.test(value.sid) ||
        typeof value.nativeCsrf !== "string" ||
        !/^[A-Za-z0-9_-]{16,200}$/.test(value.nativeCsrf) ||
        typeof value.csrf !== "string" ||
        !/^[A-Za-z0-9_-]{32,100}$/.test(value.csrf) ||
        !Number.isSafeInteger(value.expires) ||
        value.expires <= now() ||
        value.expires > now() + TTL * 1000
      )
        throw new Error();
      return value;
    } catch {
      throw new Rejection(401, "انتهت الجلسة أو تغيّرت إعداداتها. سجّل الدخول مجدداً.");
    }
  }
  async function upstream(path: string, value?: Session, body?: URLSearchParams) {
    try {
      return await fetch(native.origin + path, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(config.fixtureTimeoutMs ?? 15_000),
        headers: {
          ...(config.loopbackSite ? { "X-Frappe-Site-Name": config.loopbackSite } : {}),
          ...(value ? { Cookie: `sid=${value.sid}`, "X-Frappe-CSRF-Token": value.nativeCsrf } : {}),
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(body ? { body: body.toString() } : {}),
      });
    } catch {
      throw new Rejection(502, "تعذّر الاتصال بالمحاسبة. لم تُرسل أي عملية مخزون.");
    }
  }
  async function identity(value: Session) {
    const response = await upstream("/api/method/surooh_invoice_workbench.api.context", value);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Rejection(401, "جلسة المحاسبة غير صالحة أو الصلاحية مرفوضة.");
    }
    let data: Record<string, unknown>;
    try {
      data = (
        JSON.parse(await textBody(response, 1_000_000)) as { message: Record<string, unknown> }
      ).message;
    } catch {
      throw new Rejection(502, "رد هوية المحاسبة غير صالح.");
    }
    if (
      !data ||
      data["synthetic_only"] !== true ||
      data["company"] !== config.company ||
      data["user"] !== value.user ||
      typeof data["can_review"] !== "boolean"
    )
      throw new Rejection(403, "هوية المحاسبة لا تطابق شركة الاختبار المعتمدة.");
    return {
      company: config.company,
      user: value.user,
      can_review: data["can_review"],
      synthetic_only: true,
      csrf_token: value.csrf,
      capabilities: { warehouse_commands: false, shipment_invoice_cycle: false },
    };
  }
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(PREFIX)) return null;
    try {
      if (
        url.origin !== origin.origin ||
        url.search ||
        (request.headers.get("origin") && request.headers.get("origin") !== origin.origin) ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        throw new Rejection(403, "مصدر الطلب غير مسموح.");
      const action = url.pathname.slice(PREFIX.length);
      if (action === "login" && request.method === "POST") {
        if (
          request.headers.get("origin") !== origin.origin ||
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          throw new Rejection(403, "طلب الدخول يحتاج المصدر الصحيح.");
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(await textBody(request, 4096)) as Record<string, unknown>;
        } catch (error) {
          if (error instanceof Rejection) throw error;
          throw new Rejection(400, "طلب الدخول غير صالح.");
        }
        if (
          !input ||
          Object.keys(input).sort().join(",") !== "password,user" ||
          typeof input["user"] !== "string" ||
          !/^[A-Za-z0-9._+-]+@example\.invalid$/.test(input["user"]) ||
          typeof input["password"] !== "string" ||
          !input["password"] ||
          input["password"].length > 512
        )
          throw new Rejection(400, "استخدم هوية الاختبار المخصصة فقط.");
        const response = await upstream(
          "/api/method/login",
          undefined,
          new URLSearchParams({ usr: input["user"], pwd: input["password"] }),
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw new Rejection(401, "تعذّر الدخول. تحقّق من هوية الاختبار وصلاحياتها.");
        }
        const sid = response.headers
          .getSetCookie()
          .map((x) => /^sid=([A-Za-z0-9_-]{16,200})(?:;|$)/.exec(x)?.[1])
          .find(Boolean);
        await response.body?.cancel();
        if (!sid) throw new Rejection(502, "لم تصدر المحاسبة جلسة صالحة.");
        const provisional: Session = {
          sid,
          user: input["user"],
          nativeCsrf: "",
          csrf: randomBytes(32).toString("base64url"),
          expires: now() + TTL * 1000,
        };
        const page = await upstream("/invoice-workbench", provisional);
        if (!page.ok) {
          await page.body?.cancel();
          throw new Rejection(403, "واجهة المحاسبة غير مسموحة لهذه الهوية.");
        }
        const token = /frappe\.csrf_token\s*=\s*"([A-Za-z0-9_-]{16,200})"/.exec(
          await textBody(page, 1_000_000),
        )?.[1];
        if (!token) throw new Rejection(502, "لم تهيّئ المحاسبة حماية الجلسة.");
        provisional.nativeCsrf = token;
        const verified = await identity(provisional);
        return reply(200, verified, cookie(seal(provisional), TTL));
      }
      if (action === "session" && request.method === "GET")
        return reply(200, await identity(session(request)));
      if (action === "logout" && request.method === "POST") {
        const value = session(request);
        if (
          request.headers.get("origin") !== origin.origin ||
          !equal(request.headers.get("X-WMS-CSRF") ?? "", value.csrf)
        )
          throw new Rejection(403, "تعذّر التحقق من حماية الطلب.");
        try {
          const response = await upstream("/api/method/logout", value, new URLSearchParams());
          await response.body?.cancel();
          if (response.ok) return reply(200, { signed_out: true }, clear());
        } catch {
          // Closing the local cookie is unconditional; remote revocation must not be invented.
        }
        return reply(502, { signed_out_local: true, native_signout_confirmed: false }, clear());
      }
      // Authentication is not warehouse authority. No arbitrary native RPC proxy/fallback.
      if (action === "command") {
        const value = session(request);
        await identity(value);
        throw new Rejection(409, "عقد أوامر المستودع مع المحاسبة لم يُعتمد بعد. لم تُنفذ عملية.");
      }
      throw new Rejection(405, "المسار أو طريقة الطلب غير مدعومة.");
    } catch (error) {
      const e =
        error instanceof Rejection ? error : new Rejection(502, "تعذّر التحقق من جلسة المحاسبة.");
      return reply(e.status, { error: e.message }, e.status === 401 ? clear() : undefined);
    }
  };
}

export function accountingBridgeFromEnvironment(env: Record<string, string | undefined>) {
  if (env["SUROOH_WMS_AUTH_PROFILE"] !== "accounting-session-v1") return null;
  const key = env["SUROOH_WMS_COOKIE_KEY"] ?? "";
  const company = env["SUROOH_WMS_ACCOUNTING_COMPANY"];
  if (!/^[A-Za-z0-9_-]{43}$/.test(key) || !["TEST-A", "TEST-B"].includes(company ?? ""))
    throw new Error("Missing native session configuration");
  return createAccountingSessionBridge({
    origin: env["SUROOH_WMS_ORIGIN"] ?? "",
    accountingOrigin: env["SUROOH_WMS_ACCOUNTING_ORIGIN"] ?? "",
    company: company as "TEST-A" | "TEST-B",
    key: Buffer.from(key, "base64url"),
  });
}

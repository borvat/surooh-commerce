import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import {
  accountingBridgeFromEnvironment,
  createAccountingSessionBridge,
} from "../src/lib/accounting-session.server";

const origin = "http://127.0.0.1:18081";
const nativeSid = "synthetic_native_sid_0123456789abcdef";
const nativeCsrf = "synthetic_native_csrf_0123456789abcdef";
const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    await new Promise<void>((r) => s.close(() => r()));
  }
});
async function fixture() {
  const state = {
    allowed: true,
    company: "TEST-A",
    corrupt: false,
    logoutFailure: false,
    logoutNetworkFailure: false,
    calls: [] as string[],
  };
  const server = createServer(async (req, res) => {
    state.calls.push(req.url!);
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.url === "/api/method/login") {
      if (body !== "usr=writer%40example.invalid&pwd=synthetic-password") {
        res.writeHead(401);
        res.end("denied");
        return;
      }
      res.setHeader("Set-Cookie", [
        `sid=${nativeSid}; Path=/; HttpOnly`,
        "user_id=writer%40example.invalid; Path=/",
      ]);
      res.end('{"message":"Logged In"}');
      return;
    }
    if (req.headers.cookie !== `sid=${nativeSid}` || !state.allowed) {
      res.writeHead(403);
      res.end("SENSITIVE_NATIVE_TRACE");
      return;
    }
    if (req.url === "/invoice-workbench") {
      res.end(`<script>frappe.csrf_token = "${nativeCsrf}";</script>`);
      return;
    }
    if (req.headers["x-frappe-csrf-token"] !== nativeCsrf) {
      res.writeHead(403);
      res.end("bad csrf");
      return;
    }
    if (req.url === "/api/method/logout") {
      if (state.logoutNetworkFailure) {
        req.destroy();
        return;
      }
      if (state.logoutFailure) res.writeHead(500);
      else state.allowed = false;
      res.end("{}");
      return;
    }
    if (state.corrupt) {
      res.end("NATIVE_TRACE_NOT_JSON");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        message: {
          user: "writer@example.invalid",
          company: state.company,
          synthetic_only: true,
          can_review: false,
          customers: [{ name: "PRIVATE_NATIVE_CUSTOMER" }],
        },
      }),
    );
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("No address");
  const config = {
    origin,
    accountingOrigin: `http://127.0.0.1:${addr.port}`,
    company: "TEST-A" as const,
    key: randomBytes(32),
    loopbackSite: "wms-native-a.invalid" as const,
  };
  return { state, config, bridge: createAccountingSessionBridge(config) };
}
function req(
  action: string,
  method = "GET",
  cookie?: string,
  payload?: unknown,
  csrf?: string,
  requestOrigin = origin,
) {
  return new Request(origin + "/api/wms-auth/" + action, {
    method,
    headers: {
      Origin: requestOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-WMS-CSRF": csrf } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}
async function login(bridge: ReturnType<typeof createAccountingSessionBridge>) {
  const response = (await bridge(
    req("login", "POST", undefined, {
      user: "writer@example.invalid",
      password: "synthetic-password",
    }),
  ))!;
  return {
    response,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    data: (await response.clone().json()) as Record<string, unknown>,
  };
}
describe("WMS accounting session bridge over real HTTP / fabricated Frappe responses", () => {
  test("profile is off by default and missing key fails closed", () => {
    expect(accountingBridgeFromEnvironment({})).toBeNull();
    expect(() =>
      accountingBridgeFromEnvironment({ SUROOH_WMS_AUTH_PROFILE: "accounting-session-v1" }),
    ).toThrow();
  });
  test("fixed provider admission rejects external/credential-bearing targets", async () => {
    const f = await fixture();
    expect(() =>
      createAccountingSessionBridge({ ...f.config, accountingOrigin: "https://elsewhere.invalid" }),
    ).toThrow();
    expect(() =>
      createAccountingSessionBridge({ ...f.config, accountingOrigin: "http://user:pwd@127.0.0.1" }),
    ).toThrow();
    expect(() =>
      createAccountingSessionBridge({
        ...f.config,
        loopbackSite: undefined,
        accountingOrigin: "https://elsewhere.invalid",
      } as never),
    ).toThrow();
  });
  test("guest denied; successful login seals native SID/CSRF and exposes only scoped identity", async () => {
    const f = await fixture();
    expect((await f.bridge(req("session")))!.status).toBe(401);
    const r = await login(f.bridge);
    expect(r.response.status).toBe(200);
    const set = r.response.headers.get("set-cookie")!;
    for (const word of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=900"])
      expect(set).toContain(word);
    for (const value of [nativeSid, nativeCsrf, "synthetic-password", "PRIVATE_NATIVE_CUSTOMER"]) {
      expect(set).not.toContain(value);
      expect(JSON.stringify(r.data)).not.toContain(value);
    }
    expect(r.data["company"]).toBe("TEST-A");
    expect(r.data["capabilities"]).toEqual({
      warehouse_commands: false,
      shipment_invoice_cycle: false,
    });
    expect((await f.bridge(req("session", "GET", r.cookie)))!.status).toBe(200);
  });
  test("foreign Origin and extra endpoint/actor selectors are rejected before native login", async () => {
    const f = await fixture();
    expect(
      (await f.bridge(
        req(
          "login",
          "POST",
          undefined,
          { user: "writer@example.invalid", password: "synthetic-password" },
          undefined,
          "https://foreign.invalid",
        ),
      ))!.status,
    ).toBe(403);
    expect(
      (await f.bridge(
        req("login", "POST", undefined, {
          user: "writer@example.invalid",
          password: "synthetic-password",
          company: "TEST-B",
        }),
      ))!.status,
    ).toBe(400);
    expect(f.state.calls).toHaveLength(0);
  });
  test("rejects wrong company without issuing a WMS cookie", async () => {
    const f = await fixture();
    f.state.company = "TEST-B";
    const r = await login(f.bridge);
    expect(r.response.status).toBe(403);
    expect(r.response.headers.get("set-cookie")).toBeNull();
  });
  test("native revocation checked on each read and never leaks native errors", async () => {
    const f = await fixture();
    const r = await login(f.bridge);
    f.state.allowed = false;
    const denied = (await f.bridge(req("session", "GET", r.cookie)))!;
    expect(denied.status).toBe(401);
    expect(await denied.text()).not.toContain("SENSITIVE_NATIVE_TRACE");
    expect(denied.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  test("cookie survives a WMS handler restart with the same key; changed key/company and expiry deny", async () => {
    const f = await fixture();
    const r = await login(f.bridge);
    expect(
      (await createAccountingSessionBridge(f.config)(req("session", "GET", r.cookie)))!.status,
    ).toBe(200);
    expect(
      (await createAccountingSessionBridge({ ...f.config, key: randomBytes(32) })(
        req("session", "GET", r.cookie),
      ))!.status,
    ).toBe(401);
    expect(
      (await createAccountingSessionBridge({ ...f.config, company: "TEST-B" })(
        req("session", "GET", r.cookie),
      ))!.status,
    ).toBe(401);
    expect(
      (await createAccountingSessionBridge({ ...f.config, now: () => Date.now() + 901000 })(
        req("session", "GET", r.cookie),
      ))!.status,
    ).toBe(401);
  });
  test("duplicate and tampered cookies are not accepted", async () => {
    const f = await fixture();
    const r = await login(f.bridge);
    expect((await f.bridge(req("session", "GET", r.cookie + "; " + r.cookie)))!.status).toBe(401);
    const prefix = r.cookie.slice(0, r.cookie.indexOf("=") + 1);
    const body = r.cookie.slice(prefix.length);
    const changed = prefix + (body[0] === "a" ? "b" : "a") + body.slice(1);
    expect((await f.bridge(req("session", "GET", changed)))!.status).toBe(401);
  });
  test("logout requires WMS CSRF and invalidates native session", async () => {
    const f = await fixture();
    const r = await login(f.bridge);
    expect((await f.bridge(req("logout", "POST", r.cookie, undefined, "wrong")))!.status).toBe(403);
    expect(f.state.allowed).toBe(true);
    const out = (await f.bridge(
      req("logout", "POST", r.cookie, undefined, String(r.data["csrf_token"])),
    ))!;
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(f.state.allowed).toBe(false);
  });
  test("native logout failure is not labelled confirmed", async () => {
    const f = await fixture();
    const r = await login(f.bridge);
    f.state.logoutFailure = true;
    const out = (await f.bridge(
      req("logout", "POST", r.cookie, undefined, String(r.data["csrf_token"])),
    ))!;
    expect(out.status).toBe(502);
    expect(await out.json()).toEqual({ signed_out_local: true, native_signout_confirmed: false });
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  test("network loss during logout still closes the local cookie without claiming native revocation", async () => {
    const f = await fixture();
    const r = await login(f.bridge);
    f.state.logoutNetworkFailure = true;
    const out = (await f.bridge(
      req("logout", "POST", r.cookie, undefined, String(r.data["csrf_token"])),
    ))!;
    expect(out.status).toBe(502);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await out.json()).toEqual({ signed_out_local: true, native_signout_confirmed: false });
  });
  test("warehouse calls stay denied after successful identity; no native stock RPC dispatched", async () => {
    const f = await fixture();
    const r = await login(f.bridge);
    const before = f.state.calls.length;
    expect((await f.bridge(req("command", "POST", r.cookie, { operation: "ship" })))!.status).toBe(
      409,
    );
    expect(f.state.calls.slice(before)).toEqual([
      "/api/method/surooh_invoice_workbench.api.context",
    ]);
  });
  test("oversized request rejected and malformed native context remains private", async () => {
    const f = await fixture();
    expect(
      (await f.bridge(
        req("login", "POST", undefined, {
          user: "writer@example.invalid",
          password: "x".repeat(5000),
        }),
      ))!.status,
    ).toBe(413);
    expect(f.state.calls).toHaveLength(0);
    f.state.corrupt = true;
    const r = await login(f.bridge);
    expect(r.response.status).toBe(502);
    expect(JSON.stringify(r.data)).not.toContain("NATIVE_TRACE");
  });
});

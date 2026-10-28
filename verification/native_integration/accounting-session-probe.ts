/** Actual native Frappe HTTP sessions. No browser, ledger mutation or hosted acceptance. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createAccountingSessionBridge } from "../../src/lib/accounting-session.server";

const root = resolve(process.env["SUROOH_INVOICE_LAB_ROOT"] ?? "");
const run = process.env["INVOICE_LAB_RUN_ID"] ?? "";
const output = process.env["WMS_SESSION_PROBE_OUTPUT"] ?? "";
if (!existsSync(join(root, ".synthetic-only")) || !/^[a-z0-9]+$/.test(run) || !output)
  throw new Error("Explicit owned synthetic fixture required");
const credentials = JSON.parse(
  readFileSync(join(root, "run", `credentials-${run}.json`), "utf8"),
) as Record<string, string>;
const config = {
  origin: "http://127.0.0.1:18081",
  accountingOrigin: "http://127.0.0.1:18080",
  company: "TEST-A" as const,
  key: randomBytes(32),
  loopbackSite: "wms-native-a.invalid" as const,
};
const bridge = createAccountingSessionBridge(config);
const rows: { id: string; status: "PASS" }[] = [];
function check(id: string, condition: unknown) {
  if (!condition) throw new Error(id);
  rows.push({ id, status: "PASS" });
  console.log(id, "PASS");
}
function request(action: string, method = "GET", cookie?: string, body?: unknown, csrf?: string) {
  return new Request(config.origin + "/api/wms-auth/" + action, {
    method,
    headers: {
      Origin: config.origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-WMS-CSRF": csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login(role: string, handler = bridge) {
  const response = (await handler(
    request("login", "POST", undefined, {
      user: role + "@example.invalid",
      password: credentials[role],
    }),
  ))!;
  return {
    response,
    data: (await response.clone().json()) as Record<string, unknown>,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
let status = "FAIL";
try {
  check("native_guest_denied", (await bridge(request("session")))?.status === 401);
  const writer = await login("writer");
  check(
    "native_writer_authenticated_with_actual_context",
    writer.response.status === 200 &&
      writer.data["user"] === "writer@example.invalid" &&
      writer.data["company"] === "TEST-A" &&
      writer.data["can_review"] === true,
  );
  check(
    "native_session_not_exposed_to_browser_JSON",
    !JSON.stringify(writer.data).includes("sid=") &&
      !JSON.stringify(writer.data).includes(credentials["writer"]!),
  );
  check(
    "native_protected_session_read",
    (await bridge(request("session", "GET", writer.cookie)))?.status === 200,
  );
  const reconstructed = createAccountingSessionBridge(config);
  check(
    "same_key_handler_reconstruction_revalidates_native_session",
    (await reconstructed(request("session", "GET", writer.cookie)))?.status === 200,
  );
  check(
    "warehouse_contract_still_denied",
    (await bridge(request("command", "POST", writer.cookie, { operation: "ship" })))?.status ===
      409,
  );
  check(
    "native_logout_requires_proxy_csrf",
    (await bridge(request("logout", "POST", writer.cookie, undefined, "wrong")))?.status === 403,
  );
  const reviewer = await login("reviewer");
  check(
    "native_reviewer_role_retained",
    reviewer.response.status === 200 && reviewer.data["can_review"] === true,
  );
  const wrong = await login(
    "writer",
    createAccountingSessionBridge({ ...config, company: "TEST-B" }),
  );
  check("native_company_mismatch_denied", wrong.response.status === 403 && !wrong.cookie);
  check(
    "native_session_logout_confirmed",
    (
      await bridge(
        request("logout", "POST", writer.cookie, undefined, String(writer.data["csrf_token"])),
      )
    )?.status === 200,
  );
  check(
    "native_logged_out_cookie_denied",
    (await bridge(request("session", "GET", writer.cookie)))?.status === 401,
  );
  await bridge(
    request("logout", "POST", reviewer.cookie, undefined, String(reviewer.data["csrf_token"])),
  );
  status = "PASS";
} finally {
  writeFileSync(
    output,
    JSON.stringify(
      {
        tier: "actual_native_HTTP_session_bridge_no_browser",
        status,
        cases: rows,
        hosted_acceptance: false,
        warehouse_cycle_acceptance: false,
        handler_reconstruction_is_not_service_restart: true,
      },
      null,
      2,
    ) + "\n",
  );
}

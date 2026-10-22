/** Real browser only. A missing browser is BLOCKED, never a simulated success. */
import fs from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const executable =
  config.executable || "/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const result = {
  id: "B01_rendered_existing_React_full_native_cycle",
  status: "BLOCKED",
  phase_complete: false,
  codex_start_authorized: false,
};
let server, browser;
try {
  if (!fs.existsSync(executable))
    throw new Error(
      "No runnable browser executable; official download attempts failed. Real UI cycle NOT EXECUTED.",
    );
  const require = createRequire(import.meta.url);
  const { chromium } = require(
    config.playwright ||
      "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core",
  );
  server = spawn(config.bun, ["run", "dev"], {
    cwd: config.wmsRoot,
    env: { ...process.env, WMS_NATIVE_UI_TEST: "true", VITE_SUROOH_NATIVE_LAB: "true" },
    stdio: "ignore",
  });
  const origin = "http://127.0.0.1:18081";
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await fetch(origin);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  browser = await chromium.launch({
    executablePath: executable,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  await context.addInitScript(
    (session) => {
      window.__SUROOH_NATIVE_SESSION__ = session;
    },
    { url: origin, token: config.token },
  );
  const page = await context.newPage();
  const api = async (operation, payload = {}) => {
    const response = await fetch(
      "http://127.0.0.1:18080/api/method/surooh_accounting.native_lab.api.command",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Frappe-Site-Name": "wms-native-a.invalid",
          "X-Surooh-Synthetic-JWT": config.token,
        },
        body: JSON.stringify({
          envelope: {
            company: "TEST-A",
            source: "lab-manual",
            request_id: `browser-read:${crypto.randomUUID()}`,
            operation,
            payload,
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`Native verification HTTP ${response.status}`);
    return (await response.json()).message;
  };
  const clickCommand = async (operation, click) => {
    const pending = page.waitForResponse((response) => {
      if (!response.url().includes("/api/method/surooh_accounting.native_lab.api.command"))
        return false;
      try {
        return response.request().postDataJSON().envelope.operation === operation;
      } catch {
        return false;
      }
    });
    await click();
    const response = await pending;
    if (!response.ok()) throw new Error(`UI ${operation} HTTP ${response.status()}`);
    return (await response.json()).message;
  };
  const before = await api("snapshot");
  await page.goto(`${origin}/components`);
  await page.getByRole("button", { name: "+ استلام بضاعة", exact: true }).click();
  const receipt = page.getByTestId("native-stock-dialog");
  await receipt.getByTestId("stock-component").selectOption("TEST-C1");
  await receipt.getByTestId("stock-quantity").fill("2");
  await receipt.getByLabel("تكلفة الوحدة EUR", { exact: true }).fill("10");
  await clickCommand("receive", () =>
    receipt.getByRole("button", { name: "تأكيد", exact: true }).click(),
  );
  await page.goto(`${origin}/bundles`);
  await page.getByRole("button", { name: "تعديل المكوّنات", exact: true }).first().click();
  await clickCommand("bundle", () =>
    page.getByRole("dialog").getByRole("button", { name: "حفظ", exact: true }).click(),
  );
  await page.goto(`${origin}/orders`);
  await page
    .getByRole("button", { name: /طلب اختبار/ })
    .first()
    .click();
  await page.getByTestId("order-product").selectOption("TEST-KIT");
  const placed = await clickCommand("order", () =>
    page
      .getByTestId("native-order-dialog")
      .getByRole("button", { name: "إنشاء الطلب", exact: true })
      .click(),
  );
  const order = page.locator(`[data-native-order="${placed.order_id}"]`);
  await clickCommand("pick", () =>
    order.getByRole("button", { name: "تجهيز", exact: true }).click(),
  );
  await clickCommand("pack", () =>
    order.getByRole("button", { name: "تعبئة", exact: true }).click(),
  );
  const shipped = await clickCommand("ship", () =>
    order.getByRole("button", { name: "شحن", exact: true }).click(),
  );
  const shippedState = await api("snapshot");
  const cogs = shippedState.general_ledger.filter((x) => x.voucher_no === shipped.delivery_note);
  if (
    !cogs.length ||
    Math.abs(cogs.reduce((sum, x) => sum + Number(x.debit) - Number(x.credit), 0)) > 0.001 ||
    cogs.reduce((sum, x) => sum + Number(x.debit), 0) !== 50
  )
    throw new Error("Native shipment GL/COGS mismatch");
  await clickCommand("return", () =>
    order.getByRole("button", { name: "مرتجع", exact: true }).click(),
  );
  const after = await api("snapshot");
  const value = (x) => x.items.reduce((sum, item) => sum + Number(item.value), 0);
  if (value(after) !== value(before) + 20)
    throw new Error("Receipt/ship/return stock value mismatch");
  await page.goto(`${origin}/movements`);
  await page.getByText(shipped.delivery_note, { exact: false }).first().waitFor();
  result.status = "PASS";
  result.evidence = {
    native_order: placed.order_id,
    delivery_note: shipped.delivery_note,
    cogs,
    value_before: value(before),
    value_after: value(after),
    real_browser: await browser.version(),
    existing_React_routes: ["/components", "/bundles", "/orders", "/movements"],
  };
} catch (error) {
  result.reason = error.message.replaceAll(config.token || "__absent__", "[REDACTED]");
  if (browser) result.status = "FAIL";
} finally {
  if (browser) await browser.close();
  if (server) server.kill("SIGTERM");
}
console.log(JSON.stringify(result));
process.exitCode = result.status === "PASS" ? 0 : 2;

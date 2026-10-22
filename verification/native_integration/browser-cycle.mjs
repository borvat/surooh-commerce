/** Real browser only. A missing browser is BLOCKED, never a simulated success. */
import fs from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const executable = config.executable;
const result = {
  id: "B01_rendered_existing_React_full_native_cycle",
  status: "BLOCKED",
  phase_complete: false,
  codex_start_authorized: false,
  scenarios: [],
};
let server,
  browser,
  executing = false;
try {
  if (!executable || !fs.existsSync(executable))
    throw new Error(
      "Explicit --browser-executable required and must exist. Real UI cycle NOT EXECUTED; no download attempted.",
    );
  const require = createRequire(import.meta.url);
  const { chromium } = require(
    config.playwright ||
      "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core",
  );
  browser = await chromium.launch({ executablePath: executable, headless: true });
  result.browser_version = await browser.version();
  // Capability checks do not count as executing B01. Never contact a non-loopback service.
  if (!config.token || !config.bun || !config.wmsRoot)
    throw new Error("Synthetic runner token, Bun and WMS checkout are required; B01 NOT RUN");
  fs.accessSync(config.bun, fs.constants.X_OK);
  const nativeHealth = await fetch("http://127.0.0.1:18080", {
    signal: AbortSignal.timeout(3000),
  }).catch(() => {
    throw new Error("Synthetic native runtime unavailable at 127.0.0.1:18080; B01 NOT RUN");
  });
  await nativeHealth.body?.cancel();
  // Do not attach to an unrelated server already occupying the fixed lab UI port.
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(18081, "127.0.0.1", () => probe.close(resolve));
  });
  let serverError;
  server = spawn(config.bun, ["run", "dev"], {
    cwd: config.wmsRoot,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          ["PATH", "LANG", "LC_ALL", "TZ", "HOME"].includes(key),
        ),
      ),
      WMS_NATIVE_UI_TEST: "true",
      VITE_SUROOH_NATIVE_LAB: "true",
    },
    stdio: "ignore",
  });
  server.on("error", (error) => {
    serverError = error;
  });
  const origin = "http://127.0.0.1:18081";
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error("Owned UI server exited before readiness");
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("Owned UI server did not become ready; B01 NOT RUN");
  const context = await browser.newContext();
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(15000);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await context.addInitScript(
    (session) => {
      window.__SUROOH_NATIVE_SESSION__ = session;
    },
    { url: origin, token: config.token },
  );
  const page = await context.newPage();
  const endpoint = "**/api/method/surooh_accounting.native_lab.api.command";
  const api = async (operation, payload = {}) => {
    const response = await fetch(
      "http://127.0.0.1:18080/api/method/surooh_accounting.native_lab.api.command",
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
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
  const mark = (name) => result.scenarios.push({ name, status: "PASS" });
  const stock = (snapshot) =>
    snapshot.items
      .filter((x) => x.stock)
      .map(({ id, physical, reserved, value }) => ({ id, physical, reserved, value }))
      .sort((a, b) => a.id.localeCompare(b.id));
  const ledger = (snapshot) => ({
    stock: stock(snapshot),
    movements: snapshot.movements,
    general_ledger: snapshot.general_ledger,
  });
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
    const [response] = await Promise.all([pending, click()]);
    if (!response.ok()) throw new Error(`UI ${operation} HTTP ${response.status()}`);
    return (await response.json()).message;
  };
  const before = await api("snapshot");
  executing = true;
  await page.goto(`${origin}/components`);
  await page.getByRole("button", { name: "+ استلام بضاعة", exact: true }).click();
  const receipt = page.getByTestId("native-stock-dialog");
  await receipt.getByTestId("stock-component").selectOption("TEST-C1");
  await receipt.getByTestId("stock-quantity").fill("2");
  await receipt.getByLabel("تكلفة الوحدة EUR", { exact: true }).fill("10");
  await page.keyboard.press("Escape");
  await receipt.waitFor({ state: "hidden" });
  assert.deepEqual(
    ledger(await api("snapshot")),
    ledger(before),
    "Dismissed receipt mutated native stock",
  );
  mark("interrupted_receipt_form_no_write");
  await page.getByRole("button", { name: "+ استلام بضاعة", exact: true }).click();
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
  const createOrder = async () => {
    await page
      .getByRole("button", { name: /طلب اختبار/ })
      .first()
      .click();
    await page.getByTestId("order-product").selectOption("TEST-KIT");
    return clickCommand("order", () =>
      page
        .getByTestId("native-order-dialog")
        .getByRole("button", { name: "إنشاء الطلب", exact: true })
        .click(),
    );
  };
  const placed = await createOrder();
  const order = page.locator(`[data-native-order="${placed.order_id}"]`);
  await clickCommand("pick", () =>
    order.getByRole("button", { name: "تجهيز", exact: true }).click(),
  );
  await page.reload();
  await order.getByRole("button", { name: "تعبئة", exact: true }).waitFor();
  mark("reload_retains_native_pick_and_next_action");
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
  const returned = await api("snapshot");
  await page.reload();
  await clickCommand("return", () =>
    order.getByRole("button", { name: "مرتجع", exact: true }).click(),
  );
  assert.deepEqual(
    ledger(await api("snapshot")),
    ledger(returned),
    "Reload return replay duplicated ledger",
  );
  mark("return_replay_after_reload_no_duplicate_ledger");
  const after = await api("snapshot");
  const value = (x) => x.items.reduce((sum, item) => sum + Number(item.value), 0);
  if (value(after) !== value(before) + 20)
    throw new Error("Receipt/ship/return stock value mismatch");
  await page.goto(`${origin}/movements`);
  await page.getByText(shipped.delivery_note, { exact: false }).first().waitFor();
  mark("receive_bundle_order_pick_pack_ship_return_and_history");
  await page.goto(`${origin}/orders`);
  // Cancel at every pre-shipment stage; reservations return to the starting baseline.
  for (const stage of ["placed", "picked", "packed"]) {
    const baseline = await api("snapshot");
    const created = await createOrder();
    const row = page.locator(`[data-native-order="${created.order_id}"]`);
    if (stage !== "placed")
      await clickCommand("pick", () =>
        row.getByRole("button", { name: "تجهيز", exact: true }).click(),
      );
    if (stage === "packed")
      await clickCommand("pack", () =>
        row.getByRole("button", { name: "تعبئة", exact: true }).click(),
      );
    await clickCommand("cancel", () =>
      row.getByRole("button", { name: "إلغاء", exact: true }).click(),
    );
    await page.reload();
    await page.getByText(created.order_id, { exact: true }).waitFor();
    const cancelled = await api("snapshot");
    assert.equal(cancelled.orders.find((x) => x.id === created.order_id)?.status, "cancelled");
    assert.deepEqual(
      ledger(cancelled),
      ledger(baseline),
      "Cancellation changed physical/financial baseline or leaked reservations",
    );
    await row.waitFor({ state: "hidden" });
    mark(`cancel_${stage}_reload_reservations_released`);
  }
  const retryBaseline = await api("snapshot");
  const retryOrder = await createOrder();
  const retryRow = page.locator(`[data-native-order="${retryOrder.order_id}"]`);
  // Forward the real mutation, then lose only its response. No successful response is mocked.
  let lostEnvelope, committedPick;
  const loseResponse = async (route) => {
    const envelope = route.request().postDataJSON().envelope;
    if (envelope.operation !== "pick") return route.fallback();
    lostEnvelope = envelope;
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    committedPick = (await response.json()).message;
    await route.abort("failed");
  };
  await page.route(endpoint, loseResponse);
  await Promise.all([
    page.waitForEvent("requestfailed", {
      predicate: (request) => request.postDataJSON()?.envelope?.operation === "pick",
    }),
    retryRow.getByRole("button", { name: "تجهيز", exact: true }).click(),
  ]);
  await page.locator('[data-sonner-toast][data-type="error"]').last().waitFor();
  await page.unroute(endpoint, loseResponse);
  assert.ok(committedPick?.pick_list, "Lost response did not commit a native pick");
  const committed = await api("snapshot");
  const replayRequest = page.waitForRequest(
    (request) =>
      request.url().includes("native_lab.api.command") &&
      request.postDataJSON()?.envelope.operation === "pick",
  );
  const replayed = await clickCommand("pick", () =>
    retryRow.getByRole("button", { name: "تجهيز", exact: true }).click(),
  );
  assert.deepEqual((await replayRequest).postDataJSON().envelope, lostEnvelope);
  assert.equal(replayed.pick_list, committedPick.pick_list);
  assert.deepEqual(ledger(await api("snapshot")), ledger(committed));
  await page.reload();
  await retryRow.getByRole("button", { name: "تعبئة", exact: true }).waitFor();
  mark("committed_pick_lost_response_retry_same_identity_reload");
  // A real interruption before dispatch must not mutate the engine.
  const errorBefore = await api("snapshot");
  const abortPack = (route) =>
    route.request().postDataJSON().envelope.operation === "pack"
      ? route.abort("failed")
      : route.fallback();
  await page.route(endpoint, abortPack);
  await Promise.all([
    page.waitForEvent("requestfailed", {
      predicate: (request) => request.postDataJSON()?.envelope?.operation === "pack",
    }),
    retryRow.getByRole("button", { name: "تعبئة", exact: true }).click(),
  ]);
  await page.locator('[data-sonner-toast][data-type="error"]').last().waitFor();
  await page.unroute(endpoint, abortPack);
  assert.deepEqual(await api("snapshot"), errorBefore);
  await clickCommand("pack", () =>
    retryRow.getByRole("button", { name: "تعبئة", exact: true }).click(),
  );
  await clickCommand("cancel", () =>
    retryRow.getByRole("button", { name: "إلغاء", exact: true }).click(),
  );
  assert.deepEqual(ledger(await api("snapshot")), ledger(retryBaseline));
  mark("interrupted_pack_no_write_then_retry_and_cancel");
  const staleOrder = await createOrder();
  const staleRow = page.locator(`[data-native-order="${staleOrder.order_id}"]`);
  await staleRow.getByRole("button", { name: "تجهيز", exact: true }).waitFor();
  // Another real native command invalidates the screen's cached projection.
  await api("cancel", { order_id: staleOrder.order_id });
  const staleBaseline = await api("snapshot");
  const rejection = page.waitForResponse(
    (response) =>
      response.url().includes("native_lab.api.command") &&
      response.request().postDataJSON()?.envelope.operation === "pick",
  );
  await staleRow.getByRole("button", { name: "تجهيز", exact: true }).click();
  assert.equal((await rejection).ok(), false, "Stale cancelled order must reject pick");
  await page.locator('[data-sonner-toast][data-type="error"]').last().waitFor();
  assert.deepEqual(await api("snapshot"), staleBaseline);
  await page.reload();
  await page.getByText(staleOrder.order_id, { exact: true }).waitFor();
  await staleRow.waitFor({ state: "hidden" });
  mark("stale_cancelled_order_rejected_error_visible_reload_recovers");
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
  if (executing) result.status = "FAIL";
} finally {
  try {
    if (browser) await browser.close();
    if (server?.pid) {
      const exited =
        server.exitCode !== null || server.signalCode !== null
          ? Promise.resolve()
          : once(server, "exit");
      server.kill("SIGTERM");
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
      if (server.exitCode === null && server.signalCode === null) {
        server.kill("SIGKILL");
        await exited;
      }
    }
  } catch (error) {
    result.cleanup_error = error.message;
    result.status = "FAIL";
  }
}
console.log(JSON.stringify(result));
process.exitCode = result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2;

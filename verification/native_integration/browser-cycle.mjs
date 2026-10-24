/** Real browser only. A missing browser is BLOCKED, never a simulated success. */
import fs from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
import {
  waitForReady,
  beginErrorObservation,
  requireFreshError,
  isOrderRequest,
} from "./browser-helpers.mjs";
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
  page,
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
  await waitForReady({
    checkProcess: () => {
      if (serverError) throw serverError;
      if (server.exitCode !== null) throw new Error("Owned UI server exited before readiness");
    },
    probe: async (remainingMs) => {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(Math.max(1, Math.floor(remainingMs))),
      });
      await response.body?.cancel();
      return response.ok;
    },
  });
  const context = await browser.newContext();
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(15000);
  result.blocked_external_requests = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    result.blocked_external_requests.push(`${url.origin}${url.pathname}`);
    return route.abort();
  });
  await context.addInitScript(
    (session) => {
      window.__SUROOH_NATIVE_SESSION__ = session;
    },
    { url: origin, token: config.token },
  );
  page = await context.newPage();
  result.page_errors = [];
  page.on("pageerror", (error) => result.page_errors.push(error.message));
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
  await receipt.getByTestId("stock-quantity").fill("1.5");
  await receipt.getByLabel("تكلفة الوحدة EUR", { exact: true }).fill("10");
  assert.equal(
    await receipt.getByRole("button", { name: "تأكيد", exact: true }).isDisabled(),
    true,
  );
  mark("fractional_receipt_quantity_is_rejected_without_truncation");
  await receipt.getByTestId("stock-quantity").fill("2");
  await receipt.getByLabel("تكلفة الوحدة EUR", { exact: true }).fill("10");
  let receivedEnvelope;
  const loseReceiptResponse = async (route) => {
    const envelope = route.request().postDataJSON().envelope;
    if (envelope.operation !== "receive") return route.fallback();
    receivedEnvelope = envelope;
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    await route.abort("failed");
  };
  await page.route(endpoint, loseReceiptResponse);
  await Promise.all([
    page.waitForEvent("requestfailed", {
      predicate: (request) => request.postDataJSON()?.envelope?.operation === "receive",
    }),
    receipt.getByRole("button", { name: "تأكيد", exact: true }).click(),
  ]);
  await receipt.getByRole("alert").waitFor();
  assert.equal(await receipt.getByTestId("stock-quantity").isDisabled(), true);
  assert.equal(await receipt.getByTestId("stock-component").isDisabled(), true);
  const committedReceipt = await api("snapshot");
  await page.unroute(endpoint, loseReceiptResponse);
  const [receiptReplay] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.url().includes("native_lab.api.command") &&
        request.postDataJSON()?.envelope?.operation === "receive",
    ),
    clickCommand("receive", () =>
      receipt.getByRole("button", { name: "إعادة التحقق من نفس الاستلام", exact: true }).click(),
    ),
  ]);
  assert.deepEqual(receiptReplay.postDataJSON().envelope, receivedEnvelope);
  assert.deepEqual(ledger(await api("snapshot")), ledger(committedReceipt));
  await receipt.waitFor({ state: "hidden" });
  mark("committed_receipt_lost_response_freezes_intent_and_retries_without_duplicate_stock_or_GL");
  const storagePanel = page.getByRole("region", { name: "مواقع التخزين والجرد" });
  await storagePanel.getByLabel("العملية", { exact: true }).selectOption("location_create");
  await storagePanel.getByLabel("اسم الموقع", { exact: true }).fill("TEST-BROWSER-QUARANTINE");
  await storagePanel.getByLabel("موقع حجر للبضاعة").check();
  const quarantine = await clickCommand("location_create", () =>
    storagePanel.getByRole("button", { name: "تأكيد العملية", exact: true }).click(),
  );
  mark("create_quarantine_location_from_storage_screen");
  await page.goto(`${origin}/bundles`);
  await page.getByText("TEST-KIT", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "تعديل المكوّنات", exact: true }).count(), 0);
  mark("warehouse_role_reads_native_bundle_without_admin_edit_control");
  await page.goto(`${origin}/orders`);
  const createOrder = async (quantity = 1) => {
    await page
      .getByRole("button", { name: /طلب اختبار/ })
      .first()
      .click();
    await page.getByTestId("order-product").selectOption("TEST-KIT");
    await page
      .getByTestId("native-order-dialog")
      .locator('input[type="number"]')
      .first()
      .fill(String(quantity));
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
  await order.getByLabel("موقع حجر المرتجع", { exact: true }).selectOption(quarantine.warehouse);
  const returnedCommand = await clickCommand("return_quarantine", () =>
    order.getByRole("button", { name: "مرتجع", exact: true }).click(),
  );
  const returned = await api("snapshot");
  await page.reload();
  await page
    .getByText(`تم استلام المرتجع · ${returnedCommand.return_note}`, { exact: true })
    .waitFor();
  assert.equal(await order.getByRole("button", { name: "مرتجع", exact: true }).count(), 0);
  assert.deepEqual(
    ledger(await api("snapshot")),
    ledger(returned),
    "Reload return replay duplicated ledger",
  );
  mark("quarantine_return_reload_shows_completed_document_without_duplicate_action");
  assert.deepEqual(
    stock(returned),
    stock(shippedState),
    "Quarantined return changed sellable stock",
  );
  await page.goto(`${origin}/components`);
  for (const [item, quantity] of [
    ["TEST-C1", 1],
    ["TEST-C2", 2],
  ]) {
    await storagePanel.getByLabel("العملية", { exact: true }).selectOption("stock_transfer");
    await storagePanel
      .getByLabel("الموقع المصدر", { exact: true })
      .selectOption(quarantine.warehouse);
    await storagePanel
      .getByLabel("الموقع الوجهة", { exact: true })
      .selectOption(returned.warehouse);
    await storagePanel.getByLabel("رمز المنتج", { exact: true }).fill(item);
    await storagePanel.getByLabel("الكمية المنقولة", { exact: true }).fill(String(quantity));
    await storagePanel
      .getByLabel("سبب العملية", { exact: true })
      .fill("Synthetic return inspection approved");
    await clickCommand("stock_transfer", () =>
      storagePanel.getByRole("button", { name: "تأكيد العملية", exact: true }).click(),
    );
    await storagePanel
      .getByRole("button", { name: "بدء عملية جديدة بعد مراجعة الرصيد", exact: true })
      .click();
  }
  mark("inspection_release_via_native_transfer_from_storage_screen");
  const after = await api("snapshot");
  const value = (x) => x.items.reduce((sum, item) => sum + Number(item.value), 0);
  if (value(after) !== value(before) + 20)
    throw new Error("Receipt/ship/return stock value mismatch");
  const catalogBefore = await api("snapshot");
  await page.goto(`${origin}/products`);
  const catalogSearch = page.getByLabel("بحث منتجات المستودع", { exact: true });
  await catalogSearch.fill("SYNTHETIC-C1");
  const catalogC1 = page.locator('[data-native-product="TEST-C1"]');
  await catalogC1.waitFor();
  assert.equal(await page.locator("[data-native-product]").count(), 1);
  const nativeC1 = catalogBefore.items.find((row) => row.id === "TEST-C1");
  assert.equal(Number(await catalogC1.locator("td").nth(3).textContent()), nativeC1.physical);
  assert.equal(Number(await catalogC1.locator("td").nth(4).textContent()), nativeC1.reserved);
  assert.equal(
    Number(await catalogC1.locator("td").nth(5).textContent()),
    nativeC1.physical - nativeC1.reserved,
  );
  await catalogSearch.fill("TEST-C2");
  await page.waitForFunction(() => document.querySelectorAll("[data-native-product]").length === 2);
  assert.equal(await page.locator("[data-native-product]").count(), 2);
  await catalogSearch.fill("TEST-KIT");
  const nativeKit = page.locator('[data-native-product="TEST-KIT"]');
  await nativeKit.waitFor();
  assert.ok((await nativeKit.textContent()).includes("TEST-C1"));
  assert.ok((await nativeKit.textContent()).includes("TEST-C2"));
  await catalogSearch.fill("NO-SUCH-SYNTHETIC-PRODUCT");
  await page.getByText("لا توجد أصناف مطابقة", { exact: true }).waitFor();
  assert.deepEqual(ledger(await api("snapshot")), ledger(catalogBefore));
  mark(
    "native_products_SKU_barcode_ambiguity_bundle_parts_quantities_and_empty_search_without_stock_writes",
  );
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
  const scannerBaseline = await api("snapshot");
  const scanOrder = await createOrder();
  const scanRow = page.locator(`[data-native-order="${scanOrder.order_id}"]`);
  await scanRow.getByRole("button", { name: "تجهيز بالمسح", exact: true }).click();
  const scanner = page.getByRole("dialog");
  const scanInput = scanner.getByLabel("رمز المنتج أو الباركود", { exact: true });
  const submitScan = async (code) => {
    await scanInput.fill(code);
    await scanInput.press("Enter");
  };
  await submitScan("NO-SUCH-SYNTHETIC");
  await scanner.getByRole("alert").waitFor();
  for (const code of ["SYNTHETIC-C1", "SYNTHETIC-C2", "SYNTHETIC-C2"]) await submitScan(code);
  await scanner.getByRole("button", { name: "تراجع عن آخر مسح", exact: true }).click();
  assert.equal(
    await scanner.getByRole("button", { name: "تأكيد التجهيز", exact: true }).isDisabled(),
    true,
  );
  await submitScan("SYNTHETIC-C2");
  const scanPick = await clickCommand("scan_pick", () =>
    scanner.getByRole("button", { name: "تأكيد التجهيز", exact: true }).click(),
  );
  await scanRow.getByRole("button", { name: "تعبئة", exact: true }).waitFor();
  assert.equal(
    (await api("snapshot")).orders.find((row) => row.id === scanOrder.order_id).pick_list,
    scanPick.pick_list,
  );
  await clickCommand("cancel", () =>
    scanRow.getByRole("button", { name: "إلغاء", exact: true }).click(),
  );
  assert.deepEqual(ledger(await api("snapshot")), ledger(scannerBaseline));
  mark("scanner_unknown_code_undo_complete_native_pick_and_cancel");
  const batchOrder = await createOrder(2);
  const batchPanel = page.locator(`[data-native-batches="${batchOrder.order_id}"]`);
  await batchPanel.getByLabel("وحدات دفعة الشحن", { exact: true }).fill("1");
  await clickCommand("batch_pick", () =>
    batchPanel.getByRole("button", { name: "تجهيز دفعة", exact: true }).click(),
  );
  await clickCommand("batch_pack", () =>
    batchPanel.getByRole("button", { name: "تعبئة الدفعة", exact: true }).click(),
  );
  await clickCommand("batch_cancel", () =>
    batchPanel.getByRole("button", { name: "إلغاء تجهيز الدفعة", exact: true }).click(),
  );
  for (let index = 0; index < 2; index++) {
    await batchPanel.getByLabel("وحدات دفعة الشحن", { exact: true }).fill("1");
    await clickCommand("batch_pick", () =>
      batchPanel.getByRole("button", { name: "تجهيز دفعة", exact: true }).click(),
    );
    await clickCommand("batch_pack", () =>
      batchPanel.getByRole("button", { name: "تعبئة الدفعة", exact: true }).click(),
    );
    await clickCommand("batch_ship", () =>
      batchPanel.getByRole("button", { name: "شحن الدفعة", exact: true }).click(),
    );
    const current = (await api("snapshot")).orders.find((row) => row.id === batchOrder.order_id);
    assert.equal(current.shipment_plan.remaining_units, 1 - index);
    assert.equal(current.shipment_batches.filter((row) => row.shipped).length, index + 1);
  }
  for (let index = 0; index < 2; index++) {
    await batchPanel
      .getByLabel("موقع حجر مرتجع الدفعة", { exact: true })
      .selectOption(quarantine.warehouse);
    await clickCommand("return_quarantine", () =>
      batchPanel.getByRole("button", { name: "مرتجع هذه الشحنة", exact: true }).first().click(),
    );
  }
  mark("proportional_batches_packed_cancel_replacement_two_shipments_and_per_delivery_returns");
  const closeOrder = await createOrder(3);
  const closePanel = page.locator(`[data-native-batches="${closeOrder.order_id}"]`);
  await closePanel.getByLabel("وحدات دفعة الشحن", { exact: true }).fill("1");
  await clickCommand("batch_pick", () =>
    closePanel.getByRole("button", { name: "تجهيز دفعة", exact: true }).click(),
  );
  await clickCommand("batch_pack", () =>
    closePanel.getByRole("button", { name: "تعبئة الدفعة", exact: true }).click(),
  );
  await clickCommand("batch_ship", () =>
    closePanel.getByRole("button", { name: "شحن الدفعة", exact: true }).click(),
  );
  await closePanel
    .getByLabel("سبب إغلاق باقي الطلب", { exact: true })
    .fill("Synthetic customer closes the remainder");
  const closeBefore = await api("snapshot");
  await clickCommand("close_remainder", () =>
    closePanel.getByRole("button", { name: "إغلاق الباقي وتحرير الحجز", exact: true }).click(),
  );
  const closeAfter = await api("snapshot");
  assert.equal(
    closeAfter.orders.find((row) => row.id === closeOrder.order_id).remainder_closed,
    true,
  );
  assert.deepEqual(closeAfter.movements, closeBefore.movements);
  assert.deepEqual(closeAfter.general_ledger, closeBefore.general_ledger);
  for (const [item, released] of [
    ["TEST-C1", 2],
    ["TEST-C2", 4],
  ]) {
    const old = closeBefore.items.find((row) => row.id === item);
    const current = closeAfter.items.find((row) => row.id === item);
    assert.equal(current.physical, old.physical);
    assert.equal(current.value, old.value);
    assert.equal(current.reserved, old.reserved - released);
  }
  await page.getByRole("button", { name: "بانتظار الشحن", exact: true }).click();
  await page.getByText(closeOrder.order_id, { exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "أُغلق الباقي", exact: true }).click();
  await page.getByText(closeOrder.order_id, { exact: true }).waitFor();
  await page.reload();
  await closePanel.getByRole("status").filter({ hasText: "أُغلق باقي الطلب" }).waitFor();
  assert.equal(
    await closePanel.getByRole("button", { name: "تجهيز دفعة", exact: true }).count(),
    0,
  );
  await closePanel
    .getByLabel("موقع حجر مرتجع الدفعة", { exact: true })
    .selectOption(quarantine.warehouse);
  await clickCommand("return_quarantine", () =>
    closePanel.getByRole("button", { name: "مرتجع هذه الشحنة", exact: true }).click(),
  );
  assert.equal(
    (await api("snapshot")).orders.find((row) => row.id === closeOrder.order_id).remainder_closed,
    true,
  );
  mark("close_remainder_releases_only_unused_reservations_filters_reload_and_return_after_close");
  await page.getByRole("button", { name: "الكل", exact: true }).click();
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
  const pickErrorBoundary = await beginErrorObservation(page, "pick", retryOrder.order_id);
  await page.route(endpoint, loseResponse);
  await Promise.all([
    page.waitForEvent("requestfailed", {
      predicate: (request) => isOrderRequest(request, "pick", retryOrder.order_id),
    }),
    retryRow.getByRole("button", { name: "تجهيز", exact: true }).click(),
  ]);
  await requireFreshError(page, pickErrorBoundary, "Failed to fetch");
  await page.unroute(endpoint, loseResponse);
  assert.ok(committedPick?.pick_list, "Lost response did not commit a native pick");
  const committed = await api("snapshot");
  assert.equal(lostEnvelope.payload.order_id, retryOrder.order_id);
  // A confirmed refresh advances the operator to packing: do not require a
  // second pick click that the correct current UI deliberately no longer offers.
  // A09 independently verifies same-key explicit replay through the real client.
  await retryRow.getByRole("button", { name: "تعبئة", exact: true }).waitFor();
  assert.equal(
    committed.orders.find((row) => row.id === retryOrder.order_id).pick_list,
    committedPick.pick_list,
  );
  assert.deepEqual(ledger(await api("snapshot")), ledger(committed));
  await page.reload();
  await retryRow.getByRole("button", { name: "تعبئة", exact: true }).waitFor();
  mark("committed_pick_lost_response_native_refresh_and_reload_recover_same_document");
  // A real interruption before dispatch must not mutate the engine.
  const errorBefore = await api("snapshot");
  const abortPack = (route) =>
    route.request().postDataJSON().envelope.operation === "pack"
      ? route.abort("failed")
      : route.fallback();
  const packErrorBoundary = await beginErrorObservation(page, "pack", retryOrder.order_id);
  await page.route(endpoint, abortPack);
  await Promise.all([
    page.waitForEvent("requestfailed", {
      predicate: (request) => isOrderRequest(request, "pack", retryOrder.order_id),
    }),
    retryRow.getByRole("button", { name: "تعبئة", exact: true }).click(),
  ]);
  await requireFreshError(page, packErrorBoundary, "Failed to fetch");
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
  const staleErrorBoundary = await beginErrorObservation(page, "pick", staleOrder.order_id);
  const [rejected] = await Promise.all([
    page.waitForResponse((response) =>
      isOrderRequest(response.request(), "pick", staleOrder.order_id),
    ),
    staleRow.getByRole("button", { name: "تجهيز", exact: true }).click(),
  ]);
  assert.equal(rejected.ok(), false, "Stale cancelled order must reject pick");
  await requireFreshError(
    page,
    staleErrorBoundary,
    `Native boundary rejected request: ${rejected.status()}`,
  );
  assert.deepEqual(await api("snapshot"), staleBaseline);
  await page.reload();
  await page.getByText(staleOrder.order_id, { exact: true }).waitFor();
  await staleRow.waitFor({ state: "hidden" });
  mark("stale_cancelled_order_rejected_error_visible_reload_recovers");
  await page.goto(`${origin}/components`);
  await storagePanel.getByLabel("العملية", { exact: true }).selectOption("location_create");
  await storagePanel.getByLabel("اسم الموقع", { exact: true }).fill("TEST-BROWSER-COUNT");
  const countLocation = await clickCommand("location_create", () =>
    storagePanel.getByRole("button", { name: "تأكيد العملية", exact: true }).click(),
  );
  await storagePanel
    .getByRole("button", { name: "بدء عملية جديدة بعد مراجعة الرصيد", exact: true })
    .click();
  const locationsBeforeCount = await api("stock_locations");
  await storagePanel.getByLabel("العملية", { exact: true }).selectOption("stock_transfer");
  await storagePanel
    .getByLabel("الموقع المصدر", { exact: true })
    .selectOption(locationsBeforeCount.fulfillment_warehouse);
  await storagePanel
    .getByLabel("الموقع الوجهة", { exact: true })
    .selectOption(countLocation.warehouse);
  await storagePanel.getByLabel("رمز المنتج", { exact: true }).fill("TEST-C1");
  await storagePanel.getByLabel("الكمية المنقولة", { exact: true }).fill("2");
  await storagePanel.getByLabel("سبب العملية", { exact: true }).fill("Synthetic count staging");
  await clickCommand("stock_transfer", () =>
    storagePanel.getByRole("button", { name: "تأكيد العملية", exact: true }).click(),
  );
  await storagePanel
    .getByRole("button", { name: "بدء عملية جديدة بعد مراجعة الرصيد", exact: true })
    .click();
  await storagePanel.getByLabel("العملية", { exact: true }).selectOption("stock_count");
  await storagePanel
    .getByLabel("الموقع المعدود", { exact: true })
    .selectOption(countLocation.warehouse);
  await storagePanel.getByLabel("رمز المنتج", { exact: true }).fill("TEST-C1");
  await storagePanel.getByLabel("الكمية المعدودة", { exact: true }).fill("3");
  await storagePanel
    .getByRole("button", { name: "بدء الجرد وحفظ الرصيد للمقارنة", exact: true })
    .click();
  await storagePanel.getByLabel("سبب العملية", { exact: true }).fill("Synthetic physical count +1");
  const counted = await clickCommand("stock_count", () =>
    storagePanel.getByRole("button", { name: "تأكيد العملية", exact: true }).click(),
  );
  const locationsAfterCount = await api("stock_locations");
  const countedBin = locationsAfterCount.bins.find(
    (row) => row.warehouse === countLocation.warehouse && row.item_code === "TEST-C1",
  );
  assert.equal(countedBin.actual_qty, 3);
  assert.equal(countedBin.stock_value, 30);
  const countLedger = (await api("snapshot")).general_ledger.filter(
    (row) => row.voucher_no === counted.stock_reconciliation,
  );
  assert.equal(
    countLedger.reduce((sum, row) => sum + Number(row.debit), 0),
    10,
  );
  assert.equal(
    countLedger.reduce((sum, row) => sum + Number(row.debit) - Number(row.credit), 0),
    0,
  );
  mark("rendered_location_transfer_count_adjustment_matches_native_bin_value_and_balanced_GL");
  result.viewports = [];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ["products", "components", "bundles", "orders", "movements"]) {
      await page.goto(`${origin}/${route}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.waitForLoadState("networkidle");
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      assert.ok(
        dimensions.document <= dimensions.width + 1,
        `${route} overflows viewport: ${JSON.stringify(dimensions)}`,
      );
      const screenshot = `browser-${route}-${viewport.width}.png`;
      if (config.artifactDir)
        await page.screenshot({ path: `${config.artifactDir}/${screenshot}`, fullPage: true });
      result.viewports.push({ route, ...viewport, dimensions, screenshot });
    }
  }
  assert.deepEqual(result.page_errors, [], "Unhandled browser errors");
  assert.equal(
    result.blocked_external_requests.some((url) => url.includes("supabase")),
    false,
    "Native screen attempted a legacy Supabase request",
  );
  mark("desktop_and_phone_five_native_screens_no_document_overflow_or_unhandled_JS_errors");
  result.status = "PASS";
  result.evidence = {
    native_order: placed.order_id,
    delivery_note: shipped.delivery_note,
    cogs,
    value_before: value(before),
    value_after: value(after),
    real_browser: await browser.version(),
    existing_React_routes: ["/products", "/components", "/bundles", "/orders", "/movements"],
  };
} catch (error) {
  result.reason = error.message.replaceAll(config.token || "__absent__", "[REDACTED]");
  if (page) {
    result.visible_text_at_failure = (
      await page
        .locator("body")
        .innerText()
        .catch(() => "")
    ).replaceAll(config.token || "__absent__", "[REDACTED]");
    if (config.artifactDir) {
      await page
        .screenshot({ path: `${config.artifactDir}/browser-failure.png`, fullPage: true })
        .catch(() => {});
    }
  }
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

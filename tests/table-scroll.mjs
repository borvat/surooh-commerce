import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Run with Playwright installed, or CODEX_PRIMARY_RUNTIME_NODE_MODULES set.
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`
    : "playwright",
);
const source = readFileSync("src/components/app/page.tsx", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", compiled)(require, mod, mod.exports);
const { Table } = mod.exports;
const h = React.createElement;
const html = renderToStaticMarkup(
  h(
    Table,
    {
      label: "طلبات الاختبار",
      head: ["الطلب", "المنتج", "الحالة"],
    },
    Array.from({ length: 50 }, (_, i) =>
      h(
        "tr",
        { key: i },
        h("td", { className: "px-4 py-3 whitespace-nowrap" }, `ORDER-${i}`),
        h(
          "td",
          { className: "px-4 py-3 whitespace-nowrap" },
          "منتج طويل الاسم لاختبار تمرير الجدول بأمان ".repeat(3),
        ),
        h("td", { className: "px-4 py-3" }, h("button", null, `فتح ${i}`)),
      ),
    ),
  ),
);
const server = await createServer({
  configFile: false,
  root: resolve("."),
  plugins: [tailwindcss()],
  server: { host: "127.0.0.1", port: 0 },
});
await server.listen();
let browser;
try {
  const css = await (await fetch(`${server.resolvedUrls.local[0]}src/styles.css?direct`)).text();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
    args: process.env.CHROMIUM_EXECUTABLE_PATH ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
  });
  const page = await browser.newPage();
  for (const width of [375, 768, 1440]) {
    for (const dir of ["rtl", "ltr"]) {
      await page.setViewportSize({ width, height: 800 });
      await page.setContent(
        `<html dir="${dir}"><style>${css}</style><body><main style="padding:16px">${html}</main></body></html>`,
      );
      const region = page.getByRole("region", { name: "طلبات الاختبار" });
      assert.equal(await region.count(), 1, "table must expose a named keyboard scroll region");
      assert.equal(await page.locator("tbody tr").count(), 50);
      assert.equal(await page.locator("button").count(), 50);
      const dimensions = await region.evaluate((e) => ({
        height: e.clientHeight,
        total: e.scrollHeight,
      }));
      assert.ok(
        dimensions.height <= 562 && dimensions.total > dimensions.height,
        "long tables must scroll inside the viewport",
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        "wide rows must not widen the page",
      );
      await region.focus();
      await page.keyboard.press("PageDown");
      await page.waitForFunction(() => document.activeElement.scrollTop > 0);
      const top = await region.evaluate((e) => e.getBoundingClientRect().top);
      const head = await page.locator("thead").boundingBox();
      assert.ok(Math.abs(head.y - top) < 3, "column headings must remain visible while scrolling");
      console.log(
        `PASS ${width}px ${dir}: containment, keyboard scrolling, sticky header, rows/actions preserved`,
      );
    }
  }
} finally {
  await browser?.close();
  await server.close();
}

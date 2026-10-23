import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureNativeLab, nativeLabCommand } from "../src/lib/native-lab-client";
import { stockLocations } from "../src/lib/native-stock-operations";
import { NativeStockOperations } from "../src/components/app/native-stock-operations";

let server: Server | undefined;
afterEach(async () => {
  configureNativeLab(undefined);
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});
async function endpoint(body: unknown, status = 200) {
  server = createServer((_req, res) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  configureNativeLab({
    syntheticOnly: true,
    company: "TEST-A",
    url: `http://127.0.0.1:${address.port}`,
    token: () => "SYNTHETIC",
  });
}
const snapshot = () => ({
  company: "TEST-A",
  fulfillment_warehouse: "BASE",
  locations: [
    { name: "BASE", warehouse_name: "Base", is_rejected_warehouse: 0 },
    { name: "HOLD", warehouse_name: "Hold", is_rejected_warehouse: 1 },
  ],
  bins: [
    {
      warehouse: "HOLD",
      item_code: "C1",
      actual_qty: 3,
      reserved_stock: 0,
      valuation_rate: 5,
      stock_value: 15,
    },
  ],
});

describe("warehouse read boundary (fabricated loopback responses)", () => {
  test("keeps quarantine separate from fulfillment", async () => {
    await endpoint({ message: snapshot() });
    expect((await stockLocations()).bins[0].warehouse).toBe("HOLD");
  });
  test("foreign or missing location balance fails closed", async () => {
    const data = snapshot();
    data.bins[0].warehouse = "FOREIGN";
    await endpoint({ message: data });
    await expect(stockLocations()).rejects.toThrow("Invalid warehouse balance");
  });
  test("duplicate balances cannot be silently summed", async () => {
    const data = snapshot();
    data.bins.push({ ...data.bins[0] });
    await endpoint({ message: data });
    await expect(stockLocations()).rejects.toThrow("Duplicate warehouse balance");
  });
  test("non-numeric stock fails closed", async () => {
    await endpoint({
      message: { ...snapshot(), bins: [{ ...snapshot().bins[0], actual_qty: "3" }] },
    });
    await expect(stockLocations()).rejects.toThrow("Invalid warehouse balance");
  });
  test("only explicit safe errors are exposed, not server traces", async () => {
    await endpoint({ _error_message: "Stock changed; recount", exception: "PRIVATE TRACE" }, 417);
    await expect(nativeLabCommand("stock_count", {}, "synthetic-error")).rejects.toThrow(
      "417 · Stock changed; recount",
    );
  });
});

function render(canOperate: boolean, state: "ready" | "error" | "refreshing") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
  });
  client.setQueryData(["native-locations"], snapshot());
  const query = client.getQueryCache().find({ queryKey: ["native-locations"] })!;
  if (state === "error") query.setState({ status: "error", error: new Error("Synthetic failure") });
  if (state === "refreshing") query.setState({ fetchStatus: "fetching" });
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(NativeStockOperations, { canOperate }),
    ),
  );
  client.clear();
  return html;
}
describe("storage controls (React render only, not browser acceptance)", () => {
  test("read-only operator gets balances without mutation form", () => {
    const html = render(false, "ready");
    expect(html).toContain("HOLD");
    expect(html).not.toContain("<form");
  });
  test("failed refresh disables stock writes with visible error", () => {
    const html = render(true, "error");
    expect(html).toContain('role="alert"');
    expect(html).toContain('<fieldset disabled=""');
  });
  test("background refresh disables writes", () => {
    expect(render(true, "refreshing")).toContain('<fieldset disabled=""');
  });
});

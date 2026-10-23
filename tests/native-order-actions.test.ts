import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NativeOrderActions } from "../src/components/app/native-order-actions";

// React rendering only. These assertions are not browser/native integration evidence.
function render(
  state: "error" | "refreshing" | "ready",
  stage: "placed" | "shipped" | "returned" | "no-quarantine" = "placed",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
  });
  client.setQueryData(["native-progress"], {
    orders: [
      {
        id: "SYNTHETIC-ORDER",
        status: "placed",
        pick_list: null,
        delivery_note: stage === "placed" ? null : "SYNTHETIC-DELIVERY",
        return_note: stage === "returned" ? "SYNTHETIC-RETURN" : null,
      },
    ],
  });
  client.setQueryData(["native-locations"], {
    company: "TEST-A",
    fulfillment_warehouse: "BASE",
    locations: [
      { name: "BASE", warehouse_name: "Sellable", is_rejected_warehouse: 0 },
      ...(stage === "no-quarantine"
        ? []
        : [{ name: "HOLD", warehouse_name: "Quarantine", is_rejected_warehouse: 1 }]),
    ],
    bins: [],
  });
  const query = client.getQueryCache().find({ queryKey: ["native-progress"] })!;
  if (state === "error")
    query.setState({ status: "error", error: new Error("Synthetic read failed") });
  if (state === "refreshing") query.setState({ fetchStatus: "fetching" });
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(NativeOrderActions, { orderId: "SYNTHETIC-ORDER" }),
    ),
  );
  client.clear();
  return html;
}

describe("native order recovery controls with stale cached order", () => {
  test("failed refresh replaces every stock action with visible retry", () => {
    const html = render("error");
    expect(html).toContain('role="alert"');
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("تجهيز");
    expect(html).not.toContain("إلغاء");
  });
  test("in-progress refresh disables both pick and cancellation", () => {
    const html = render("refreshing");
    expect(html).toContain("تجهيز");
    expect(html).toContain("إلغاء");
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });
  test("fresh loaded order has the next action and cancellation enabled", () => {
    const html = render("ready");
    expect(html).toContain("تجهيز");
    expect(html).toContain("إلغاء");
    expect(html).not.toContain('disabled=""');
  });
  test("shipped order requires choosing quarantine and excludes sellable destination", () => {
    const html = render("ready", "shipped");
    expect(html).toContain('value="HOLD"');
    expect(html).not.toContain('value="BASE"');
    expect(html).toContain('disabled=""');
  });
  test("confirmed return shows its native document without another return action", () => {
    const html = render("ready", "returned");
    expect(html).toContain("SYNTHETIC-RETURN");
    expect(html).not.toContain("<button");
  });
  test("missing quarantine explains the receiving prerequisite", () => {
    expect(render("ready", "no-quarantine")).toContain("أضف موقع حجر من شاشة المخزون أولاً.");
  });
});

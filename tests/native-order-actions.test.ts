import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NativeOrderActions } from "../src/components/app/native-order-actions";

// React rendering only. These assertions are not browser/native integration evidence.
function render(state: "error" | "refreshing" | "ready") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
  });
  client.setQueryData(["native-progress"], {
    orders: [{ id: "SYNTHETIC-ORDER", status: "placed", pick_list: null, delivery_note: null }],
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
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  test("fresh loaded order has the next action and cancellation enabled", () => {
    const html = render("ready");
    expect(html).toContain("تجهيز");
    expect(html).toContain("إلغاء");
    expect(html).not.toContain('disabled=""');
  });
});

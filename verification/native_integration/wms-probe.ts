import { configureNativeLab } from "../../src/lib/native-lab-client";
import { placeOrder, fulfillOrder, cancelOrder, listComponents } from "../../src/lib/inventory";
const data = await Bun.stdin.json();
configureNativeLab({
  syntheticOnly: true,
  url: "http://127.0.0.1:18080",
  company: "TEST-A",
  token: () => data.token,
});
const input = { lines: [{ product_id: "TEST-KIT", quantity: 1 }], externalRef: data.request };
if (data.operation === "order") {
  const first = await placeOrder(input);
  const replay = await placeOrder(input);
  if (first !== replay) throw new Error("WMS replay changed order ID");
  console.log(JSON.stringify({ order_id: first, same_result: true }));
} else if (data.operation === "ship") {
  await fulfillOrder(data.order_id);
  console.log(JSON.stringify({ shipped: data.order_id }));
} else if (data.operation === "cancel") {
  await cancelOrder(data.order_id);
  console.log(JSON.stringify({ cancelled: data.order_id }));
} else if (data.operation === "legacy-denial") {
  try {
    await listComponents({});
    throw new Error("legacy unexpectedly reachable");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Legacy inventory access disabled"))
      throw error;
  }
  console.log(JSON.stringify({ legacy_disabled: true }));
}

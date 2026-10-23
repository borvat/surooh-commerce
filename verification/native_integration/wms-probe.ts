import {
  nativeComponents,
  nativeOrders,
  nativeSnapshot,
  nativeProducts,
  nativeBom,
} from "../../src/lib/native-projection";
import { configureNativeLab, nativeOrderAction } from "../../src/lib/native-lab-client";
import {
  placeOrder,
  fulfillOrder,
  cancelOrder,
  listComponents,
  postMovement,
  setBundleContents,
} from "../../src/lib/inventory";
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

if (data.operation === "projection") {
  const components = await nativeComponents();
  const products = await nativeProducts();
  const bom = await nativeBom();
  const orders = await nativeOrders();
  const snapshot = await nativeSnapshot();
  if (!snapshot.warehouse || components.some((x) => !x.created_at || !x.updated_at))
    throw new Error("Incomplete native projection");
  if (!products.some((x) => x.product_type === "BUNDLE") || bom.length < 2)
    throw new Error("Bundle projection missing");
  console.log(
    JSON.stringify({
      company: snapshot.company,
      warehouse: snapshot.warehouse,
      stock_rows: components.length,
      products: products.length,
      bom: bom.length,
      orders: orders.length,
      movements: snapshot.movements.length,
    }),
  );
}

if (data.operation === "screens") {
  const before = await nativeSnapshot();
  await setBundleContents(
    "TEST-KIT",
    [
      { product_id: "TEST-C1", qty: 1 },
      { product_id: "TEST-C2", qty: 1 },
    ],
    "screens:bundle:B",
  );
  await setBundleContents(
    "TEST-KIT",
    [
      { product_id: "TEST-C1", qty: 1 },
      { product_id: "TEST-C2", qty: 2 },
    ],
    "screens:bundle:A",
  );
  const reverted = (await nativeSnapshot()).items.find((x) => x.id === "TEST-KIT");
  if (reverted?.parts.find((x) => x.item === "TEST-C2")?.quantity !== 2)
    throw new Error("Bundle A-B-A edit did not persist");
  const receipt = {
    componentId: "TEST-C1",
    type: "receipt" as const,
    reason: "Synthetic UI service receipt",
    quantity: 2,
    reference: "screens:receipt",
    nativeRate: 10,
  };
  await postMovement(receipt);
  await postMovement(receipt);
  const id = await placeOrder({
    lines: [{ product_id: "TEST-KIT", quantity: 1 }],
    externalRef: "screens:order",
  });
  // Exercise the actual screen command client against the real native server.
  // Both callers lose the one real response only after reading its committed result.
  // No successful business response or native effect is fabricated here.
  const realFetch = globalThis.fetch;
  let pickDispatches = 0;
  let committedPick: string | undefined;
  globalThis.fetch = async (url, init) => {
    const response = await realFetch(url, init);
    pickDispatches++;
    if (!response.ok) throw new Error(`Native pick injection HTTP ${response.status}`);
    const result = (await response.json()) as { message?: { pick_list?: string } };
    committedPick = result.message?.pick_list;
    if (!committedPick) throw new Error("Native pick did not return its committed document");
    throw new TypeError("Synthetic response loss after real native pick committed");
  };
  let interrupted: PromiseSettledResult<Record<string, unknown>>[];
  try {
    interrupted = await Promise.allSettled([
      nativeOrderAction("pick", id),
      nativeOrderAction("pick", id),
    ]);
  } finally {
    globalThis.fetch = realFetch;
  }
  if (
    pickDispatches !== 1 ||
    interrupted.some(
      (x) => x.status !== "rejected" || !String(x.reason).includes("Synthetic response loss"),
    )
  )
    throw new Error("Concurrent screen commands did not share the interrupted native dispatch");
  const persisted = (await nativeSnapshot()).orders.find((order) => order.id === id);
  if (persisted?.pick_list !== committedPick)
    throw new Error("Interrupted command did not persist its native pick");
  const recovered = await nativeOrderAction("pick", id);
  if (recovered["pick_list"] !== committedPick)
    throw new Error("Screen retry did not recover the same committed native pick");
  await nativeOrderAction("pack", id);
  const shipped = await nativeOrderAction("ship", id);
  const afterShip = await nativeSnapshot();
  const ledger = (
    afterShip as unknown as {
      general_ledger: { voucher_no: string; debit: number; credit: number }[];
    }
  ).general_ledger.filter((x) => x.voucher_no === shipped["delivery_note"]);
  if (
    ledger.reduce((n, x) => n + Number(x.debit), 0) !== 50 ||
    ledger.reduce((n, x) => n + Number(x.debit) - Number(x.credit), 0) !== 0
  )
    throw new Error("Native GL/COGS mismatch");
  await nativeOrderAction("return", id, String(shipped["delivery_note"]));
  await nativeOrderAction("return", id, String(shipped["delivery_note"]));
  const after = await nativeSnapshot();
  const value = (x: typeof after) => x.items.reduce((n, i) => n + Number(i.value), 0);
  if (value(after) !== value(before) + 20) throw new Error("Native stock valuation mismatch");
  console.log(
    JSON.stringify({
      actual_screen_services: true,
      rendered_browser: false,
      native_order: id,
      delivery_note: shipped["delivery_note"],
      COGS: 50,
      balanced_GL: true,
      before_value: value(before),
      after_value: value(after),
      receipt_replay_once: true,
      bundle_A_B_A: true,
      concurrent_screen_pick_dispatches: pickDispatches,
      interrupted_screen_callers: interrupted.length,
      lost_response_after_actual_commit: true,
      retry_recovered_same_native_pick: true,
    }),
  );
}

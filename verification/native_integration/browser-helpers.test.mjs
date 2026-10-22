/** Deterministic mechanics tests only; no browser, native runtime or network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  waitForReady,
  markExistingToasts,
  hasFreshError,
  noVisibleErrors,
  isOrderRequest,
} from "./browser-helpers.mjs";

function clockProbe(outcomes, timeoutMs = 1600) {
  let time = 0,
    attempts = 0;
  const sleeps = [],
    budgets = [];
  const options = {
    now: () => time,
    timeoutMs,
    intervalMs: 500,
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
    probe: async (budget) => {
      budgets.push(budget);
      const next = outcomes[attempts++] ?? false;
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { options, sleeps, budgets, elapsed: () => time, attempts: () => attempts };
}

test("reproduces old rapid HTTP503 exhaustion with no elapsed startup time", async () => {
  let attempts = 0,
    sleeps = 0;
  for (; attempts < 60; attempts++) {
    try {
      const response = { ok: false };
      if (response.ok) break;
    } catch {
      sleeps++;
    }
  }
  assert.equal(attempts, 60);
  assert.equal(sleeps, 0);
});
test("503 responses back off until eventual readiness", async () => {
  const c = clockProbe([false, false, true]);
  await waitForReady(c.options);
  assert.deepEqual(c.sleeps, [500, 500]);
  assert.equal(c.attempts(), 3);
});
test("connection failures and503 share backoff before readiness", async () => {
  const c = clockProbe([Error("ECONNREFUSED"), false, true]);
  await waitForReady(c.options);
  assert.deepEqual(c.sleeps, [500, 500]);
});
test("repeated503 stops at elapsed deadline and caps final probe/backoff", async () => {
  const c = clockProbe([]);
  await assert.rejects(waitForReady(c.options), /B01 NOT RUN/);
  assert.equal(c.elapsed(), 1600);
  assert.deepEqual(c.sleeps, [500, 500, 500, 100]);
  assert.deepEqual(c.budgets, [1000, 1000, 600, 100]);
});
test("repeated connection failure stops at elapsed deadline", async () => {
  const c = clockProbe(Array(10).fill(Error("ECONNREFUSED")));
  await assert.rejects(waitForReady(c.options), /B01 NOT RUN/);
  assert.equal(c.elapsed(), 1600);
});
test("immediate readiness does not delay", async () => {
  const c = clockProbe([true]);
  await waitForReady(c.options);
  assert.deepEqual(c.sleeps, []);
});
test("owned process failure is not swallowed as a connection error", async () => {
  const c = clockProbe([true]);
  c.options.checkProcess = () => {
    throw Error("owned server exited");
  };
  await assert.rejects(waitForReady(c.options), /owned server exited/);
  assert.equal(c.attempts(), 0);
});

function toast(text, visible = true) {
  const attributes = new Map();
  return {
    setAttribute: (key, value) => attributes.set(key, value),
    getAttribute: (key) => attributes.get(key),
    getClientRects: () => (visible ? [{}] : []),
    querySelector: () => ({ textContent: text }),
  };
}
function domTest(run) {
  const oldDocument = globalThis.document,
    oldStyle = globalThis.getComputedStyle;
  const nodes = [];
  globalThis.document = { querySelectorAll: () => nodes };
  globalThis.getComputedStyle = () => ({ visibility: "visible", opacity: "1" });
  try {
    run(nodes);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
    if (oldStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = oldStyle;
  }
}
test("reproduces stale generic toast false positive; boundary rejects identical old error", () =>
  domTest((nodes) => {
    nodes.push(toast("Failed to fetch"));
    assert.ok(nodes.at(-1)); // Previous generic last-visible-toast assertion could pass.
    assert.equal(noVisibleErrors(), false);
    markExistingToasts("pack:order:unique");
    assert.equal(
      hasFreshError({ boundary: "pack:order:unique", message: "Failed to fetch" }),
      false,
    );
  }));
test("new visible error with expected text passes after boundary", () =>
  domTest((nodes) => {
    nodes.push(toast("Failed to fetch", false));
    assert.equal(noVisibleErrors(), true);
    markExistingToasts("pack:order:unique");
    nodes.push(toast("Failed to fetch"));
    assert.equal(
      hasFreshError({ boundary: "pack:order:unique", message: "Failed to fetch" }),
      true,
    );
  }));
test("fresh unrelated error or wrong status cannot satisfy operation feedback", () =>
  domTest((nodes) => {
    markExistingToasts("pick:stale:unique");
    nodes.push(toast("Native boundary rejected request: 401"));
    assert.equal(
      hasFreshError({
        boundary: "pick:stale:unique",
        message: "Native boundary rejected request: 417",
      }),
      false,
    );
  }));
test("new hidden error does not establish visible feedback", () =>
  domTest((nodes) => {
    markExistingToasts("pack:order:unique");
    nodes.push(toast("Failed to fetch", false));
    assert.equal(
      hasFreshError({ boundary: "pack:order:unique", message: "Failed to fetch" }),
      false,
    );
  }));
test("feedback request matches endpoint, operation, order and deterministic command identity", () => {
  const request = (
    overrides = {},
    url = "http://127.0.0.1:18081/api/method/surooh_accounting.native_lab.api.command",
  ) => ({
    url: () => url,
    postDataJSON: () => ({
      envelope: {
        operation: "pack",
        payload: { order_id: "SO-1" },
        request_id: "ui:pack:SO-1",
        ...overrides,
      },
    }),
  });
  assert.equal(isOrderRequest(request(), "pack", "SO-1"), true);
  for (const overrides of [
    { operation: "pick" },
    { payload: { order_id: "SO-2" } },
    { request_id: "old" },
  ])
    assert.equal(isOrderRequest(request(overrides), "pack", "SO-1"), false);
  assert.equal(isOrderRequest(request({}, "http://127.0.0.1:18081/other"), "pack", "SO-1"), false);
  assert.equal(
    isOrderRequest(
      {
        url: request().url,
        postDataJSON: () => {
          throw Error("bad json");
        },
      },
      "pack",
      "SO-1",
    ),
    false,
  );
});

test("old hidden toast reappearing after boundary still cannot pass", () =>
  domTest((nodes) => {
    const old = toast("Failed to fetch", false);
    nodes.push(old);
    markExistingToasts("pack:order:unique");
    old.getClientRects = () => [{}];
    assert.equal(
      hasFreshError({ boundary: "pack:order:unique", message: "Failed to fetch" }),
      false,
    );
  }));
test("late successful probe cannot pass after deadline", async () => {
  let time = 0;
  await assert.rejects(
    waitForReady({
      now: () => time,
      timeoutMs: 1000,
      probe: async () => {
        time = 1001;
        return true;
      },
      sleep: async () => {
        throw Error("no time remaining");
      },
    }),
    /B01 NOT RUN/,
  );
});

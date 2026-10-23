import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { configureNativeLab, nativeLabCommand } from "../src/lib/native-lab-client";

// Real loopback HTTP; fabricated responses test transport, not ERPNext acceptance.
const servers: Server[] = [];
afterEach(async () => {
  configureNativeLab(undefined);
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
async function endpoint(handler: Parameters<typeof createServer>[0], timeout = 1000) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No loopback address");
  configureNativeLab({
    syntheticOnly: true,
    url: `http://127.0.0.1:${address.port}`,
    company: "TEST-A",
    token: () => "synthetic-test-token",
    commandTimeoutMs: timeout,
  });
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("native transport recovery over synthetic loopback HTTP", () => {
  test("concurrent identical commands dispatch once", async () => {
    let calls = 0;
    await endpoint(async (_request, response) => {
      calls++;
      await delay(30);
      response.end(JSON.stringify({ message: { pick_list: "SYNTHETIC-PICK" } }));
    });
    const results = await Promise.all([
      nativeLabCommand("pick", { order_id: "SYNTHETIC-ORDER" }, "ui:pick:SYNTHETIC-ORDER"),
      nativeLabCommand("pick", { order_id: "SYNTHETIC-ORDER" }, "ui:pick:SYNTHETIC-ORDER"),
    ]);
    expect(calls).toBe(1);
    expect(results[0]).toEqual(results[1]);
  });

  test("same pending identity with changed payload rejects without a second dispatch", async () => {
    let calls = 0;
    await endpoint(async (_request, response) => {
      calls++;
      await delay(30);
      response.end('{"message":{"ok":true}}');
    });
    const first = nativeLabCommand("receive", { quantity: 1 }, "synthetic-receipt");
    await expect(nativeLabCommand("receive", { quantity: 2 }, "synthetic-receipt")).rejects.toThrow(
      "different payload",
    );
    await first;
    expect(calls).toBe(1);
  });

  test("timeout never retries automatically; manual retry retains the exact envelope", async () => {
    const received: string[] = [];
    await endpoint(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      received.push(body);
      if (received.length === 1) return; // Unknown result after dispatch.
      response.end('{"message":{"replayed":true}}');
    }, 100);
    await expect(
      nativeLabCommand("pick", { order_id: "SYNTHETIC-ORDER" }, "same-id"),
    ).rejects.toThrow("مهلة");
    expect(received).toHaveLength(1);
    expect(await nativeLabCommand("pick", { order_id: "SYNTHETIC-ORDER" }, "same-id")).toEqual({
      replayed: true,
    });
    expect(received).toHaveLength(2);
    expect(received[0]).toBe(received[1]);
  });

  test("timeout covers a stalled response body after HTTP headers", async () => {
    await endpoint((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write('{"message":');
    }, 100);
    await expect(nativeLabCommand("snapshot", {}, "stalled-body")).rejects.toThrow("مهلة");
  });

  test("logout aborts pending commands and rejects their results", async () => {
    let dispatched!: () => void;
    const seen = new Promise<void>((resolve) => {
      dispatched = resolve;
    });
    let finish!: () => void;
    await endpoint((_request, response) => {
      finish = () => response.end('{"message":{"old_session":true}}');
      dispatched();
    });
    const outcome = nativeLabCommand("snapshot", {}, "old-read").then(
      (value) => ({ value, error: undefined }),
      (error: Error) => ({ value: undefined, error }),
    );
    await seen;
    configureNativeLab(undefined);
    finish();
    const result = await outcome;
    expect(result.value).toBeUndefined();
    expect(result.error?.message).toContain("session changed");
  });

  test("failed token provider releases pending identity for another attempt", async () => {
    let calls = 0;
    configureNativeLab({
      syntheticOnly: true,
      company: "TEST-A",
      url: "http://127.0.0.1/",
      token: () => {
        calls++;
        throw new Error("Synthetic token unavailable");
      },
    });
    for (let i = 0; i < 2; i++)
      await expect(nativeLabCommand("identity", {}, "same-read")).rejects.toThrow(
        "token unavailable",
      );
    expect(calls).toBe(2);
  });

  test("HTTP rejection exposes status, never arbitrary response contents", async () => {
    await endpoint((_request, response) => {
      response.writeHead(403);
      response.end("SYNTHETIC-SENSITIVE-DETAIL");
    });
    await expect(nativeLabCommand("pick", {}, "denied")).rejects.toThrow(
      "Native boundary rejected request: 403",
    );
  });

  test("array result cannot masquerade as a command result", async () => {
    await endpoint((_request, response) => response.end('{"message":[]}'));
    await expect(nativeLabCommand("snapshot", {}, "invalid-result")).rejects.toThrow(
      "Missing native command result",
    );
  });
});

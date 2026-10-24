import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { configureNativeLab, nativeLabRead } from "../src/lib/native-lab-client";
import {
  nativeBom,
  nativeComponents,
  nativeLinks,
  nativeProducts,
} from "../src/lib/native-projection";

// Actual loopback HTTP with fabricated data: transport/projection evidence, not ERPNext.
const servers: Server[] = [];
afterEach(async () => {
  configureNativeLab(undefined);
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function endpoint(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No loopback address");
  configureNativeLab({
    syntheticOnly: true,
    company: "TEST-A",
    url: `http://127.0.0.1:${address.port}`,
    token: () => "SYNTHETIC",
    commandTimeoutMs: 2000,
  });
}
const snapshot = (physical: number) => ({
  company: "TEST-A",
  warehouse: "BASE",
  orders: [],
  movements: [],
  items: [
    {
      id: "C1",
      name: "C1",
      stock: true,
      uom: "Nos",
      physical,
      reserved: 0,
      value: physical * 10,
      parts: [],
      created_at: "2026-10-24T00:00:00Z",
      updated_at: "2026-10-24T00:00:00Z",
    },
  ],
});

describe("native simultaneous reads", () => {
  test("four real screen projections share one HTTP snapshot, then fetch a fresh revision", async () => {
    let calls = 0;
    const ids: string[] = [];
    const entered = deferred(),
      release = deferred();
    await endpoint(async (request, response) => {
      const revision = ++calls;
      let body = "";
      for await (const chunk of request) body += chunk;
      ids.push(JSON.parse(body).envelope.request_id);
      entered.resolve();
      await release.promise;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: snapshot(revision) }));
    });
    const projections = Promise.all([
      nativeComponents(),
      nativeProducts(),
      nativeBom(),
      nativeLinks(),
    ]);
    await entered.promise;
    release.resolve();
    const [components, products] = await projections;
    expect(calls).toBe(1);
    expect(components[0].physical_qty).toBe(1);
    expect(products[0].available_qty).toBe(1);
    expect((await nativeComponents())[0].physical_qty).toBe(2);
    expect(calls).toBe(2);
    expect(new Set(ids).size).toBe(2);
  });

  test("a failed shared read is rejected for both callers and does not poison retry", async () => {
    let calls = 0;
    await endpoint((_request, response) => {
      const current = ++calls;
      response.writeHead(current === 1 ? 503 : 200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(current === 1 ? {} : { message: snapshot(7) }));
    });
    const failed = await Promise.allSettled([nativeLabRead("snapshot"), nativeLabRead("snapshot")]);
    expect(failed.every((row) => row.status === "rejected")).toBe(true);
    expect(calls).toBe(1);
    expect((await nativeLabRead("snapshot"))["items"]).toEqual(snapshot(7).items);
    expect(calls).toBe(2);
  });

  test("session switch rejects the old read without clearing the new in-flight read", async () => {
    const oldEntered = deferred(),
      oldRelease = deferred(),
      newRelease = deferred();
    await endpoint(async (_request, response) => {
      oldEntered.resolve();
      await oldRelease.promise;
      response.end(JSON.stringify({ message: snapshot(1) }));
    });
    const oldRead = nativeLabRead("snapshot");
    const oldOutcome = oldRead.then(
      () => null,
      (error: Error) => error,
    );
    await oldEntered.promise;
    let calls = 0;
    await endpoint(async (_request, response) => {
      calls++;
      await newRelease.promise;
      response.end(JSON.stringify({ message: snapshot(9) }));
    });
    const first = nativeLabRead("snapshot");
    expect((await oldOutcome)?.message).toContain("Native session changed");
    const second = nativeLabRead("snapshot");
    oldRelease.resolve();
    newRelease.resolve();
    const results = await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(
      results.every((row) => JSON.stringify(row["items"]) === JSON.stringify(snapshot(9).items)),
    ).toBe(true);
  });

  test("the read coalescer cannot dispatch a mutation", async () => {
    let calls = 0;
    await endpoint((_request, response) => {
      calls++;
      response.end("{}");
    });
    await expect(nativeLabRead("ship" as never)).rejects.toThrow("Unsupported native read");
    expect(calls).toBe(0);
  });
});

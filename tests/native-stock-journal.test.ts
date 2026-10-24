import { describe, expect, test } from "bun:test";
import {
  stockJournalKey,
  readStockCommand,
  writeStockCommand,
  clearStockCommand,
  type StockCommand,
} from "../src/lib/native-stock-journal";

const value: StockCommand = {
  operation: "stock_transfer",
  id: "intent-1",
  payload: {
    item: "SYNTHETIC-SKU",
    source: "SYNTHETIC-A",
    target: "SYNTHETIC-B",
    qty: 2,
    reason: "Test",
  },
};
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
describe("pending native command intent; no stock ledger or execution claim", () => {
  test("restores the exact request identity and body after component state is lost", () => {
    const s = storage();
    const key = stockJournalKey("http://127.0.0.1:18080", "actor-a");
    writeStockCommand(s, key, value);
    expect(JSON.stringify(readStockCommand(s, key))).toBe(JSON.stringify(value));
    expect(() => writeStockCommand(s, key, { ...value, id: "intent-2" })).toThrow("Unresolved");
    writeStockCommand(s, key, JSON.parse(JSON.stringify(value)));
    clearStockCommand(s, key, value);
    expect(readStockCommand(s, key)).toBeNull();
    writeStockCommand(s, key, { ...value, id: "intent-2" });
  });
  test("another actor or native endpoint cannot load the same intent", () => {
    const s = storage();
    const key = stockJournalKey("http://127.0.0.1:18080", "actor-a");
    writeStockCommand(s, key, value);
    expect(readStockCommand(s, stockJournalKey("http://127.0.0.1:18080", "actor-b"))).toBeNull();
    expect(readStockCommand(s, stockJournalKey("http://127.0.0.1:19080", "actor-a"))).toBeNull();
  });
  test("rejects a corrupt or unexpected journal instead of clearing it", () => {
    const s = storage();
    for (const raw of [
      "{",
      "[]",
      '{"operation":"stock_transfer"}',
      JSON.stringify({ ...value, secret: "forbidden-extra" }),
    ]) {
      s.setItem("key", raw);
      expect(() => readStockCommand(s, "key")).toThrow();
      expect(s.getItem("key")).toBe(raw);
    }
  });
  test("rejects an unretained write and a changed intent at acknowledgement", () => {
    const s = storage();
    expect(() => writeStockCommand({ ...s, setItem: () => {} }, "key", value)).toThrow(
      "not retained",
    );
    writeStockCommand(s, "key", value);
    expect(() => clearStockCommand(s, "key", { ...value, id: "other" })).toThrow("changed");
    expect(readStockCommand(s, "key")).toEqual(value);
  });
  test("a denied storage operation fails before the caller can dispatch", () => {
    const s = storage();
    expect(() =>
      writeStockCommand(
        {
          ...s,
          setItem: () => {
            throw new Error("quota");
          },
        },
        "key",
        value,
      ),
    ).toThrow("quota");
  });
});

import type { StockOperation } from "./native-stock-operations";

export type StockCommand = {
  operation: StockOperation;
  payload: Record<string, unknown>;
  id: string;
};
type JournalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Command intent only, never a balance, credential or proof of native execution. */
export function stockJournalKey(endpoint: string, actor: string) {
  if (!endpoint || !actor) throw new Error("Verified native identity required");
  return `surooh:stock-intent:v1:${JSON.stringify([endpoint, "TEST-A", actor])}`;
}

function validate(value: unknown): asserts value is StockCommand {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid pending stock command");
  const command = value as StockCommand;
  if (
    !["location_create", "stock_transfer", "stock_count"].includes(command.operation) ||
    typeof command.id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(command.id) ||
    !command.payload ||
    typeof command.payload !== "object" ||
    Array.isArray(command.payload) ||
    Object.keys(command).sort().join(",") !== "id,operation,payload"
  )
    throw new Error("Invalid pending stock command");
}

export function readStockCommand(storage: JournalStorage, key: string): StockCommand | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  if (raw.length > 64_000) throw new Error("Pending stock command too large");
  const value: unknown = JSON.parse(raw);
  validate(value);
  return value;
}

/** Persist before dispatch. Storage rejection must leave the operation unsent. */
export function writeStockCommand(storage: JournalStorage, key: string, value: StockCommand) {
  validate(value);
  const raw = JSON.stringify(value);
  if (raw.length > 64_000) throw new Error("Pending stock command too large");
  // Do not replace a different unresolved intent, including a second component instance.
  const old = storage.getItem(key);
  if (old !== null && old !== raw) throw new Error("Unresolved stock command already exists");
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error("Pending stock command was not retained");
}

export function clearStockCommand(storage: JournalStorage, key: string, value: StockCommand) {
  if (storage.getItem(key) !== JSON.stringify(value))
    throw new Error("Pending stock command changed; reload before continuing");
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error("Pending stock command could not be cleared");
}

/** Explicit in-memory synthetic session only; never falls back after a native failure. */
type NativeLabConfig = {
  syntheticOnly: true;
  url: string;
  token: () => string;
  company: "TEST-A";
  commandTimeoutMs?: number;
};
let config: NativeLabConfig | undefined;
const pending = new Map<
  string,
  { body: string; controller: AbortController; result: Promise<Record<string, unknown>> }
>();

export function configureNativeLab(value: NativeLabConfig | undefined) {
  if (value) {
    const url = new URL(value.url);
    if (
      value.syntheticOnly !== true ||
      value.company !== "TEST-A" ||
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("Only explicit loopback synthetic native sessions are allowed");
    if (
      value.commandTimeoutMs !== undefined &&
      (!Number.isInteger(value.commandTimeoutMs) ||
        value.commandTimeoutMs < 1 ||
        value.commandTimeoutMs > 60_000)
    )
      throw new Error("Invalid native command timeout");
  }
  for (const command of pending.values()) command.controller.abort();
  pending.clear();
  config = value ? { ...value } : undefined;
}

export function nativeLabConfigured() {
  return config !== undefined;
}

export async function nativeLabCommand(
  operation: string,
  payload: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown>> {
  if (!config) throw new Error("Native lab is disabled");
  const session = config;
  const body = JSON.stringify({
    envelope: {
      company: session.company,
      source: "lab-manual",
      request_id: requestId,
      operation,
      payload,
    },
  });
  const existing = pending.get(requestId);
  if (existing) {
    if (existing.body !== body)
      throw new Error("Native command already pending with different payload");
    return existing.result;
  }
  const controller = new AbortController();
  const entry = {
    body,
    controller,
    result: Promise.resolve({}) as Promise<Record<string, unknown>>,
  };
  entry.result = Promise.resolve().then(async () => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, session.commandTimeoutMs ?? 15_000);
    try {
      if (config !== session) throw new Error("Native session changed; reload current data");
      const response = await fetch(
        `${session.url.replace(/\/$/, "")}/api/method/surooh_accounting.native_lab.api.command`,
        {
          method: "POST",
          signal: controller.signal,
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            "X-Frappe-Site-Name": "wms-native-a.invalid",
            "X-Surooh-Synthetic-JWT": session.token(),
          },
          body,
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Native boundary rejected request: ${response.status}`);
      }
      const result = (await response.json()) as { message?: unknown };
      if (!result.message || typeof result.message !== "object" || Array.isArray(result.message))
        throw new Error("Missing native command result");
      if (config !== session) throw new Error("Native session changed; reload current data");
      return result.message as Record<string, unknown>;
    } catch (error) {
      if (config !== session) throw new Error("Native session changed; reload current data");
      if (timedOut)
        throw new Error(
          "انتهت مهلة الاتصال. قد تكون العملية نُفذت؛ أعد المحاولة بنفس الإجراء للتحقق.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
      if (pending.get(requestId) === entry) pending.delete(requestId);
    }
  });
  pending.set(requestId, entry);
  return entry.result;
}

declare global {
  interface Window {
    __SUROOH_NATIVE_SESSION__?: { url: string; token: string };
  }
}
if (
  typeof window !== "undefined" &&
  import.meta.env["VITE_SUROOH_NATIVE_LAB"] === "true" &&
  window.location.hostname === "127.0.0.1"
) {
  const session = window.__SUROOH_NATIVE_SESSION__;
  if (session)
    configureNativeLab({
      syntheticOnly: true,
      url: session.url,
      company: "TEST-A",
      token: () => session.token,
    });
}

/** One full-order command identity per native UI action, retry-safe across reloads. */
export function nativeOrderAction(
  operation: string,
  orderId: string,
  deliveryNote?: string | null,
) {
  if (!["pick", "pack", "ship", "cancel", "return"].includes(operation))
    throw new Error("Unsupported native order action");
  if (operation === "return" && !deliveryNote)
    throw new Error("Native return requires its submitted delivery note");
  return nativeLabCommand(
    operation,
    operation === "return" ? { delivery_note: deliveryNote } : { order_id: orderId },
    `ui:${operation}:${orderId}`,
  );
}

/** Explicit in-memory synthetic session only; never falls back after a native failure. */
type NativeLabConfig = {
  syntheticOnly: true;
  url: string;
  token: () => string;
  company: "TEST-A";
};
let config: NativeLabConfig | undefined;

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
      url.pathname !== "/"
    )
      throw new Error("Only explicit loopback synthetic native sessions are allowed");
  }
  config = value;
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
  const response = await fetch(
    `${config.url.replace(/\/$/, "")}/api/method/surooh_accounting.native_lab.api.command`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-Site-Name": "wms-native-a.invalid",
        "X-Surooh-Synthetic-JWT": config.token(),
      },
      body: JSON.stringify({
        envelope: {
          company: config.company,
          source: "lab-manual",
          request_id: requestId,
          operation,
          payload,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Native boundary rejected request: ${response.status}`);
  const body = (await response.json()) as { message?: Record<string, unknown> };
  if (!body.message) throw new Error("Missing native command result");
  return body.message;
}

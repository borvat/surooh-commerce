/** Test harness mechanics only; these helpers never simulate native acceptance. */
export async function waitForReady({
  probe,
  checkProcess = () => {},
  now = () => performance.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 30000,
  intervalMs = 500,
}) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    checkProcess();
    let ready = false;
    try {
      ready = await probe(Math.min(1000, deadline - now()));
    } catch {
      // Connection errors and non-ready HTTP responses share the same backoff.
    }
    checkProcess();
    if (ready && now() < deadline) return;
    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(intervalMs, remaining));
  }
  throw new Error("Owned UI server did not become ready; B01 NOT RUN");
}

export function noVisibleErrors() {
  return [...document.querySelectorAll('[data-sonner-toast][data-type="error"]')].every(
    (toast) =>
      toast.getClientRects().length === 0 ||
      toast.getAttribute("data-visible") === "false" ||
      getComputedStyle(toast).visibility === "hidden" ||
      getComputedStyle(toast).opacity === "0",
  );
}

// Functions are serializable for Playwright evaluate/waitForFunction and tested
// independently with synthetic DOM records, without launching a browser.
export function markExistingToasts(boundary) {
  for (const toast of document.querySelectorAll("[data-sonner-toast]")) {
    toast.setAttribute("data-surooh-error-boundary", boundary);
  }
}

export function hasFreshError({ boundary, message }) {
  return [...document.querySelectorAll('[data-sonner-toast][data-type="error"]')].some(
    (toast) =>
      toast.getAttribute("data-surooh-error-boundary") !== boundary &&
      toast.getAttribute("data-visible") !== "false" &&
      toast.getClientRects().length > 0 &&
      getComputedStyle(toast).visibility !== "hidden" &&
      getComputedStyle(toast).opacity !== "0" &&
      toast.querySelector("[data-title]")?.textContent?.trim() === message,
  );
}

export async function beginErrorObservation(page, operation, orderId) {
  // Drain old errors before starting the operation, then mark even hidden nodes.
  // They cannot satisfy the next assertion if they reappear with identical text.
  await page.waitForFunction(noVisibleErrors);
  const boundary = `${operation}:${orderId}:${crypto.randomUUID()}`;
  await page.evaluate(markExistingToasts, boundary);
  return boundary;
}

export async function requireFreshError(page, boundary, message) {
  await page.waitForFunction(hasFreshError, { boundary, message });
}

export function isOrderRequest(request, operation, orderId) {
  if (!request.url().endsWith("/api/method/surooh_accounting.native_lab.api.command")) return false;
  try {
    const envelope = request.postDataJSON()?.envelope;
    return (
      envelope?.operation === operation &&
      envelope.payload?.order_id === orderId &&
      envelope.request_id === `ui:${operation}:${orderId}`
    );
  } catch {
    return false;
  }
}

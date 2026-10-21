/** Official shipping-label metadata validation.
 * Never infer a label exists from a URL supplied by the browser.
 * Authentication and provider document ownership MUST be checked by a trusted server.
 */
export type ShippingLabelMetadata = {
  organizationId: string;
  channelId: string;
  externalOrderId: string;
  shipmentId: string;
  carrier: string;
  documentId: string;
  mediaType: "application/pdf" | "image/png";
  source: "bol" | "carrier";
};
export type AuthorizedShipmentScope = {
  organizationId: string;
  channelId: string;
  externalOrderId: string;
  shipmentId: string;
};
export function isLabelForShipment(
  label: ShippingLabelMetadata | null,
  scope: AuthorizedShipmentScope,
): boolean {
  if (!label) return false;
  const keys = ["organizationId", "channelId", "externalOrderId", "shipmentId"] as const;
  if (!keys.every((k) => Boolean(label[k]) && label[k] === scope[k])) return false;
  if (!label.documentId.trim() || !label.carrier.trim()) return false;
  if (label.source !== "bol" && label.source !== "carrier") return false;
  return label.mediaType === "application/pdf" || label.mediaType === "image/png";
}

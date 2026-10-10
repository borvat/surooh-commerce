import { describe, expect, test } from "bun:test";
import { isLabelForShipment, type ShippingLabelMetadata } from "../src/lib/shipping-label-contract";
const label: ShippingLabelMetadata = {
  organizationId: "org-A", channelId: "account-A", externalOrderId: "order-42",
  shipmentId: "shipment-1", carrier: "DHL", documentId: "provider-document-1",
  mediaType: "application/pdf", source: "bol"
};
const scope = { organizationId: "org-A", channelId: "account-A", externalOrderId: "order-42", shipmentId: "shipment-1" };
describe("carrier document boundary", () => {
  test("accepts only matching shipment metadata", () => expect(isLabelForShipment(label, scope)).toBe(true));
  test("rejects labels from another seller account", () => expect(isLabelForShipment(label, { ...scope, channelId: "account-B" })).toBe(false));
  test("rejects other organization, order, and shipment", () => {
    expect(isLabelForShipment(label, { ...scope, organizationId: "org-B" })).toBe(false);
    expect(isLabelForShipment(label, { ...scope, externalOrderId: "order-43" })).toBe(false);
    expect(isLabelForShipment(label, { ...scope, shipmentId: "shipment-2" })).toBe(false);
  });
  test("does not infer label from missing metadata", () => {
    expect(isLabelForShipment(null, scope)).toBe(false);
    expect(isLabelForShipment({ ...label, documentId: "" }, scope)).toBe(false);
  });
});

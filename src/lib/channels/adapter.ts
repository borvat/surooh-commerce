/**
 * Channel adapter contract. v1 ships only the interface; a bol.com adapter
 * will implement it later without touching the inventory engine.
 *
 * Flow for a future integration:
 *  - pushStock: read v_product_availability (derived) and push per listing.
 *  - pullOrders: map external orders to place_order() with _channel_id + _external_ref
 *    (unique per channel, so re-imports are idempotent).
 *  - Shipment/cancel events map to fulfill_order() / cancel_order().
 */
export interface ExternalOrder {
  externalRef: string;
  lines: { ean: string; quantity: number }[];
}

export interface ChannelAdapter {
  provider: "manual" | "bol";
  testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message?: string }>;
  pushStock(updates: { externalOfferId: string; ean: string; quantity: number }[]): Promise<void>;
  pullOrders(since: Date): Promise<ExternalOrder[]>;
}

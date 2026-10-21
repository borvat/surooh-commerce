import { describe, expect, test } from "bun:test";
import { validateWarehouseCommand } from "../src/lib/warehouse-command-contract";
const trusted = {
  organizationId: "org-1",
  channelId: "bol-1",
  actorUserId: "user-1",
  role: "warehouse" as const,
};
const command = {
  orderId: "12345678-1234-1234-1234-123456789012",
  kind: "PICKING_STARTED" as const,
  operationKey: "pick:bol-1:order-1",
};
describe("warehouse command validation", () => {
  test("uses trusted scope and records actor", () => {
    const r = validateWarehouseCommand(command, trusted);
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.record.actor_user_id).toBe("user-1");
  });
  test("viewer cannot create event", () => {
    expect(validateWarehouseCommand(command, { ...trusted, role: "viewer" }).allowed).toBe(false);
  });
  test("rejects missing authority or operation identity", () => {
    expect(validateWarehouseCommand(command, { ...trusted, organizationId: "" }).allowed).toBe(
      false,
    );
    expect(validateWarehouseCommand({ ...command, operationKey: "short" }, trusted).allowed).toBe(
      false,
    );
  });
  test("never self-asserts label verification or handoff", () => {
    expect(
      validateWarehouseCommand({ ...command, kind: "CARRIER_LABEL_VERIFIED" }, trusted).allowed,
    ).toBe(false);
    expect(
      validateWarehouseCommand({ ...command, kind: "HANDOFF_RECORDED" }, trusted).allowed,
    ).toBe(false);
  });
});

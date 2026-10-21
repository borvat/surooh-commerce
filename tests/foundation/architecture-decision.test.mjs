import test from "node:test";
import assert from "node:assert/strict";
import { applyArchitectureGate } from "../../scripts/wms/phase-gate.mjs";
const ready = { errors: [], status: "READY_FOR_HUMAN_REVIEW" };
const accepted = {
  status: "accepted",
  accepted_sha: "a".repeat(40),
  owner_acceptance_ref: "owner-review-reference",
  gates: { G1: "passed", G2: "passed", G3: "passed", G4: "passed" },
};
test("missing or proposed ADR blocks otherwise complete phase evidence", () => {
  for (const decision of [
    undefined,
    { ...accepted, status: "proposed" },
    { ...accepted, owner_acceptance_ref: null },
  ])
    assert.equal(applyArchitectureGate(ready, decision).status, "BLOCKED");
});
test("a skipped mandatory architecture experiment cannot pass", () => {
  assert.equal(
    applyArchitectureGate(ready, { ...accepted, gates: { ...accepted.gates, G1: "skipped" } })
      .status,
    "BLOCKED",
  );
});
test("accepted architecture never authorizes execution or clears phase defects", () => {
  const result = applyArchitectureGate(ready, accepted);
  assert.equal(result.status, "READY_FOR_HUMAN_REVIEW");
  assert.equal(result.execution_authorized, false);
  assert.equal(result.automatic_merge, false);
  assert.equal(result.automatic_deploy, false);
  assert.equal(applyArchitectureGate({ errors: ["missing rollback"] }, accepted).status, "BLOCKED");
});

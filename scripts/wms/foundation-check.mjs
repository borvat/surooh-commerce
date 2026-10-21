import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const text = (p) => readFileSync(resolve(root, p), "utf8");
const catalog = JSON.parse(text("docs/wms/phases.json"));
assert.equal(catalog.execution_authorized, false, "Codex execution must remain held");
assert.equal(catalog.active_phase, null);
assert.equal(catalog.automatic_merge, false);
assert.equal(catalog.automatic_deploy, false);
assert.equal(catalog.architecture_decision.status, "proposed");
assert.equal(catalog.architecture_decision.owner_acceptance_ref, null);
assert.equal(catalog.phases[0].status, "blocked_architecture_decision");
assert(existsSync(resolve(root, catalog.architecture_decision.spec)));
const seen = new Set();
for (const phase of catalog.phases) {
  assert(!seen.has(phase.id), "Duplicate phase");
  for (const dep of phase.dependencies) assert(seen.has(dep), "Dependency must precede phase");
  assert(phase.checks.length >= 5 && new Set(phase.checks).size === phase.checks.length);
  assert(existsSync(resolve(root, phase.spec)));
  const spec = text(phase.spec);
  for (const heading of [
    "Goal",
    "Requirements",
    "Affected modules",
    "Dependencies",
    "Acceptance",
    "Risks",
    "Task packet",
  ])
    assert(spec.includes("## " + heading), `${phase.id} missing ${heading}`);
  seen.add(phase.id);
}
assert.equal(seen.size, 9);
for (const path of [
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/wms-phase.yml",
  "docs/wms/SECURITY.md",
  "docs/wms/INTEGRATIONS.md",
  "docs/wms/acceptance/SCENARIOS.md",
])
  assert(existsSync(resolve(root, path)));
for (const file of readdirSync(resolve(root, ".github/workflows")).filter((f) =>
  f.endsWith(".yml"),
)) {
  const workflow = text(".github/workflows/" + file);
  assert(!workflow.includes("pull_request_target:"), "No privileged untrusted PR execution");
  assert(!workflow.includes("secrets."), "No live credentials in foundation workflows");
  assert(!/contents:\s*write/.test(workflow), "CI contents permissions must be read-only");
  assert(
    !/\b(?:gh pr merge|git push|codex exec|supabase db push|render deploy)\b/.test(workflow),
    "No launch/merge/deploy command",
  );
}
console.log(
  "PASS: 9 phase packets, ordered dependencies, held execution, documentation/templates and workflow guardrails.",
);

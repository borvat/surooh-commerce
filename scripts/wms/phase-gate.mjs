import { readFileSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
export function evaluateEvidence(phase, record, head, evidenceRoot) {
  const errors = [];
  if (!phase || !record || typeof record !== "object")
    return {
      status: "BLOCKED",
      errors: ["Unknown phase or invalid record"],
      execution_authorized: false,
    };
  if (record.phase !== phase.id) errors.push("Phase mismatch");
  if (!sha(record.commit_sha) || record.commit_sha !== head)
    errors.push("Tested commit is stale or invalid");
  if (!sha(record.baseline_sha)) errors.push("Reviewed baseline SHA required");
  if (record.environment !== "isolated-synthetic" || record.production_connections !== 0)
    errors.push("Isolation evidence required");
  const checks = Array.isArray(record.checks) ? record.checks : [];
  if (new Set(checks.map((c) => c.id)).size !== checks.length) errors.push("Duplicate check IDs");
  const artifacts = Array.isArray(record.artifacts) ? record.artifacts : [];
  const validArtifacts = new Set();
  let root;
  try {
    root = realpathSync(evidenceRoot);
  } catch {
    errors.push("Evidence directory missing");
  }
  for (const a of artifacts) {
    try {
      if (!root || typeof a.path !== "string" || isAbsolute(a.path)) throw new Error();
      const path = realpathSync(resolve(root, a.path));
      const rel = relative(root, path);
      if (rel.startsWith("..") || isAbsolute(rel)) throw new Error();
      const bytes = readFileSync(path);
      if (
        !bytes.length ||
        !/^[0-9a-f]{64}$/.test(a.sha256) ||
        createHash("sha256").update(bytes).digest("hex") !== a.sha256
      )
        throw new Error();
      validArtifacts.add(a.path);
    } catch {
      errors.push(`Missing, unsafe or mismatched artifact: ${a.path}`);
    }
  }
  for (const id of phase.checks) {
    const c = checks.find((c) => c.id === id);
    if (
      !c ||
      c.result !== "passed" ||
      c.exit_code !== 0 ||
      typeof c.command !== "string" ||
      !c.command.trim() ||
      !validArtifacts.has(c.artifact)
    )
      errors.push(`Required check lacks passing evidence: ${id}`);
  }
  const deps = Array.isArray(record.dependencies) ? record.dependencies : [];
  for (const id of phase.dependencies) {
    const d = deps.find((d) => d.phase === id);
    if (
      !d ||
      !sha(d.accepted_sha) ||
      typeof d.owner_acceptance_ref !== "string" ||
      !d.owner_acceptance_ref.trim()
    )
      errors.push(`Unaccepted dependency: ${id}`);
  }
  if (!Array.isArray(record.blockers)) errors.push("Blocker register missing");
  else if (
    record.blockers.some(
      (b) => b.status !== "resolved" && (b.severity === "P0" || b.severity === "P1"),
    )
  )
    errors.push("Unresolved P0/P1 blocker");
  if (!validArtifacts.has(record.rollback_artifact)) errors.push("Rollback evidence required");
  return {
    phase: phase.id,
    commit_sha: record.commit_sha,
    status: errors.length ? "BLOCKED" : "READY_FOR_HUMAN_REVIEW",
    errors,
    execution_authorized: false,
    automatic_merge: false,
    automatic_deploy: false,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [id, path] = process.argv.slice(2);
    if (!id || !path)
      throw new Error("Usage: node scripts/wms/phase-gate.mjs P01 evidence/record.json");
    const catalog = JSON.parse(
      readFileSync(new URL("../../docs/wms/phases.json", import.meta.url), "utf8"),
    );
    const record = JSON.parse(readFileSync(path, "utf8"));
    const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    const result = evaluateEvidence(
      catalog.phases.find((p) => p.id === id),
      record,
      head,
      dirname(resolve(path)),
    );
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "BLOCKED" ? 2 : 0;
  } catch (e) {
    console.error(`BLOCKED: ${e.message}`);
    process.exitCode = 2;
  }
}

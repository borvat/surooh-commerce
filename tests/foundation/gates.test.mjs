import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { assertDisposableDatabase } from "../../scripts/wms/environment-guard.mjs";
import { evaluateEvidence } from "../../scripts/wms/phase-gate.mjs";
const env = (url) => ({ WMS_TEST_ISOLATED: "true", WMS_TEST_DATABASE_URL: url });
test("database guard accepts dedicated loopback fixture only", () => {
  assert.equal(
    assertDisposableDatabase(env("postgresql://test:test@127.0.0.1:5432/wms_test_case")).database,
    "wms_test_case",
  );
});
for (const url of [
  "postgresql://x:y@production.supabase.co/wms_test_ci",
  "postgresql://x:y@127.0.0.1/postgres",
  "postgresql://x:y@localhost/wms_test_ci?host=production",
  "https://localhost/wms_test_ci",
  "postgresql://x:y@127.0.0.1.evil.test/wms_test_ci",
]) {
  test("database guard rejects " + url.replace(/x:y@/, ""), () =>
    assert.throws(() => assertDisposableDatabase(env(url))),
  );
}
test("database guard requires explicit isolation flag", () =>
  assert.throws(() =>
    assertDisposableDatabase({ WMS_TEST_DATABASE_URL: "postgres://localhost/wms_test_ci" }),
  ));
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "wms-evidence-"));
  const bytes = "synthetic command output\n";
  writeFileSync(join(root, "log.txt"), bytes);
  const head = "a".repeat(40),
    phase = { id: "P02", checks: ["tenant-isolation"], dependencies: ["P01"] };
  const record = {
    phase: "P02",
    commit_sha: head,
    baseline_sha: "b".repeat(40),
    environment: "isolated-synthetic",
    production_connections: 0,
    checks: [
      {
        id: "tenant-isolation",
        result: "passed",
        exit_code: 0,
        command: "run real DB tests",
        artifact: "log.txt",
      },
    ],
    artifacts: [{ path: "log.txt", sha256: createHash("sha256").update(bytes).digest("hex") }],
    rollback_artifact: "log.txt",
    dependencies: [
      {
        phase: "P01",
        accepted_sha: "c".repeat(40),
        owner_acceptance_ref: "owner decision verified by reviewer",
      },
    ],
    blockers: [],
  };
  return { root, head, phase, record };
};
function check(name, mutate, expected = "BLOCKED") {
  test(name, () => {
    const f = fixture();
    try {
      mutate(f);
      const result = evaluateEvidence(f.phase, f.record, f.head, f.root);
      assert.equal(result.status, expected);
      assert.equal(result.execution_authorized, false);
      assert.equal(result.automatic_merge, false);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });
}
check("complete packet only recommends human review", () => {}, "READY_FOR_HUMAN_REVIEW");
check("stale head invalidates evidence", (f) => {
  f.head = "d".repeat(40);
});
check("skipped acceptance check blocks", (f) => {
  f.record.checks[0].result = "skipped";
});
check("tampered log digest blocks", (f) => writeFileSync(join(f.root, "log.txt"), "changed"));
check("missing dependency acceptance blocks", (f) => {
  f.record.dependencies = [];
});
check("unresolved inventory P1 blocks", (f) => {
  f.record.blockers = [{ severity: "P1", domain: "inventory", status: "open" }];
});
check("production connection evidence blocks", (f) => {
  f.record.production_connections = 1;
});
check("artifact traversal outside evidence directory blocks", (f) => {
  f.record.artifacts[0].path = "../outside.txt";
});
check("symbolic link to external evidence blocks", (f) => {
  symlinkSync("/etc/hostname", join(f.root, "linked"));
  f.record.artifacts[0].path = "linked";
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const base = {
  PATH: process.env.PATH,
  WMS_TEST_ISOLATED: "true",
  WMS_TEST_DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:15432/wms_test_guard",
};
function blocked(env, argv = []) {
  const r = spawnSync(process.execPath, ["scripts/wms/db-check.mjs", ...argv], {
    env,
    encoding: "utf8",
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /BLOCKED/);
  assert.doesNotMatch(r.stdout, /Ran \d+ tests|D01/);
}
test("explicit isolation flag is mandatory before opening a DB", () =>
  blocked({ ...base, WMS_TEST_ISOLATED: "false" }));
test("non-loopback targets are refused", () =>
  blocked({
    ...base,
    WMS_TEST_DATABASE_URL: "postgresql://fixture:fixture@example.invalid/wms_test_bad",
  }));
test("production database names are refused", () =>
  blocked({ ...base, WMS_TEST_DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1/production" }));
test("DSN query overrides are refused", () =>
  blocked({
    ...base,
    WMS_TEST_DATABASE_URL: base.WMS_TEST_DATABASE_URL + "?host=example.invalid",
  }));
test("missing explicit runtimes cannot yield a DB PASS", () => blocked(base));
test("unknown and relative runtime arguments are refused", () => {
  blocked(base, ["--unknown"]);
  blocked(base, ["--postgres-bin", "relative/runtime"]);
});

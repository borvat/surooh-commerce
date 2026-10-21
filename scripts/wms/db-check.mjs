import { assertDisposableDatabase } from "./environment-guard.mjs";
try {
  assertDisposableDatabase(process.env);
  console.error(
    "BLOCKED P01: real disposable database bootstrap and DB acceptance adapter are not implemented. No database connection opened.",
  );
} catch (e) {
  console.error(`BLOCKED: ${e.message}`);
}
process.exitCode = 2;

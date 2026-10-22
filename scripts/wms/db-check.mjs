import { assertDisposableDatabase } from "./environment-guard.mjs";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

// Bootstrap is delegated only to an explicit local runtime. No .env or production DSN fallback.
try {
  assertDisposableDatabase(process.env);
  const values = {};
  let allowUidCompat = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === "--allow-uid-compat") {
      allowUidCompat = true;
    } else if (["--postgres-bin", "--db-python", "--artifact-dir"].includes(flag)) {
      const value = args[++i];
      if (!value || !isAbsolute(value)) throw new Error(`Absolute ${flag} required`);
      if (values[flag]) throw new Error(`Duplicate ${flag}`);
      values[flag] = value;
    } else {
      throw new Error("Unknown DB adapter argument");
    }
  }
  for (const flag of ["--postgres-bin", "--db-python", "--artifact-dir"]) {
    if (!values[flag]) throw new Error(`Explicit ${flag} required; database not opened`);
  }
  if (!existsSync(values["--postgres-bin"]) || !existsSync(values["--db-python"])) {
    throw new Error("Pinned local PostgreSQL/Python runtime unavailable; database not opened");
  }
  const argv = [
    "verification/postgres/validate.py",
    "--postgres-bin",
    values["--postgres-bin"],
    "--artifact-dir",
    values["--artifact-dir"],
    ...(allowUidCompat ? ["--allow-uid-compat"] : []),
  ];
  const result = spawnSync(values["--db-python"], argv, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (e) {
  console.error(`BLOCKED: ${e.message}`);
  process.exitCode = 2;
}

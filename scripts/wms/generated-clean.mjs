import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Run after the ordinary build: never restore a changed generated file to pass.
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src/routeTree.gen.ts"], {
  stdio: "inherit",
});
const sha256 = createHash("sha256").update(readFileSync("src/routeTree.gen.ts")).digest("hex");
console.log(JSON.stringify({ status: "PASS", generated_file: "src/routeTree.gen.ts", sha256 }));

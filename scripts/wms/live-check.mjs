console.error(
  "BLOCKED: live read-only runner is not implemented or authorized. No provider or production database connection opened.",
);
process.exitCode = 2;

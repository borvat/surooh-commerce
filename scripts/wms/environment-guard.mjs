// Pure guard only. Does not open a connection or load a .env file.
export function assertDisposableDatabase(env) {
  if (env.WMS_TEST_ISOLATED !== "true") throw new Error("Explicit isolated test flag required");
  const value = env.WMS_TEST_DATABASE_URL;
  if (typeof value !== "string" || !value)
    throw new Error("Dedicated WMS_TEST_DATABASE_URL required");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid test database URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("PostgreSQL URL required");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Only loopback test databases allowed");
  if (url.search || url.hash) throw new Error("URL query/fragment override not allowed");
  if (!/^\/wms_test_[a-z0-9_]+$/.test(url.pathname))
    throw new Error("Database name must start with wms_test_");
  return { host: url.hostname, database: url.pathname.slice(1) };
}

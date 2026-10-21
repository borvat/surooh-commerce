import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ts from "typescript";
import { toOrderSearchOptions } from "../src/lib/order-filters";
import { usePermissions } from "../src/lib/auth";

const baseline = { page: 0, status: "all", account: "all", from: "", to: "", reference: "" };
describe("optional server order filters", () => {
  test("omits every absent field rather than emitting undefined", () => {
    expect(toOrderSearchOptions(baseline)).toEqual({ page: 0, status: "all" });
    expect(Object.values(toOrderSearchOptions(baseline))).not.toContain(undefined);
  });
  test("preserves populated filters identically for list and pre-print re-read", () => {
    const input = {
      page: 2,
      status: "placed",
      account: "synthetic-channel",
      from: "2026-10-01",
      to: "2026-10-21",
      reference: " SYNTH-%_ ",
    };
    const expected = {
      page: 2,
      status: "placed",
      accountId: input.account,
      from: input.from,
      to: input.to,
      externalRef: input.reference,
    };
    expect(toOrderSearchOptions(input)).toEqual(expected);
    expect(toOrderSearchOptions({ ...input })).toEqual(expected);
  });
  test("does not silently trim or invent query policy", () => {
    expect(toOrderSearchOptions({ ...baseline, account: "", reference: " " })).toEqual({
      page: 0,
      status: "all",
      accountId: "",
      externalRef: " ",
    });
  });
});

describe("generated authenticated route coverage", () => {
  const tree = readFileSync(new URL("../src/routeTree.gen.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("routeTree.gen.ts", tree, ts.ScriptTarget.Latest, true);
  const imports = ast.statements
    .filter(ts.isImportDeclaration)
    .map((n) => (ts.isStringLiteral(n.moduleSpecifier) ? n.moduleSpecifier.text : ""));
  test("registers assistant and stock review under the authenticated parent", () => {
    for (const name of ["assistant", "stockitup-review"]) {
      expect(imports).toContain(`./routes/_authenticated/${name}`);
      expect(tree).toContain(`'/_authenticated/${name}'`);
    }
    expect(tree).toMatch(
      /const AuthenticatedAssistantRoute[\s\S]*?getParentRoute: \(\) => AuthenticatedRouteRoute/,
    );
    expect(tree).toMatch(
      /const AuthenticatedStockitupReviewRoute[\s\S]*?getParentRoute: \(\) => AuthenticatedRouteRoute/,
    );
  });
  test("covers every current authenticated route file", () => {
    for (const file of readdirSync(
      new URL("../src/routes/_authenticated/", import.meta.url),
    ).filter((f) => f.endsWith(".tsx"))) {
      expect(imports).toContain(`./routes/_authenticated/${file.slice(0, -4)}`);
    }
  });
  test("retains the existing authentication guard and unauthenticated destination", () => {
    const guard = readFileSync(
      new URL("../src/routes/_authenticated/route.tsx", import.meta.url),
      "utf8",
    );
    expect(guard).toMatch(/if \(error \|\| !data.user\) throw redirect\(\{ to: "\/auth" \}\)/);
    expect(tree).toContain("'./routes/auth'");
  });
});

function permissionsFor(role: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["me"], { email: "fixture@example.invalid", id: "fixture-user", role });
  let result: ReturnType<typeof usePermissions> | undefined;
  function Probe() {
    result = usePermissions();
    return null;
  }
  renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Probe)));
  client.clear();
  return result!;
}
describe("actual permission hook with synthetic cached identities", () => {
  test("admin and warehouse retain their distinct permissions", () => {
    expect(permissionsFor("admin")).toMatchObject({ isAdmin: true, canOperate: true });
    expect(permissionsFor("warehouse")).toMatchObject({ isAdmin: false, canOperate: true });
  });
  test("viewer cannot operate", () => {
    expect(permissionsFor("viewer")).toMatchObject({ isAdmin: false, canOperate: false });
  });
  test("missing and unknown roles fail closed", () => {
    for (const role of [null, "unrecognized"])
      expect(permissionsFor(role)).toMatchObject({ isAdmin: false, canOperate: false });
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import {
  configureNativeLab,
  nativeLabCommand,
  nativeLabConfigured,
  nativeOrderAction,
} from "../src/lib/native-lab-client";
import { listComponents } from "../src/lib/inventory";

afterEach(() => configureNativeLab(undefined));
describe("bounded native lab guard regressions (not native integration evidence)", () => {
  test("disabled by default", () => expect(nativeLabConfigured()).toBe(false));
  test("non-loopback rejected", () => {
    expect(() =>
      configureNativeLab({
        syntheticOnly: true,
        url: "https://example.invalid/",
        company: "TEST-A",
        token: () => "",
      }),
    ).toThrow();
  });
  test("URL credentials rejected", () => {
    expect(() =>
      configureNativeLab({
        syntheticOnly: true,
        url: "http://user:secret@127.0.0.1/",
        company: "TEST-A",
        token: () => "",
      }),
    ).toThrow();
  });
  test("disabled command does not dispatch", async () => {
    await expect(nativeLabCommand("order", {}, "test")).rejects.toThrow("disabled");
  });
  test("configured native session denies legacy reads/writes at service boundary", async () => {
    configureNativeLab({
      syntheticOnly: true,
      url: "http://127.0.0.1:18080",
      company: "TEST-A",
      token: () => "",
    });
    await expect(listComponents({})).rejects.toThrow("Legacy inventory access disabled");
  });
  test("clearing explicit session leaves default unchanged", () => {
    configureNativeLab({
      syntheticOnly: true,
      url: "http://127.0.0.1:18080",
      company: "TEST-A",
      token: () => "",
    });
    configureNativeLab(undefined);
    expect(nativeLabConfigured()).toBe(false);
  });
});

describe("native UI command guard regressions (no browser or engine claim)", () => {
  test("URL query/hash cannot carry synthetic credentials", () => {
    for (const suffix of ["?token=unsafe", "#token=unsafe"])
      expect(() =>
        configureNativeLab({
          syntheticOnly: true,
          url: `http://127.0.0.1/${suffix}`,
          company: "TEST-A",
          token: () => "",
        }),
      ).toThrow();
  });
  test("unknown native UI action never dispatches", () =>
    expect(() => nativeOrderAction("adjust", "test")).toThrow("Unsupported"));
  test("return requires a submitted native document reference", () =>
    expect(() => nativeOrderAction("return", "test")).toThrow("delivery note"));
});

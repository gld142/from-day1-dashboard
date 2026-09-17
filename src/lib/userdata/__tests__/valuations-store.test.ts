import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetValuationsForTests,
  clearDeclaredValuation,
  getDeclaredValuation,
  hydrateValuations,
  saveDeclaredValuation,
  valuationsSnapshot,
} from "@/lib/userdata/valuations-store";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  __resetValuationsForTests();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) } },
    configurable: true,
    writable: true,
  });
});

describe("valuations-store", () => {
  it("enregistre, relit, arrondit et borne", () => {
    hydrateValuations();
    const e = saveDeclaredValuation("dadju", 123_456_789.6, "  DAF Capitol  ");
    expect(e.value).toBe(123_456_790);
    expect(e.source).toBe("DAF Capitol");
    expect(getDeclaredValuation("dadju")?.value).toBe(123_456_790);
    expect(JSON.parse(valuationsSnapshot()).dadju.source).toBe("DAF Capitol");
    expect(saveDeclaredValuation("kiko", -5, "x").value).toBe(0);
  });

  it("persiste dans localStorage et se réhydrate", () => {
    hydrateValuations();
    saveDeclaredValuation("dadju", 100, "DAF");
    __resetValuationsForTests();
    hydrateValuations();
    expect(getDeclaredValuation("dadju")?.value).toBe(100);
  });

  it("clear retire l'entrée ; un JSON altéré est ignoré", () => {
    hydrateValuations();
    saveDeclaredValuation("dadju", 100, "DAF");
    clearDeclaredValuation("dadju");
    expect(getDeclaredValuation("dadju")).toBeNull();
    mem.set("day1-valuations", '{"dadju":{"version":1,"value":"oops"}}');
    __resetValuationsForTests();
    hydrateValuations();
    expect(getDeclaredValuation("dadju")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { SACEM_SOURCES, parseAmount, parseSacemState, sacemTotal } from "@/lib/userdata/sacem-store";

describe("répartition SACEM saisie", () => {
  it("le total additionne les sources", () => {
    const bySource = Object.fromEntries(SACEM_SOURCES.map((k) => [k, 0])) as Record<(typeof SACEM_SOURCES)[number], number>;
    bySource.tv = 120_000;
    bySource.cinema = 40_500.5;
    bySource.streaming = 3_200;
    expect(sacemTotal({ bySource })).toBeCloseTo(163_700.5);
  });

  it("un montant saisi à la française se lit ; vide vaut 0 ; négatif ou illisible : refusé", () => {
    expect(parseAmount("12 500")).toBe(12500);
    expect(parseAmount("12500,50 €")).toBe(12500.5);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("douze")).toBeNull();
  });

  it("un stockage illisible repart de zéro ; une source négative retombe à 0", () => {
    expect(parseSacemState("{oops").entries).toEqual({});
    const s = parseSacemState(JSON.stringify({ version: 1, entries: { "brice-davoli": { year: 2025, bySource: { tv: 1000, radio: -5 }, at: "x", by: "Finance" } } }));
    expect(s.entries["brice-davoli"].bySource.tv).toBe(1000);
    expect(s.entries["brice-davoli"].bySource.radio).toBe(0);
    expect(s.entries["brice-davoli"].bySource.cinema).toBe(0);
  });
});

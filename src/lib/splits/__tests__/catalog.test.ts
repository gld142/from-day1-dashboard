import { describe, expect, it } from "vitest";
import { catalogRows } from "../catalog";
import type { Split } from "../split";

const A1 = "9693e109-1b8f-4269-ac0c-7e27b0576019";
const A2 = "5cb20277-0ddc-443e-8b4e-745213042be8";
const split = (artist_id: string, title: string, status: Split["status"], isrc: string | null = null): Split => ({
  id: `${artist_id}-${title}`, updated_at: "2026-09-28", artist_id, title, isrc, status, notes: null,
  shares: [{ name: "X", role: "interprète", email: null, master: 100, publishing: 0 }],
});

describe("catalogRows", () => {
  const titles = {
    [A1]: { titles: ["Titre Un", "Titre Deux"], revenue: { "titre un": 80, "titre deux": 20 }, streams: { "titre un": 20_000, "titre deux": 10_000 }, hasRevenue: true, period: { from: "2026-01", to: "2026-06" } },
    [A2]: { titles: ["Été"], revenue: {}, streams: { ete: 5_000 }, hasRevenue: false, period: { from: "2026-01", to: "2026-03" } },
  };
  const rows = catalogRows({
    artists: [{ id: A1, name: "Alpha" }, { id: A2, name: "Beta" }],
    titles,
    splits: [split(A1, "titre un", "agreed", "FRZ032600001"), split(A2, "ETE", "draft")],
  });

  it("une ligne par titre de relevé, les plus rémunérateurs d'abord (puis les plus écoutés)", () => {
    expect(rows.map((r) => r.title)).toEqual(["Titre Un", "Titre Deux", "Été"]);
  });
  it("revenus, streams, € pour 1 000 et part dans les revenus de l'artiste", () => {
    expect(rows[0]).toMatchObject({ artistName: "Alpha", streams: 20_000, revenue: 80, per1000: 4, artistShare: 0.8 });
  });
  it("relevé sans revenus par titre : inconnus (null), pas 0", () => {
    expect(rows[2]).toMatchObject({ revenue: null, per1000: null, artistShare: null, streams: 5_000 });
  });
  it("état du split rapproché par titre (casse, accents) et ISRC repris du split", () => {
    expect(rows.map((r) => r.split)).toEqual(["agreed", "none", "draft"]);
    expect(rows[0].isrc).toBe("FRZ032600001");
  });
});

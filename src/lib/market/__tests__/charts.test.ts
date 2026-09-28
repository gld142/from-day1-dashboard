import { describe, expect, it } from "vitest";
import { artistMatches, chartMovements, risers, rosterInCharts, splitArtists, type ChartRow } from "../charts";

const row = (position: number, item_id: string, artist_name: string, country = "fr", chart_date = "2026-09-29"): ChartRow => ({
  country, chart_date, position, item_id, title: `T${item_id}`, artist_name, artist_ext_id: null, url: null, genres: [], release_date: null,
});

describe("artistes d'une ligne de classement", () => {
  it("sépare &, feat., ft., virgule, « x » entre espaces, avec", () => {
    expect(splitArtists("Vacra & La Rvfleuze")).toEqual(["vacra", "la rvfleuze"]);
    expect(splitArtists("Tiakola feat. Theodora, Werenoi")).toEqual(["tiakola", "theodora", "werenoi"]);
    expect(splitArtists("Kalash Criminel x Kaaris")).toEqual(["kalash criminel", "kaaris"]);
    expect(splitArtists("Draganov & TIF ft. Jul")).toEqual(["draganov", "tif", "jul"]);
    expect(splitArtists("Axel")).toEqual(["axel"]); // le « x » dans un nom n'est pas un séparateur
  });
  it("reconnaît un artiste du roster, sans casse ni accents, sans confondre les noms proches", () => {
    expect(artistMatches("Vacra & La Rvfleuze", "La Rvfleuze")).toBe(true);
    expect(artistMatches("Tiakola & Theodora", "tiakola")).toBe(true);
    expect(artistMatches("Théodora", "Theodora")).toBe(true);
    expect(artistMatches("Tiakolaa", "Tiakola")).toBe(false);
    expect(artistMatches("Simon & Garfunkel", "Simon & Garfunkel")).toBe(true); // nom qui contient « & »
    expect(artistMatches("Anyone", "")).toBe(false);
  });
});

describe("mouvements d'un jour à l'autre", () => {
  it("nouveau, monte, descend, stable ; « inconnu » sans veille", () => {
    const today = [row(1, "a", "A"), row(2, "b", "B"), row(3, "c", "C"), row(4, "d", "D")];
    const yday = [row(1, "b", "B", "fr", "2026-09-28"), row(3, "a", "A", "fr", "2026-09-28"), row(4, "c", "C", "fr", "2026-09-28"), row(9, "z", "Z", "fr", "2026-09-28")];
    const m = chartMovements(today, yday);
    expect(m.get("a")).toEqual({ kind: "up", by: 2 });
    expect(m.get("b")).toEqual({ kind: "down", by: 1 });
    expect(m.get("c")).toEqual({ kind: "up", by: 1 });
    expect(m.get("d")).toEqual({ kind: "new" });
    expect(chartMovements(today, []).get("a")).toEqual({ kind: "unknown" });
  });
});

describe("roster dans les classements", () => {
  it("chaque artiste du roster avec ses entrées, tous pays, meilleure position d'abord", () => {
    const rows = [row(5, "a", "Tiakola & Theodora", "fr"), row(2, "b", "Tiakola", "ci"), row(40, "c", "Autre", "fr")];
    const r = rosterInCharts(rows, [{ id: "1", name: "Tiakola" }, { id: "2", name: "Absent" }]);
    expect(r).toHaveLength(1);
    expect(r[0].artistId).toBe("1");
    expect(r[0].entries.map((e) => [e.country, e.position])).toEqual([["ci", 2], ["fr", 5]]);
  });
});

describe("artistes qui montent (A&R)", () => {
  it("entrées et plus fortes montées, hors roster, une ligne par artiste principal ; rien sans veille", () => {
    const today = [row(1, "a", "Roster Star"), row(10, "b", "Nouvelle"), row(20, "c", "Grimpeur"), row(30, "d", "Grimpeur feat. X"), row(50, "e", "Stable")];
    const yday = [row(1, "a", "Roster Star", "fr", "2026-09-28"), row(60, "c", "Grimpeur", "fr", "2026-09-28"), row(35, "d", "Grimpeur feat. X", "fr", "2026-09-28"), row(50, "e", "Stable", "fr", "2026-09-28")];
    const r = risers(today, yday, ["Roster Star"], 10);
    expect(r.map((x) => [x.artist, x.kind, x.score])).toEqual([
      ["Nouvelle", "new", 91], // entrée à la 10e place : 101 − 10
      ["Grimpeur", "up", 40], // meilleure des deux lignes : de 60 à 20
    ]);
    expect(risers(today, [], [], 10)).toEqual([]);
  });
});

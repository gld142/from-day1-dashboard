import { describe, expect, it } from "vitest";
import { ARTISTS, DAS } from "@/lib/demo/data";
import { labelTotals, pnlByArtist, rosterDspEstimates, rosterEstimateSummaries, rosterRows } from "@/lib/demo/api";
import { FULL_SCOPE, isFullScope, parseScope, scopeQuery, scopedArtists } from "@/lib/demo/scope";

const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();

describe("scopedArtists", () => {
  it("sans filtre : tout le roster de la maison", () => {
    expect(scopedArtists()).toEqual(ARTISTS);
    expect(scopedArtists(FULL_SCOPE)).toEqual(ARTISTS);
  });
  it("par catégorie", () => {
    expect(ids(scopedArtists({ category: "compositeur" }))).toEqual(["brice-davoli", "gustave-rudman", "zeg-p"]);
    expect(ids(scopedArtists({ category: "variete" }))).toEqual(["louane", "wamen"]);
    expect(scopedArtists({ category: "urbain" })).toHaveLength(6); // day1 : sans Kiko
  });
  it("par DA : les artistes de sa catégorie, et rien d'autre", () => {
    for (const da of DAS) {
      const mine = scopedArtists({ daId: da.id });
      expect(mine.length).toBeGreaterThan(0);
      for (const a of mine) expect(a.daId).toBe(da.id);
    }
  });
  it("catégorie ET DA incompatibles : vide, pas d'erreur", () => {
    expect(scopedArtists({ category: "variete", daId: "da-compos" })).toEqual([]);
  });
});

describe("parseScope / scopeQuery — l'état vit dans l'URL", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("lit ?cat= et ?da= ; une valeur inconnue vaut « tout »", () => {
    expect(parseScope(p("cat=variete&da=da-variete"))).toEqual({ category: "variete", daId: "da-variete" });
    expect(parseScope(p("cat=jazz&da=da-inconnu"))).toEqual({ category: null, daId: null });
    expect(parseScope(p(""))).toEqual(FULL_SCOPE);
  });
  it("aller-retour", () => {
    expect(scopeQuery({ category: "urbain", daId: null })).toBe("?cat=urbain");
    expect(scopeQuery({ category: null, daId: "da-compos" })).toBe("?da=da-compos");
    expect(scopeQuery(FULL_SCOPE)).toBe("");
    expect(parseScope(p(scopeQuery({ category: "compositeur", daId: "da-compos" }).slice(1)))).toEqual({ category: "compositeur", daId: "da-compos" });
    expect(isFullScope(FULL_SCOPE)).toBe(true);
    expect(isFullScope({ category: "urbain", daId: null })).toBe(false);
  });
});

describe("agrégats label sur une liste", () => {
  const compos = scopedArtists({ category: "compositeur" });
  it("rosterRows et labelTotals ne comptent que la liste", () => {
    expect(ids(rosterRows(compos))).toEqual(ids(compos));
    const t = labelTotals(compos);
    expect(t.artists).toBe(3);
    expect(t.revenue12m).toBe(rosterRows(compos).reduce((s, r) => s + r.revenue12m, 0));
  });
  it("pnlByArtist sur la liste = les mêmes lignes que sur tout le roster (même fenêtre de mois)", () => {
    const all = pnlByArtist(12);
    for (const p of pnlByArtist(12, compos)) expect(p).toEqual(all.find((x) => x.artistId === p.artistId));
  });
  it("estimations roster : la somme des parties ≤ le tout, et le défaut vaut tout le roster", () => {
    expect(rosterEstimateSummaries(ARTISTS)).toEqual(rosterEstimateSummaries());
    const whole = rosterEstimateSummaries()["month"].streams;
    const parts = rosterEstimateSummaries(compos)["month"].streams;
    expect(parts).toBeLessThanOrEqual(whole);
    expect(rosterDspEstimates("month", compos).reduce((s, d) => s + d.streams, 0)).toBe(parts);
  });
});

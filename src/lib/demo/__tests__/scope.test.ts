import { describe, expect, it } from "vitest";
import { ARTISTS, DAS } from "@/lib/demo/data";
import { labelTotals, marketRosterTracks, pnlByArtist, rosterDspEstimates, rosterEstimateSummaries, rosterRows, rosterTiktokSignal } from "@/lib/demo/api";
import { FULL_SCOPE, effectiveScope, isFullScope, parseScope, scopeQuery, scopedArtists } from "@/lib/demo/scope";

const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();

describe("scopedArtists", () => {
  it("sans filtre : tout le roster de la maison — une COPIE, jamais la référence (un tri du périmètre ne doit pas réordonner ARTISTS)", () => {
    expect(scopedArtists()).toEqual(ARTISTS);
    expect(scopedArtists(FULL_SCOPE)).toEqual(ARTISTS);
    expect(scopedArtists()).not.toBe(ARTISTS);
    expect(scopedArtists(FULL_SCOPE)).not.toBe(ARTISTS);
  });
  it("par catégorie", () => {
    expect(ids(scopedArtists({ category: "compositeur" }))).toEqual(["brice-davoli", "gustave-rudman", "zeg-p"]);
    expect(ids(scopedArtists({ category: "variete" }))).toEqual(["louane", "wamen"]);
    expect(scopedArtists({ category: "urbain" })).toHaveLength(6); // 6 dans les deux maisons (day1 sans Kiko, universal sans Dadju)
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
  /* La fenêtre de mois complets est calée sur ARTISTS[0] (api.ts) et vaut aujourd'hui pour
     tous les artistes : une seule fenêtre de 12 mois existe (mesuré le 24/10/2026), ce test ne
     peut donc PAS distinguer `ARTISTS[0]` de `artists[0]` — il vérifie seulement que la liste
     ne change ni les lignes ni leur contenu. */
  it("pnlByArtist sur la liste = les mêmes lignes que sur tout le roster (une seule fenêtre de mois aujourd'hui, identique pour tous)", () => {
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

/* Mesuré le 24/10/2026 sous le DA Sofia K. : `rosterTiktokSignal()` disait 457 720 vidéos (tout
   le roster) contre 27 800 pour ses trois artistes, et `marketRosterTracks()` comptait les titres
   de tout le roster. Les deux agrégats prennent désormais la liste du périmètre. */
describe("agrégats TikTok et marché au périmètre", () => {
  const compos = scopedArtists({ category: "compositeur" });
  it("rosterTiktokSignal : le signal des compositeurs est plus petit que celui du roster, et le défaut vaut tout le roster", () => {
    const whole = rosterTiktokSignal();
    const part = rosterTiktokSignal(compos);
    expect(whole).not.toBeNull();
    expect(part).not.toBeNull();
    expect(part!.videos).toBeLessThan(whole!.videos);
    expect(rosterTiktokSignal(ARTISTS)).toEqual(whole);
    expect(rosterTiktokSignal([])).toBeNull();
  });
  it("marketRosterTracks : zéro titre pour une liste vide, le défaut vaut tout le roster", () => {
    expect(marketRosterTracks(undefined, [])).toBe(0);
    expect(marketRosterTracks(undefined, ARTISTS)).toBe(marketRosterTracks());
    /* Mesuré le 24/10/2026 : 0 titre pour les compositeurs contre 5 pour le roster — strictement moins. */
    expect(marketRosterTracks(undefined, compos)).toBeLessThan(marketRosterTracks());
  });
});

/* Un DA qui clique « Roster » dans la barre latérale arrive sur /roster sans `?da=` et voyait
   les 11 artistes quand Pulse en disait 6 (mesuré le 24/10/2026). Le verrou du rôle prime :
   l'URL ne peut pas l'élargir ; sans verrou, l'URL décide. */
describe("effectiveScope — le verrou du rôle prime sur l'URL", () => {
  it("verrou posé : le `da` de l'URL est ignoré, la catégorie reste", () => {
    expect(effectiveScope({ category: "urbain", daId: null }, "da-compos")).toEqual({ category: "urbain", daId: "da-compos" });
    expect(effectiveScope({ category: null, daId: "da-urbain" }, "da-compos")).toEqual({ category: null, daId: "da-compos" });
    expect(effectiveScope(FULL_SCOPE, "da-variete")).toEqual({ category: null, daId: "da-variete" });
  });
  it("sans verrou : l'URL décide, telle quelle", () => {
    const url = { category: "variete" as const, daId: "da-urbain" };
    expect(effectiveScope(url, null)).toEqual(url);
    expect(effectiveScope(FULL_SCOPE, null)).toEqual(FULL_SCOPE);
  });
});

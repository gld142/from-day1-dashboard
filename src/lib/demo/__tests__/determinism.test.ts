/**
 * Filet de sécurité n°1 : le moteur de démo est STRICTEMENT déterministe.
 * Serveur et client doivent produire les mêmes chiffres (hydration),
 * et deux rendus successifs doivent être identiques au bit près.
 */
import { describe, expect, it } from "vitest";
import { ALL_ARTISTS, ARTISTS, PROJECT_SEEDS, TRACKS } from "@/lib/demo/data";
import {
  dailyTotals,
  expensesFor,
  revenueSeries,
  streamSeries,
} from "@/lib/demo/generators";
import { hasRealData, realDailyEstimates, realStreamSeries } from "@/lib/real";

/* Les générateurs et la couche réelle ne dépendent pas de la maison : on les éprouve sur le
   roster COMPLET, pour qu'un artiste exclu (Kiko chez day1, Dadju chez Universal) ne sorte
   pas de la couverture en silence — mesuré le 24/10/2026 : Kiko avait disparu des listes. */
const ARTIST_IDS = ALL_ARTISTS.map((a) => a.id);
/* La couche réelle ne répond que pour un artiste qui a un relevé (sinon elle lève, et
   api.ts retombe sur les générateurs). Le test de couverture, plus bas, exige que TOUS en aient un. */
const REAL_IDS = ARTIST_IDS.filter((id) => hasRealData(id));
/* Les titres, eux, sont filtrés par la maison (TRACKS) : on somme les poids des artistes du roster. */
const WITH_TRACKS = ARTISTS.map((a) => a.id).filter((id) => TRACKS.some((t) => t.artistId === id));

describe("couverture : relevés et projets", () => {
  const HISTORICAL = ["dadju", "nono-la-grinta", "november-ultra", "zeg-p", "kiko", "elgrandetoto"];
  const NEW_SIX = ["leto", "dakeez", "louane", "wamen", "gustave-rudman", "brice-davoli"];
  it("les six artistes historiques et les six nouveaux ont tous un relevé (snapshots/<id>/, depuis f075a81)", () => {
    expect([...HISTORICAL, ...NEW_SIX].sort()).toEqual([...ARTIST_IDS].sort());
    for (const id of [...HISTORICAL, ...NEW_SIX]) expect(hasRealData(id), `${id} : aucun relevé`).toBe(true);
    expect(REAL_IDS).toHaveLength(ALL_ARTISTS.length);
  });
  it("chaque artiste du roster qui a des graines de projet a au moins un titre", () => {
    expect(WITH_TRACKS.length).toBeGreaterThan(0);
    for (const [id, seeds] of Object.entries(PROJECT_SEEDS)) expect(seeds.some((s) => s.tracks.length > 0), id).toBe(true);
    for (const a of ARTISTS) if (PROJECT_SEEDS[a.id]) expect(WITH_TRACKS, `${a.id} a des graines mais aucun titre`).toContain(a.id);
  });
});

describe("déterminisme des générateurs", () => {
  it.each(ARTIST_IDS)("streamSeries(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(streamSeries(id))).toBe(JSON.stringify(streamSeries(id)));
  });

  it.each(ARTIST_IDS)("revenueSeries(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(revenueSeries(id))).toBe(
      JSON.stringify(revenueSeries(id)),
    );
  });

  it.each(ARTIST_IDS)("expensesFor(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(expensesFor(id))).toBe(JSON.stringify(expensesFor(id)));
  });

  it.each(ARTIST_IDS)("dailyTotals(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(dailyTotals(id))).toBe(JSON.stringify(dailyTotals(id)));
  });

  it("streamSeries est déterministe aussi sur une fenêtre courte", () => {
    expect(JSON.stringify(streamSeries("dadju", 30))).toBe(
      JSON.stringify(streamSeries("dadju", 30)),
    );
  });
});

describe("poids des tracks", () => {
  it.each(WITH_TRACKS)("les poids de %s somment à ~1", (id) => {
    const sum = TRACKS.filter((t) => t.artistId === id).reduce(
      (s, t) => s + t.weight,
      0,
    );
    expect(sum).toBeCloseTo(1, 9);
  });

  it("aucun poids négatif ou nul", () => {
    for (const t of TRACKS) {
      expect(t.weight).toBeGreaterThan(0);
    }
  });
});

describe("aucun montant négatif", () => {
  it.each(ARTIST_IDS)("streams de %s ≥ 0", (id) => {
    for (const p of streamSeries(id)) {
      expect(p.streams).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(ARTIST_IDS)("revenus de %s ≥ 0", (id) => {
    for (const p of revenueSeries(id)) {
      expect(p.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(ARTIST_IDS)("dépenses de %s > 0", (id) => {
    for (const e of expensesFor(id)) {
      expect(e.amount).toBeGreaterThan(0);
    }
  });

  it.each(ARTIST_IDS)("totaux quotidiens de %s ≥ 0", (id) => {
    for (const d of dailyTotals(id)) {
      expect(d.streams).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("déterminisme de la couche réelle", () => {
  it.each(REAL_IDS)("realStreamSeries(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(realStreamSeries(id, 90))).toBe(JSON.stringify(realStreamSeries(id, 90)));
  });
  it.each(REAL_IDS)("realDailyEstimates(%s) : deux appels identiques", (id) => {
    expect(JSON.stringify(realDailyEstimates(id, 30))).toBe(JSON.stringify(realDailyEstimates(id, 30)));
  });
});

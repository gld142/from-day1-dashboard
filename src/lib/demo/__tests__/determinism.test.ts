/**
 * Filet de sécurité n°1 : le moteur de démo est STRICTEMENT déterministe.
 * Serveur et client doivent produire les mêmes chiffres (hydration),
 * et deux rendus successifs doivent être identiques au bit près.
 */
import { describe, expect, it } from "vitest";
import { ARTISTS, TRACKS } from "@/lib/demo/data";
import {
  dailyTotals,
  expensesFor,
  revenueSeries,
  streamSeries,
} from "@/lib/demo/generators";
import { hasRealData, realDailyEstimates, realStreamSeries } from "@/lib/real";

const ARTIST_IDS = ARTISTS.map((a) => a.id);
/* La couche réelle ne répond que pour un artiste qui a un relevé (sinon elle lève, et
   api.ts retombe sur les générateurs). Les artistes arrivés au roster avant leur premier
   relevé n'y figurent qu'à partir de celui-ci : le filtre les inclut dès qu'il existe. */
const REAL_IDS = ARTIST_IDS.filter((id) => hasRealData(id));
/* Idem pour les titres : un artiste sans projet dans PROJECT_SEEDS n'a pas de poids à sommer. */
const WITH_TRACKS = ARTIST_IDS.filter((id) => TRACKS.some((t) => t.artistId === id));

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

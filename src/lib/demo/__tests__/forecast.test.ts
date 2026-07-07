/**
 * Filet de sécurité n°3 : le Revenue Calculator (prévision 12 mois).
 * Horizon respecté, bande de confiance ordonnée, scénario de croissance
 * monotone, historique jamais altéré par le scénario.
 */
import { describe, expect, it } from "vitest";
import { ARTISTS, monthlyRevenueTotals, revenueForecast } from "@/lib/demo/api";

const ARTIST_IDS = ARTISTS.map((a) => a.id);

describe("revenueForecast — structure", () => {
  it.each(ARTIST_IDS)("%s : 12 points projetés par défaut", (id) => {
    const fc = revenueForecast(id);
    const projected = fc.filter((p) => p.projected !== null);
    expect(projected).toHaveLength(12);
  });

  it("respecte un horizon personnalisé", () => {
    const fc = revenueForecast("sky-lune", { horizon: 6 });
    expect(fc.filter((p) => p.projected !== null)).toHaveLength(6);
  });

  it.each(ARTIST_IDS)("%s : 24 mois d'historique en tête de série", (id) => {
    const fc = revenueForecast(id);
    const history = fc.filter((p) => p.actual !== null);
    expect(history).toHaveLength(24);
    // L'historique précède strictement la projection.
    const firstProjected = fc.findIndex((p) => p.projected !== null);
    expect(firstProjected).toBe(24);
  });

  it.each(ARTIST_IDS)("%s : historique = monthlyRevenueTotals", (id) => {
    const fc = revenueForecast(id);
    const history = fc.filter((p) => p.actual !== null);
    const totals = monthlyRevenueTotals(id, 24);
    expect(history.map((p) => ({ month: p.month, amount: p.actual }))).toEqual(
      totals.map((m) => ({ month: m.month, amount: m.amount })),
    );
  });
});

describe("revenueForecast — bande de confiance", () => {
  it.each(ARTIST_IDS)("%s : low ≤ projected ≤ high", (id) => {
    for (const p of revenueForecast(id)) {
      if (p.projected === null) continue;
      expect(p.low).not.toBeNull();
      expect(p.high).not.toBeNull();
      expect(p.low!).toBeLessThanOrEqual(p.projected);
      expect(p.projected).toBeLessThanOrEqual(p.high!);
    }
  });

  it("les points historiques n'ont pas de bande", () => {
    for (const p of revenueForecast("vela")) {
      if (p.actual === null) continue;
      expect(p.projected).toBeNull();
      expect(p.low).toBeNull();
      expect(p.high).toBeNull();
    }
  });
});

describe("revenueForecast — scénarios", () => {
  it.each(ARTIST_IDS)(
    "%s : growthDelta positif ⇒ projection totale plus élevée",
    (id) => {
      const base = revenueForecast(id);
      const boosted = revenueForecast(id, { growthDelta: 0.25 });
      const sum = (fc: ReturnType<typeof revenueForecast>) =>
        fc.reduce((s, p) => s + (p.projected ?? 0), 0);
      expect(sum(boosted)).toBeGreaterThan(sum(base));
    },
  );

  it.each(ARTIST_IDS)("%s : le scénario ne modifie PAS l'historique", (id) => {
    const base = revenueForecast(id).filter((p) => p.actual !== null);
    const boosted = revenueForecast(id, { growthDelta: 0.4 }).filter(
      (p) => p.actual !== null,
    );
    expect(JSON.stringify(boosted)).toBe(JSON.stringify(base));
  });

  it("deux appels identiques donnent la même prévision", () => {
    expect(JSON.stringify(revenueForecast("kayro", { growthDelta: 0.1 }))).toBe(
      JSON.stringify(revenueForecast("kayro", { growthDelta: 0.1 })),
    );
  });
});

/**
 * Filet de sécurité n°4 : valorisation catalogue.
 * Fourchette ordonnée, multiples alignés sur le stade de carrière,
 * arithmétique interne cohérente.
 */
import { describe, expect, it } from "vitest";
import { ARTISTS, catalogValuation, totalRevenue } from "@/lib/demo/api";
import type { CareerStage } from "@/lib/demo/types";

const EXPECTED_MULTIPLES: Record<CareerStage, [number, number]> = {
  established: [14, 18],
  developing: [10, 14],
  emerging: [8, 11],
  // "peak" n'existe pas encore dans le roster de démo ; s'il apparaît,
  // catalogValuation le traite comme "emerging" (branche par défaut).
  peak: [8, 11],
};

describe("catalogValuation", () => {
  it.each(ARTISTS.map((a) => a.id))("%s : low < mid < high", (id) => {
    const v = catalogValuation(id);
    expect(v.low).toBeGreaterThan(0);
    expect(v.low).toBeLessThan(v.mid);
    expect(v.mid).toBeLessThan(v.high);
  });

  it.each(ARTISTS)(
    "$id : multiples cohérents avec careerStage ($careerStage)",
    (artist) => {
      const v = catalogValuation(artist.id);
      const [mLow, mHigh] = EXPECTED_MULTIPLES[artist.careerStage];
      expect(v.multipleLow).toBe(mLow);
      expect(v.multipleHigh).toBe(mHigh);
      expect(v.multipleLow).toBeLessThan(v.multipleHigh);
    },
  );

  it.each(ARTISTS.map((a) => a.id))(
    "%s : low/high = nps × multiples (à l'arrondi près)",
    (id) => {
      const v = catalogValuation(id);
      // nps est arrondi dans la sortie : tolérance = ±(0.5 × multiple + 0.5).
      expect(Math.abs(v.low - v.nps * v.multipleLow)).toBeLessThanOrEqual(
        0.5 * v.multipleLow + 1,
      );
      expect(Math.abs(v.high - v.nps * v.multipleHigh)).toBeLessThanOrEqual(
        0.5 * v.multipleHigh + 1,
      );
    },
  );

  it.each(ARTISTS.map((a) => a.id))("%s : mid = milieu de fourchette", (id) => {
    const v = catalogValuation(id);
    expect(Math.abs(v.mid - (v.low + v.high) / 2)).toBeLessThanOrEqual(1);
  });

  it.each(ARTISTS.map((a) => a.id))(
    "%s : nps = 72 %% du revenu 12 mois",
    (id) => {
      const v = catalogValuation(id);
      expect(v.nps).toBe(Math.round(totalRevenue(id, 12) * 0.72));
    },
  );

  it("est déterministe", () => {
    expect(JSON.stringify(catalogValuation("mira-sol"))).toBe(
      JSON.stringify(catalogValuation("mira-sol")),
    );
  });
});

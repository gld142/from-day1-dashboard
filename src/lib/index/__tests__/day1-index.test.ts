import { describe, expect, it } from "vitest";
import { computeDay1Index, sizeScore, type IndexInput } from "../day1-index";

const TODAY = "2026-09-29";
const months = (values: number[], last = "2026-08") => {
  // values du plus ancien au plus récent, se terminant au mois `last`
  const [y, m] = last.split("-").map(Number);
  const out: Record<string, number> = {};
  values.forEach((v, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (values.length - 1 - i), 1));
    out[d.toISOString().slice(0, 7)] = v;
  });
  return out;
};
const none = { rights: [], shows: [], sync: [] };

describe("échelle de taille (affichée à l'écran)", () => {
  it("10 k streams/mois = 40, 100 k = 60, 1 M = 80, 10 M = 100, bornée", () => {
    expect(sizeScore(10_000)).toBeCloseTo(40);
    expect(sizeScore(100_000)).toBeCloseTo(60);
    expect(sizeScore(1_000_000)).toBeCloseTo(80);
    expect(sizeScore(10_000_000)).toBeCloseTo(100);
    expect(sizeScore(50_000_000)).toBe(100);
    expect(sizeScore(50)).toBe(0);
    expect(sizeScore(0)).toBe(0);
  });
});

describe("Day 1 Index — calcul sur des mesures", () => {
  it("6 mois de relevé + droits et concerts : 4 dimensions sur 5, témoin à la main", () => {
    const input: IndexInput = {
      streamsByMonth: months([100_000, 100_000, 100_000, 110_000, 120_000, 130_000]),
      rights: [{ paid_on: "2026-06-15" }],
      shows: [{ show_date: "2026-05-02" }],
      sync: [],
    };
    const r = computeDay1Index(input, TODAY);
    // Témoin :
    //  taille     = moyenne des 3 derniers mois = 120 000 → 20·log10(120000) − 40 = 61,58
    //  croissance = (110+120+130)/(100+100+100) − 1 = +20 % → 50 + 20 = 70
    //  élan       = 130 / moyenne(100,110,120)=110 − 1 = +18,18 % → 68,18
    //  diversité  = streaming, droits, concerts sur 4 → 75
    //  fidélité   = non mesurée
    const size = 20 * Math.log10(120_000) - 40;
    const momentum = 50 + 100 * (130 / 110 - 1);
    const expected = Math.round((size + 70 + momentum + 75) / 4);
    const d = Object.fromEntries(r.dimensions.map((x) => [x.key, x.score]));
    expect(d.size).toBeCloseTo(size, 5);
    expect(d.growth).toBeCloseTo(70, 5);
    expect(d.momentum).toBeCloseTo(momentum, 5);
    expect(d.diversity).toBe(75);
    expect(d.loyalty).toBeNull();
    expect(r.measured).toBe(4);
    expect(r.score).toBe(expected);
    expect(r.score).toBe(69);
  });

  it("2 mois seulement : ni croissance ni élan (pas inventés), note sur ce qui est mesuré", () => {
    const r = computeDay1Index({ streamsByMonth: months([50_000, 60_000]), ...none }, TODAY);
    const d = Object.fromEntries(r.dimensions.map((x) => [x.key, x]));
    expect(d.growth.score).toBeNull();
    expect(d.growth.missing).toMatch(/6 mois/);
    expect(d.momentum.score).toBeNull();
    expect(d.diversity.score).toBe(25);
    expect(r.measured).toBe(2);
    expect(r.score).toBe(Math.round((20 * Math.log10(55_000) - 40 + 25) / 2));
  });

  it("aucun relevé ni saisie : pas de note du tout", () => {
    const r = computeDay1Index({ streamsByMonth: {}, ...none }, TODAY);
    expect(r.score).toBeNull();
    expect(r.measured).toBe(0);
  });

  it("diversité : seules les sources des 12 derniers mois comptent ; un vieux relevé ne compte pas pour le streaming", () => {
    const old = computeDay1Index({ streamsByMonth: months([1000], "2025-06"), rights: [{ paid_on: "2025-01-10" }], shows: [], sync: [{ paid_on: "2026-02-01" }] }, TODAY);
    expect(old.dimensions.find((x) => x.key === "diversity")?.score).toBe(25); // seule la sync est récente
  });

  it("croissance et élan bornés à 0–100", () => {
    const r = computeDay1Index({ streamsByMonth: months([10, 10, 10, 1000, 1000, 1000]), ...none }, TODAY);
    expect(r.dimensions.find((x) => x.key === "growth")?.score).toBe(100);
    const f = computeDay1Index({ streamsByMonth: months([1000, 1000, 1000, 10, 10, 10]), ...none }, TODAY);
    expect(f.dimensions.find((x) => x.key === "growth")?.score).toBe(0);
  });
});

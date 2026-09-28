import { describe, expect, it } from "vitest";
import { changeScore, computeDay1Index, sizeScore, type IndexInput } from "../day1-index";

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
const none = { revenueByMonth: {}, rights: [], shows: [], sync: [] };
const dim = (r: ReturnType<typeof computeDay1Index>, k: string) => r.dimensions.find((d) => d.key === k)!;

describe("échelles (affichées à l'écran)", () => {
  it("taille : 10 k streams/mois = 40, 100 k = 60, 1 M = 80, 10 M = 100, bornée", () => {
    expect(sizeScore(10_000)).toBeCloseTo(40);
    expect(sizeScore(1_000_000)).toBeCloseTo(80);
    expect(sizeScore(50_000_000)).toBe(100);
    expect(sizeScore(50)).toBe(0);
  });
  it("évolution : symétrique en log — ×1,5 = 100, stable = 50, ÷1,5 = 0", () => {
    expect(changeScore(1.5)).toBeCloseTo(100);
    expect(changeScore(1)).toBe(50);
    expect(changeScore(1 / 1.5)).toBeCloseTo(0);
    expect(changeScore(1.2) + changeScore(1 / 1.2)).toBeCloseTo(100); // +20 % et −16,7 % se compensent
    expect(changeScore(3)).toBe(100);
  });
});

describe("Day 1 Index v2 — calcul sur des mesures", () => {
  it("6 mois + droits et concerts : témoin Python (streams ramenés au jour)", () => {
    const r = computeDay1Index(
      {
        streamsByMonth: months([100_000, 100_000, 100_000, 110_000, 120_000, 130_000]),
        revenueByMonth: months([300, 300, 300, 330, 360, 390]),
        rights: [{ paid_on: "2026-06-15", amount_eur: 120 }],
        shows: [{ show_date: "2026-05-02", fee_eur: 1500 }],
        sync: [],
      },
      TODAY,
    );
    // Témoin (python, calendar.monthrange) : taille 61,5126 ; croissance ×1,198901 → 72,37 ; élan ×1,168831 → 69,2377
    expect(dim(r, "size").score).toBeCloseTo(61.5126, 3);
    expect(dim(r, "growth").score).toBeCloseTo(72.37, 2);
    expect(dim(r, "momentum").score).toBeCloseTo(69.2377, 3);
    // Diversité sur montants 12 mois : streaming 1 980, droits 120, concerts 1 500 → HHI 0,47722 → (1 − HHI) ÷ 0,75
    const shares = [1980, 120, 1500].map((x) => x / 3600);
    const hhi = shares.reduce((t, s) => t + s * s, 0);
    expect(dim(r, "diversity").score).toBeCloseTo(((1 - hhi) / 0.75) * 100, 5);
    expect(dim(r, "loyalty").score).toBeNull();
    expect(r.measured).toBe(4);
    expect(r.score).toBe(Math.round((61.5126 + 72.37 + 69.2377 + ((1 - hhi) / 0.75) * 100) / 4));
  });

  it("février n'est pas une baisse : même écoute par jour → élan 50", () => {
    const r = computeDay1Index({ streamsByMonth: { "2025-11": 30_000, "2025-12": 31_000, "2026-01": 31_000, "2026-02": 28_000 }, ...none }, "2026-03-10");
    expect(dim(r, "momentum").score).toBeCloseTo(50);
  });

  it("15 mois et plus : croissance sur un an (mêmes mois l'année d'avant), dite comme telle", () => {
    const series = [100_000, 100_000, 100_000, ...Array(9).fill(110_000), 120_000, 120_000, 120_000];
    const r = computeDay1Index({ streamsByMonth: months(series), ...none }, TODAY);
    expect(dim(r, "growth").score).toBeCloseTo(changeScore(1.2), 5);
    expect(dim(r, "growth").measure).toMatch(/un an plus tôt/);
  });

  it("2 mois seulement : ni croissance ni élan (pas inventés)", () => {
    const r = computeDay1Index({ streamsByMonth: months([50_000, 60_000]), ...none }, TODAY);
    expect(dim(r, "growth").score).toBeNull();
    expect(dim(r, "growth").missing).toMatch(/6 mois/);
    expect(dim(r, "momentum").score).toBeNull();
  });

  it("une seule source de revenus → diversité 0 ; aucune → non mesurée ; vieux montants exclus", () => {
    const one = computeDay1Index({ ...none, streamsByMonth: months([1000]), revenueByMonth: months([10]) }, TODAY);
    expect(dim(one, "diversity").score).toBe(0);
    const nothing = computeDay1Index({ streamsByMonth: {}, ...none }, TODAY);
    expect(dim(nothing, "diversity").score).toBeNull();
    expect(nothing.score).toBeNull();
    const old = computeDay1Index({ ...none, streamsByMonth: {}, rights: [{ paid_on: "2025-01-10", amount_eur: 500 }], sync: [{ paid_on: "2026-02-01", amount_eur: 800 }] }, TODAY);
    expect(dim(old, "diversity").score).toBe(0); // seule la sync est dans les 12 mois
  });
});

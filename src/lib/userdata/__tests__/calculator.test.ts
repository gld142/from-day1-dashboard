import { describe, expect, it } from "vitest";
import { platformRates, revenueFor, streamsFor } from "../calculator";
import type { UserData } from "../store";

const d = {
  months: ["2026-01", "2026-02"],
  streamsByMonth: { "2026-01": { spotify: 10_000, apple: 2_000, deezer: 500 }, "2026-02": { spotify: 10_000, apple: 2_000 } },
  revenueByMonthDsp: { "2026-01": { spotify: 30, apple: 14, deezer: 2 }, "2026-02": { spotify: 30, apple: 14 } },
} as unknown as UserData;

describe("platformRates — les taux réels de l'artiste", () => {
  it("€ pour 1 000 streams et part des streams, par plateforme (dès 1 000 streams)", () => {
    const r = platformRates(d);
    expect(r).toEqual([
      { dsp: "spotify", share: 20_000 / 24_000, per1000: 3 },
      { dsp: "apple", share: 4_000 / 24_000, per1000: 7 },
    ]);
  });
  it("sans détail des revenus par plateforme : pas de taux (liste vide)", () => {
    expect(platformRates({ ...d, revenueByMonthDsp: undefined } as UserData)).toEqual([]);
  });
});

describe("revenueFor / streamsFor", () => {
  const rates = [
    { dsp: "spotify" as const, share: 0.75, per1000: 3 },
    { dsp: "apple" as const, share: 0.25, per1000: 7 },
  ];
  it("X streams → revenus par plateforme selon la répartition", () => {
    const r = revenueFor(rates, 100_000);
    expect(r.lines).toEqual([
      { dsp: "spotify", streams: 75_000, revenue: 225 },
      { dsp: "apple", streams: 25_000, revenue: 175 },
    ]);
    expect(r.total).toBe(400);
    expect(r.per1000).toBe(4);
  });
  it("revenu visé → streams nécessaires (au taux moyen pondéré)", () => {
    expect(streamsFor(rates, 400)).toBe(100_000);
    expect(streamsFor([], 400)).toBeNull();
  });
  it("répartition modifiée : renormalisée à 100 %", () => {
    const r = revenueFor([{ ...rates[0], share: 1 }, { ...rates[1], share: 1 }], 100_000);
    expect(r.total).toBe(500);
  });
});

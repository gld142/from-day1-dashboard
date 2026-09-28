import { describe, expect, it } from "vitest";
import type { UserData } from "@/lib/userdata/store";
import { catalogHealth, concentration, geography, halfLives, paymentLag, platformPay, revenueStability, seasonality, titlesToReach } from "../statement";

const base = (over: Partial<UserData> = {}): UserData => ({
  version: 1, artistName: "A", importedAt: "2026-09-29", format: "distrokid", eurRate: 1, sourceCurrency: "EUR",
  months: [], streamsByMonth: {}, revenueByMonth: {}, trackStreams: {}, countryStreams: {}, totalStreams: 0, totalRevenueEur: 0, active: true, ...over,
});

describe("concentration (indice de Herfindahl)", () => {
  it("parts égales entre 4 → 0,25, soit 4 équivalents ; un seul → 1", () => {
    expect(concentration([10, 10, 10, 10])).toEqual({ hhi: 0.25, equivalent: 4, top1: 0.25, top3: 0.75 });
    expect(concentration([5])).toEqual({ hhi: 1, equivalent: 1, top1: 1, top3: 1 });
    expect(concentration([])).toBeNull();
  });
  it("titres nécessaires pour 80 % : 50 + 30 = 80 → 2", () => {
    expect(titlesToReach([30, 50, 15, 5], 0.8)).toBe(2);
    expect(titlesToReach([30, 50, 15, 5], 0.81)).toBe(3);
  });
});

describe("plateformes : taux et part payée contre part écoutée", () => {
  it("taux pour 1 000 streams, tendance 3 derniers mois contre 3 premiers, écart de parts", () => {
    const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
    const d = base({
      months,
      streamsByMonth: Object.fromEntries(months.map((m) => [m, { spotify: 1000, deezer: 1000 }])),
      revenueByMonthDsp: Object.fromEntries(months.map((m, i) => [m, { spotify: i < 3 ? 4 : 3, deezer: 6 }])),
    });
    const r = platformPay(d)!;
    const spotify = r.find((x) => x.dsp === "spotify")!;
    const deezer = r.find((x) => x.dsp === "deezer")!;
    // Spotify : (4·3 + 3·3) / 6000 × 1000 = 3,5 ; tendance 3 / 4 − 1 = −25 %
    expect(spotify.per1000).toBeCloseTo(3.5);
    expect(spotify.trend).toBeCloseTo(-0.25);
    // Parts : Spotify 21 € sur 57 €, 50 % des streams → écart 21/57 − 0,5
    expect(spotify.gap).toBeCloseTo(21 / 57 - 0.5);
    expect(deezer.gap).toBeCloseTo(36 / 57 - 0.5);
    expect(deezer.trend).toBeCloseTo(0);
  });
  it("relevé importé avant le détail par plateforme → rien", () => {
    expect(platformPay(base())).toBeNull();
  });
});

describe("stabilité des revenus", () => {
  it("annualisé = moyenne des 3 derniers mois × 12 ; variabilité ; pire baisse d'un mois", () => {
    const d = base({ months: ["2026-01", "2026-02", "2026-03", "2026-04"], revenueByMonth: { "2026-01": 100, "2026-02": 200, "2026-03": 100, "2026-04": 100 } });
    const s = revenueStability(d)!;
    expect(s.annualized).toBeCloseTo(((200 + 100 + 100) / 3) * 12);
    // moyenne 125, écart-type (population) = √((625+5625+625+625)/4) = √1875
    expect(s.cv).toBeCloseTo(Math.sqrt(1875) / 125);
    expect(s.worstDrop).toEqual({ month: "2026-03", change: -0.5 });
  });
  it("un seul mois → rien", () => {
    expect(revenueStability(base({ months: ["2026-01"], revenueByMonth: { "2026-01": 5 } }))).toBeNull();
  });
});

describe("saisonnalité", () => {
  it("24 mois minimum ; indice = moyenne du mois calendaire / moyenne générale", () => {
    const months = Array.from({ length: 24 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
    const revenueByMonth = Object.fromEntries(months.map((m) => [m, m.endsWith("-12") ? 200 : 100]));
    const s = seasonality(base({ months, revenueByMonth }))!;
    const mean = (22 * 100 + 2 * 200) / 24;
    expect(s["12"]).toBeCloseTo(200 / mean);
    expect(s["01"]).toBeCloseTo(100 / mean);
    const short = months.slice(0, 23);
    expect(seasonality(base({ months: short, revenueByMonth: Object.fromEntries(short.map((m) => [m, revenueByMonth[m]])) }))).toBeNull();
  });
});

describe("catalogue", () => {
  it("dépendance au hit, longue traîne, petits titres — sur les revenus quand ils existent", () => {
    const trackRevenue = { A: 60, B: 20, C: 10, D: 10 };
    const trackStreams = { A: 20000, B: 8000, C: 500, D: 900 };
    const c = catalogHealth(base({ trackRevenue, trackStreams }))!;
    expect(c.basis).toBe("revenue");
    expect(c.titles).toBe(4);
    expect(c.top1Share).toBeCloseTo(0.6);
    expect(c.titlesFor80).toBe(2);
    expect(c.hhi).toBeCloseTo(0.36 + 0.04 + 0.01 + 0.01);
    expect(c.smallTitles).toBe(2); // moins de 1 000 streams
    expect(c.outsideTop10Share).toBe(0);
  });
});

describe("géographie", () => {
  it("part hors 1er pays, équivalents, taux par pays et son évolution (détail mensuel)", () => {
    const g = geography(
      base({
        countryStreams: { FR: 3000, BE: 1000 },
        countryRevenue: { FR: 12, BE: 2 },
        countryMonthStreams: { FR: { "2026-01": 1000, "2026-02": 1000, "2026-03": 1000 } },
        countryMonthRevenue: { FR: { "2026-01": 5, "2026-02": 4, "2026-03": 3 } },
      }),
    )!;
    expect(g.top).toBe("FR");
    expect(g.outsideTopShare).toBeCloseTo(0.25);
    expect(g.equivalent).toBeCloseTo(1 / (0.75 ** 2 + 0.25 ** 2));
    const fr = g.rates.find((r) => r.country === "FR")!;
    expect(fr.per1000).toBeCloseTo(4);
    expect(fr.trend).toBeCloseTo(3 / 5 - 1); // dernier mois contre premier, sur le détail
    expect(g.rates.find((r) => r.country === "BE")?.trend).toBeNull();
  });
});

describe("délai de paiement", () => {
  it("médiane pondérée par les revenus, en mois entre vente et relevé", () => {
    const l = paymentLag(base({ saleReportRevenue: { "2026-01>2026-03": 10, "2026-02>2026-04": 30, "2026-03>2026-06": 20 } }))!;
    expect(l.median).toBe(2); // 40 € à 2 mois sur 60 € → la médiane tombe à 2
    expect(l.shareByLag).toEqual({ 2: 40 / 60, 3: 20 / 60 });
    expect(paymentLag(base())).toBeNull();
  });
});

describe("demi-vie des titres", () => {
  it("mois entre le pic et le premier mois sous la moitié du pic ; pas encore divisé par 2 → null", () => {
    const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
    const h = halfLives(
      base({
        months,
        trackMonthStreams: {
          Rapide: { "2026-01": 1000, "2026-02": 600, "2026-03": 400 }, // pic janvier, < 500 en mars → 2 mois
          Durable: { "2026-02": 800, "2026-03": 700, "2026-04": 650, "2026-05": 600, "2026-06": 500 },
          Court: { "2026-05": 300, "2026-06": 280 }, // pas assez de recul après le pic
        },
      }),
    );
    expect(h.titles.find((t) => t.title === "Rapide")).toMatchObject({ peakMonth: "2026-01", halfLife: 2 });
    expect(h.titles.find((t) => t.title === "Durable")).toMatchObject({ peakMonth: "2026-02", halfLife: null });
    expect(h.titles.find((t) => t.title === "Court")).toBeUndefined();
    expect(h.median).toBe(2);
    expect(h.stillAbove).toBe(1);
  });
});

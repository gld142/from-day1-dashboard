import { describe, expect, it } from "vitest";
import type { UserData } from "../store";
import {
  countryRows,
  monthSeries,
  platformMixShift,
  platformRows,
  revenueSummary,
  streamsSummary,
  trackRows,
} from "../statement-insights";

/** Relevé mensuel de test : par mois, streams et revenus par DSP. */
function statement(
  byMonth: Record<string, Partial<Record<"spotify" | "apple" | "youtube", [streams: number, revenue: number]>>>,
  extra: Partial<UserData> = {},
): UserData {
  const months = Object.keys(byMonth).sort();
  const streamsByMonth: UserData["streamsByMonth"] = {};
  const revenueByMonth: UserData["revenueByMonth"] = {};
  const revenueByMonthDsp: NonNullable<UserData["revenueByMonthDsp"]> = {};
  for (const m of months) {
    streamsByMonth[m] = {};
    revenueByMonthDsp[m] = {};
    revenueByMonth[m] = 0;
    for (const [dsp, [st, rev]] of Object.entries(byMonth[m]) as ["spotify" | "apple" | "youtube", [number, number]][]) {
      streamsByMonth[m][dsp] = st;
      revenueByMonthDsp[m][dsp] = rev;
      revenueByMonth[m] += rev;
    }
  }
  const totalStreams = Object.values(streamsByMonth).reduce((s, d) => s + Object.values(d).reduce((a, b) => a + (b ?? 0), 0), 0);
  const totalRevenueEur = Object.values(revenueByMonth).reduce((a, b) => a + b, 0);
  return {
    version: 1, artistName: "Test", importedAt: "2026-09-28", format: "distrokid", eurRate: 1, sourceCurrency: "EUR",
    months, streamsByMonth, revenueByMonth, revenueByMonthDsp,
    trackStreams: {}, countryStreams: {}, trackRevenue: {}, countryRevenue: {},
    totalStreams, totalRevenueEur, active: true, ...extra,
  };
}

describe("monthSeries", () => {
  it("un point par mois du premier au dernier ; un mois absent du relevé est marqué, pas inventé", () => {
    const d = statement({ "2026-01": { spotify: [1000, 4] }, "2026-03": { spotify: [2000, 8] } });
    const s = monthSeries(d);
    expect(s.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(s[1]).toMatchObject({ missing: true, revenue: 0, streams: 0, per1000: null });
    expect(s[2]).toMatchObject({ missing: false, revenue: 8, streams: 2000, per1000: 4 });
  });
});

describe("revenueSummary", () => {
  const d = statement({
    "2025-06": { spotify: [1000, 10] },
    "2025-07": { spotify: [1000, 10] },
    "2025-08": { spotify: [1000, 10] },
    "2025-09": { spotify: [1000, 10] },
    "2025-10": { spotify: [1000, 10] },
    "2025-11": { spotify: [1000, 10] },
    "2025-12": { spotify: [1000, 30] },
    "2026-01": { spotify: [1000, 10] },
    "2026-02": { spotify: [1000, 10] },
    "2026-03": { spotify: [1000, 10] },
    "2026-04": { spotify: [1000, 12] },
    "2026-05": { spotify: [1000, 12] },
    "2026-06": { spotify: [1000, 12] },
  });
  const r = revenueSummary(d);
  it("total, moyenne par mois couvert, meilleur et dernier mois", () => {
    expect(r.total).toBeCloseTo(156); // 6 × 10 + 30 + 3 × 10 + 3 × 12
    expect(r.months).toBe(13);
    expect(r.avgMonthly).toBeCloseTo(156 / 13);
    expect(r.best).toEqual({ month: "2025-12", value: 30 });
    expect(r.last).toEqual({ month: "2026-06", value: 12 });
  });
  it("tendance 3 mois (avr.–juin contre janv.–mars) et même mois l'an dernier", () => {
    expect(r.trend3).toBeCloseTo(36 / 30 - 1);
    expect(r.yoy).toEqual({ month: "2026-06", previous: "2025-06", change: expect.closeTo(0.2) });
  });
  it("pas de comparaison annuelle sans le mois de l'an dernier", () => {
    const short = revenueSummary(statement({ "2026-05": { spotify: [1, 1] }, "2026-06": { spotify: [1, 1] } }));
    expect(short.yoy).toBeNull();
    expect(short.trend3).toBeNull();
  });
});

describe("platformRows", () => {
  const d = statement({
    "2026-01": { spotify: [10_000, 30], apple: [2_000, 14], youtube: [5_000, 3] },
    "2026-02": { spotify: [10_000, 30], apple: [2_000, 14] },
  });
  it("revenus, streams, parts et € pour 1 000 streams par plateforme, triés par revenus", () => {
    const rows = platformRows(d);
    expect(rows.map((r) => r.dsp)).toEqual(["spotify", "apple", "youtube"]);
    expect(rows[0]).toMatchObject({ streams: 20_000, revenue: 60, per1000: 3 });
    expect(rows[1]).toMatchObject({ streams: 4_000, revenue: 28, per1000: 7 });
    expect(rows[0].revenueShare).toBeCloseTo(60 / 91);
    expect(rows[2].streamsShare).toBeCloseTo(5_000 / 29_000);
  });
  it("relevé importé avant les découpages : streams seuls, revenus inconnus (null, pas 0)", () => {
    const { revenueByMonthDsp: _drop, ...old } = d;
    const rows = platformRows(old as UserData);
    expect(rows[0]).toMatchObject({ dsp: "spotify", revenue: null, per1000: null, revenueShare: null });
  });
});

describe("trackRows / countryRows", () => {
  const d = statement(
    { "2026-01": { spotify: [3000, 12] } },
    {
      trackStreams: { A: 1000, B: 2000 },
      trackRevenue: { A: 8, B: 4 },
      countryStreams: { FR: 2500, BE: 500 },
      countryRevenue: { FR: 10, BE: 2 },
    },
  );
  it("titres triés par revenus, avec € pour 1 000 streams", () => {
    expect(trackRows(d)).toEqual([
      { key: "A", streams: 1000, revenue: 8, per1000: 8 },
      { key: "B", streams: 2000, revenue: 4, per1000: 2 },
    ]);
  });
  it("pays triés par revenus", () => {
    expect(countryRows(d).map((r) => r.key)).toEqual(["FR", "BE"]);
  });
  it("sans revenus par titre : tri par streams, revenus inconnus", () => {
    const { trackRevenue: _drop, ...old } = d;
    expect(trackRows(old as UserData)).toEqual([
      { key: "B", streams: 2000, revenue: null, per1000: null },
      { key: "A", streams: 1000, revenue: null, per1000: null },
    ]);
  });
});

describe("streamsSummary / platformMixShift", () => {
  const months: Record<string, Partial<Record<"spotify" | "apple" | "youtube", [number, number]>>> = {};
  ["2026-01", "2026-02", "2026-03"].forEach((m) => (months[m] = { spotify: [8000, 0], apple: [2000, 0] }));
  ["2026-04", "2026-05", "2026-06"].forEach((m) => (months[m] = { spotify: [6000, 0], apple: [4000, 0] }));
  const d = statement(months);
  it("streams : total, meilleur mois, tendance", () => {
    const s = streamsSummary(d);
    expect(s.total).toBe(60_000);
    expect(s.trend3).toBeCloseTo(0);
    expect(s.topPlatform).toEqual({ dsp: "spotify", share: expect.closeTo(42_000 / 60_000) });
  });
  it("glissement entre plateformes : 3 premiers mois contre 3 derniers", () => {
    const shift = platformMixShift(d);
    expect(shift?.find((r) => r.dsp === "apple")).toMatchObject({ before: expect.closeTo(0.2), after: expect.closeTo(0.4) });
    expect(platformMixShift(statement({ "2026-01": { spotify: [1, 0] } }))).toBeNull();
  });
});

describe("monthSeries — mois partiels d'un relevé virtuel", () => {
  it("un mois couvert par moins d'artistes que de relevés est « partial »", () => {
    const d = statement(
      { "2026-07": { spotify: [100, 1] }, "2026-08": { spotify: [100, 1] } },
      { scope: { kind: "label", artists: 3, withStatement: 2, coverage: { "2026-07": 1, "2026-08": 2 } } },
    );
    expect(monthSeries(d).map((p) => p.partial)).toEqual([true, false]);
  });
  it("sans scope : jamais partial", () => {
    expect(monthSeries(statement({ "2026-08": { spotify: [100, 1] } })).map((p) => p.partial)).toEqual([false]);
  });
});

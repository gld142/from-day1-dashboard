import { describe, expect, it } from "vitest";
import {
  ARTISTS,
  auditFindings,
  countryBreakdown,
  dailyEstimates,
  estimateSummary,
  expensesFor,
  hasReal,
  provenanceByDsp,
  revenueSeries,
  rosterEstimateSummary,
  streamSeries,
  sumStreams,
  topTracks,
} from "@/lib/demo/api";
import { latestSnapshot, realStreamSeries } from "@/lib/real";

describe("api.ts sur les artistes réels", () => {
  it.each(ARTISTS.map((a) => a.id))("%s : la façade sert la série réelle", (id) => {
    expect(hasReal(id)).toBe(true);
    expect(JSON.stringify(streamSeries(id, 7))).toBe(JSON.stringify(realStreamSeries(id, 7)));
    const today = streamSeries(id, 1).find((p) => p.dsp === "spotify")!;
    expect(today.provenance).toBeDefined();
    if (latestSnapshot(id).kworb) expect(today.streams).toBeGreaterThan(100_000);
  });

  it("dadju : le streaming des revenus mensuels vient de l'estimateur", () => {
    const rev = revenueSeries("dadju", 24).filter((p) => p.source === "streaming");
    const est = dailyEstimates("dadju", 730);
    const lastMonth = rev[rev.length - 1];
    const fromEstimator = est.filter((d) => d.date.startsWith(lastMonth.month)).reduce((s, d) => s + d.grossMaster.mid, 0);
    expect(lastMonth.amount).toBe(Math.round(fromEstimator));
    expect(lastMonth.amount).toBeGreaterThan(100_000);
  });

  it("estimateSummary : jour ≤ semaine ≤ mois ≤ année, en fourchette, part artiste < brut", () => {
    const d = estimateSummary("dadju", "day");
    const w = estimateSummary("dadju", "week");
    const m = estimateSummary("dadju", "month");
    const y = estimateSummary("dadju", "year");
    expect(d.grossMaster.mid).toBeLessThan(w.grossMaster.mid);
    expect(w.grossMaster.mid).toBeLessThan(m.grossMaster.mid);
    expect(m.grossMaster.mid).toBeLessThan(y.grossMaster.mid);
    expect(d.grossMaster.low).toBeLessThan(d.grossMaster.high);
    expect(d.artistShare.mid).toBeLessThan(d.grossMaster.mid);
    expect(d.calibrated).toBe(false);
  });

  it("rosterEstimateSummary agrège les trois artistes", () => {
    const r = rosterEstimateSummary("month");
    const sum = ARTISTS.reduce((s, a) => s + estimateSummary(a.id, "month").grossMaster.mid, 0);
    expect(r.grossMaster.mid).toBeCloseTo(sum, 6);
    expect(r.streams).toBeGreaterThan(0);
  });

  it("auditFindings des artistes réels : au moins un écart attribué à un DSP, aucun au label", () => {
    const f = auditFindings("dadju");
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => x.source.includes("Spotify"))).toBe(true);
    expect(f.every((x) => !/label|distrib/i.test(x.source))).toBe(true);
  });

  it("topTracks de Dadju commence par un titre relevé", () => {
    const t = topTracks("dadju", 30, 3);
    const names = latestSnapshot("dadju").kworb!.tracks.map((x) => x.name);
    expect(names).toContain(t[0].title);
  });

  it("countryBreakdown et provenanceByDsp répondent", () => {
    expect(countryBreakdown("dadju", 30).length).toBeGreaterThan(0);
    expect(provenanceByDsp("dadju", 30).spotify).toBeDefined();
    expect(sumStreams("kiko", 30)).toBeGreaterThan(0);
  });

  it("les dépenses sont dimensionnées à la taille réelle de l'artiste", () => {
    const kiko = expensesFor("kiko", 12).reduce((s, e) => s + e.amount, 0);
    const dadju = expensesFor("dadju", 12).reduce((s, e) => s + e.amount, 0);
    expect(kiko).toBeLessThan(12_000);
    expect(dadju).toBeGreaterThan(kiko * 20);
  });
});

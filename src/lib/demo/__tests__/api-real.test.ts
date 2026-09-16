import { describe, expect, it } from "vitest";
import {
  ARTISTS,
  auditFindings,
  countryBreakdown,
  dailyEstimates,
  dspEstimates,
  estimateSummaries,
  estimateSummary,
  expensesFor,
  hasReal,
  provenanceByDsp,
  revenueSeries,
  rosterDspEstimates,
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
    // 90 jours : entre le mois et l'année, sur exactement 90 jours.
    const q = estimateSummary("dadju", "quarter");
    expect(q.grossMaster.mid).toBeGreaterThan(m.grossMaster.mid);
    expect(q.grossMaster.mid).toBeLessThan(y.grossMaster.mid);
    expect(q.period).toBe("quarter");
    expect(dailyEstimates("dadju", 365).slice(-90)[0].date).toBe(q.from);
  });

  it("estimateSummaries sert les cinq périodes, identiques aux résumés unitaires", () => {
    const all = estimateSummaries("dadju");
    expect(Object.keys(all).sort()).toEqual(["day", "month", "quarter", "week", "year"]);
    expect(all.quarter.grossMaster.mid).toBe(estimateSummary("dadju", "quarter").grossMaster.mid);
  });

  it("dspEstimates : la somme des plateformes retombe sur le brut master de la période", () => {
    for (const period of ["day", "week", "month", "quarter", "year"] as const) {
      const rows = dspEstimates("dadju", period);
      expect(rows.length).toBeGreaterThan(0);
      const sum = rows.reduce((s, r) => s + r.gross, 0);
      expect(sum).toBeCloseTo(estimateSummary("dadju", period).grossMaster.mid, 6);
      // Trié par brut décroissant, taux effectif cohérent.
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].gross).toBeGreaterThanOrEqual(rows[i].gross);
      for (const r of rows) if (r.streams > 0) expect(r.rate).toBeCloseTo(r.gross / r.streams, 12);
    }
  });

  it("rosterDspEstimates : somme des artistes réels, égale au résumé roster", () => {
    const rows = rosterDspEstimates("week");
    const sum = rows.reduce((s, r) => s + r.gross, 0);
    expect(sum).toBeCloseTo(rosterEstimateSummary("week").grossMaster.mid, 6);
    const spotify = rows.find((r) => r.dsp === "spotify")!;
    const perArtist = ARTISTS.reduce(
      (s, a) => s + (dspEstimates(a.id, "week").find((r) => r.dsp === "spotify")?.streams ?? 0),
      0,
    );
    expect(spotify.streams).toBe(perArtist);
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

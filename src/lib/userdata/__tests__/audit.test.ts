import { describe, expect, it } from "vitest";
import type { UserData } from "../store";
import { auditStatement } from "../audit";

type Cell = [streams: number, revenue: number];
/** Relevé : mois → plateforme → [streams, revenus]. */
function statement(byMonth: Record<string, Partial<Record<"spotify" | "apple", Cell>>>, extra: Partial<UserData> = {}): UserData {
  const months = Object.keys(byMonth).sort();
  const streamsByMonth: UserData["streamsByMonth"] = {};
  const revenueByMonth: UserData["revenueByMonth"] = {};
  const revenueByMonthDsp: NonNullable<UserData["revenueByMonthDsp"]> = {};
  for (const m of months) {
    streamsByMonth[m] = {};
    revenueByMonthDsp[m] = {};
    revenueByMonth[m] = 0;
    for (const [dsp, [st, rev]] of Object.entries(byMonth[m]) as ["spotify" | "apple", Cell][]) {
      streamsByMonth[m][dsp] = st;
      revenueByMonthDsp[m][dsp] = rev;
      revenueByMonth[m] += rev;
    }
  }
  return {
    version: 1, artistName: "Test", importedAt: "2026-09-28", format: "distrokid", eurRate: 1, sourceCurrency: "EUR",
    months, streamsByMonth, revenueByMonth, revenueByMonthDsp, trackStreams: {}, countryStreams: {}, trackRevenue: {}, countryRevenue: {},
    totalStreams: 0, totalRevenueEur: 0, active: true, ...extra,
  };
}

/** Spotify à 3 €/1 000 tous les mois, sauf les mois surchargés. */
const normal = (over: Record<string, Partial<Record<"spotify" | "apple", Cell>>> = {}) => {
  const base: Record<string, Partial<Record<"spotify" | "apple", Cell>>> = {};
  for (const m of ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]) base[m] = { spotify: [10_000, 30] };
  return statement({ ...base, ...over });
};

describe("auditStatement", () => {
  it("relevé régulier : rien à signaler, mais on dit ce qui a été vérifié", () => {
    const a = auditStatement(normal());
    expect(a.available).toBe(true);
    expect(a.findings).toEqual([]);
    expect(a.checked).toMatchObject({ platformMonths: 6, months: 6 });
  });

  it("taux en chute : payé nettement moins que d'habitude pour les mêmes streams", () => {
    const a = auditStatement(normal({ "2026-04": { spotify: [10_000, 12] } }));
    expect(a.findings).toEqual([
      expect.objectContaining({ kind: "rate-drop", month: "2026-04", dsp: "spotify", streams: 10_000, revenue: 12, usualRate: 3, rate: 1.2, expected: 30, gap: 18 }),
    ]);
    expect(a.totalGap).toBeCloseTo(18);
  });

  it("une petite baisse (au-dessus du seuil de 70 %) n'est pas signalée", () => {
    expect(auditStatement(normal({ "2026-04": { spotify: [10_000, 24] } })).findings).toEqual([]);
  });

  it("streams sans aucun revenu sur la plateforme ce mois-là", () => {
    const a = auditStatement(normal({ "2026-05": { spotify: [8_000, 0] } }));
    expect(a.findings).toEqual([expect.objectContaining({ kind: "unpaid-streams", month: "2026-05", dsp: "spotify", streams: 8_000, expected: 24, gap: 24 })]);
  });

  it("sous 1 000 streams, un taux ne veut rien dire : pas de signalement", () => {
    expect(auditStatement(normal({ "2026-05": { spotify: [10_000, 30], apple: [400, 0] } })).findings).toEqual([]);
  });

  it("taux habituel inconnu (moins de 3 mois sur la plateforme) : signalé sans montant attendu", () => {
    const a = auditStatement(normal({ "2026-05": { spotify: [10_000, 30], apple: [5_000, 0] } }));
    expect(a.findings).toEqual([expect.objectContaining({ kind: "unpaid-streams", dsp: "apple", expected: null, gap: null })]);
    expect(a.totalGap).toBe(0);
  });

  it("mois absent au milieu du relevé", () => {
    const d = normal();
    const { ["2026-03"]: _s, ...streams } = d.streamsByMonth;
    const { ["2026-03"]: _r, ...rev } = d.revenueByMonth;
    const { ["2026-03"]: _rd, ...revDsp } = d.revenueByMonthDsp!;
    const a = auditStatement({ ...d, months: d.months.filter((m) => m !== "2026-03"), streamsByMonth: streams, revenueByMonth: rev, revenueByMonthDsp: revDsp });
    expect(a.findings).toContainEqual({ kind: "missing-month", month: "2026-03" });
  });

  it("titre streamé sans aucun revenu sur toute la période", () => {
    const withTracks = auditStatement({ ...normal(), trackStreams: { A: 50_000, B: 2_000 }, trackRevenue: { A: 150 } });
    expect(withTracks.findings).toEqual([{ kind: "unpaid-track", title: "B", streams: 2_000 }]);
  });

  it("le dernier mois du relevé est repéré (souvent incomplet chez les distributeurs)", () => {
    const a = auditStatement(normal({ "2026-06": { spotify: [10_000, 9] } }));
    expect(a.findings[0]).toMatchObject({ kind: "rate-drop", month: "2026-06", lastMonth: true });
  });

  it("relevé importé avant le détail par plateforme : audit indisponible (pas « rien à signaler »)", () => {
    const { revenueByMonthDsp: _drop, ...old } = normal();
    expect(auditStatement(old as UserData)).toMatchObject({ available: false, findings: [] });
  });
});

import { describe, expect, it } from "vitest";
import type { UserData } from "../store";
import { mergeStatements } from "../merge";

/** Relevé minimal d'un artiste : mois → [streams spotify, revenus]. `extra` complète les champs optionnels. */
function statement(byMonth: Record<string, [streams: number, revenue: number]>, extra: Partial<UserData> = {}): UserData {
  const months = Object.keys(byMonth).sort();
  return {
    version: 1, artistName: "X", importedAt: "2026-09-28T10:00:00.000Z", format: "distrokid", eurRate: 1, sourceCurrency: "EUR",
    months,
    streamsByMonth: Object.fromEntries(months.map((m) => [m, { spotify: byMonth[m][0] }])),
    revenueByMonth: Object.fromEntries(months.map((m) => [m, byMonth[m][1]])),
    trackStreams: {}, countryStreams: {},
    totalStreams: months.reduce((s, m) => s + byMonth[m][0], 0),
    totalRevenueEur: months.reduce((s, m) => s + byMonth[m][1], 0),
    active: true,
    ...extra,
  };
}
const entry = (id: string, data: UserData) => ({ id, name: id.toUpperCase(), data });
const opts = { artistName: "Label Nord", artists: 3 };

describe("mergeStatements — le relevé virtuel du label", () => {
  it("additionne mois, plateformes et pays ; les mois sont l'union", () => {
    const { data, coverage, withStatement, artists } = mergeStatements(
      [
        entry("a", statement({ "2026-07": [1000, 10], "2026-08": [1000, 10] }, { countryStreams: { FR: 1500, BE: 500 } })),
        entry("b", statement({ "2026-08": [500, 5.5], "2026-09": [500, 5.5] }, { countryStreams: { FR: 1000 }, streamsByMonth: { "2026-08": { apple: 500 }, "2026-09": { apple: 500 } } })),
      ],
      opts,
    );
    expect(data).not.toBeNull();
    expect(data!.months).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(data!.revenueByMonth).toEqual({ "2026-07": 10, "2026-08": 15.5, "2026-09": 5.5 });
    expect(data!.streamsByMonth["2026-08"]).toEqual({ spotify: 1000, apple: 500 });
    expect(data!.countryStreams).toEqual({ FR: 2500, BE: 500 });
    expect(coverage).toEqual({ "2026-07": 1, "2026-08": 2, "2026-09": 1 });
    expect(withStatement).toBe(2);
    expect(artists).toBe(3);
    expect(data!.scope).toEqual({ kind: "label", artists: 3, withStatement: 2, coverage: { "2026-07": 1, "2026-08": 2, "2026-09": 1 } });
    expect(data!.artistName).toBe("Label Nord");
    expect(data!.totalRevenueEur).toBe(31);
    expect(data!.totalStreams).toBe(3000);
  });

  it("les titres portent le nom de l'artiste : deux « Intro » ne se mélangent pas", () => {
    const { data } = mergeStatements(
      [
        entry("a", statement({ "2026-09": [100, 1] }, { trackStreams: { Intro: 60, Reine: 40 }, trackRevenue: { Intro: 0.6, Reine: 0.4 }, trackIsrc: { Intro: "FR1" } })),
        entry("b", statement({ "2026-09": [100, 1] }, { trackStreams: { Intro: 100 }, trackRevenue: { Intro: 1 }, trackIsrc: { Intro: "FR2" } })),
      ],
      opts,
    );
    expect(data!.trackStreams).toEqual({ "Intro · A": 60, "Reine · A": 40, "Intro · B": 100 });
    expect(data!.trackRevenue).toEqual({ "Intro · A": 0.6, "Reine · A": 0.4, "Intro · B": 1 });
    expect(data!.trackIsrc).toEqual({ "Intro · A": "FR1", "Intro · B": "FR2" });
  });

  it("un détail optionnel absent chez UN artiste est omis, et l'artiste nommé", () => {
    const { data, missingDetail } = mergeStatements(
      [
        entry("a", statement({ "2026-09": [100, 1] }, { revenueByMonthDsp: { "2026-09": { spotify: 1 } }, trackRevenue: { T: 1 }, countryRevenue: { FR: 1 }, trackMonthStreams: { T: { "2026-09": 100 } } })),
        entry("b", statement({ "2026-09": [100, 1] })),
      ],
      opts,
    );
    expect(data!.revenueByMonthDsp).toBeUndefined();
    expect(data!.trackRevenue).toBeUndefined();
    expect(data!.countryRevenue).toBeUndefined();
    expect(data!.trackMonthStreams).toBeUndefined();
    expect(missingDetail).toEqual([{ id: "b", name: "B", what: ["platforms", "titles", "countries", "detail"] }]);
  });

  it("quand tous l'ont, le détail est fusionné : revenus par plateforme et titre × mois", () => {
    const { data, missingDetail } = mergeStatements(
      [
        entry("a", statement({ "2026-09": [100, 1] }, { revenueByMonthDsp: { "2026-09": { spotify: 1 } }, trackRevenue: {}, countryRevenue: {}, trackMonthStreams: { T: { "2026-09": 100 } } })),
        entry("b", statement({ "2026-09": [100, 2] }, { revenueByMonthDsp: { "2026-09": { spotify: 1.5, apple: 0.5 } }, trackRevenue: {}, countryRevenue: {}, trackMonthStreams: { T: { "2026-09": 100 } } })),
      ],
      opts,
    );
    expect(data!.revenueByMonthDsp).toEqual({ "2026-09": { spotify: 2.5, apple: 0.5 } });
    expect(data!.trackMonthStreams).toEqual({ "T · A": { "2026-09": 100 }, "T · B": { "2026-09": 100 } });
    expect(missingDetail).toEqual([]);
  });

  it("fenêtre Spotify : gardée si identique chez tous, sinon omise avec trackSpotify12", () => {
    const w = { from: "2025-10", to: "2026-09", months: 12 };
    const same = mergeStatements(
      [entry("a", statement({ "2026-09": [1, 1] }, { trackSpotify12: { T: 5 }, spotifyWindow: w })), entry("b", statement({ "2026-09": [1, 1] }, { trackSpotify12: { U: 7 }, spotifyWindow: { ...w } }))],
      opts,
    );
    expect(same.data!.spotifyWindow).toEqual(w);
    expect(same.data!.trackSpotify12).toEqual({ "T · A": 5, "U · B": 7 });
    const diff = mergeStatements(
      [entry("a", statement({ "2026-09": [1, 1] }, { trackSpotify12: { T: 5 }, spotifyWindow: w })), entry("b", statement({ "2026-08": [1, 1] }, { trackSpotify12: { U: 7 }, spotifyWindow: { from: "2025-09", to: "2026-08", months: 12 } }))],
      opts,
    );
    expect(diff.data!.spotifyWindow).toBeUndefined();
    expect(diff.data!.trackSpotify12).toBeUndefined();
  });

  it("retenues : somme des valeurs connues ; importedAt : le plus récent ; devise EUR, taux 1, format generic", () => {
    const { data } = mergeStatements(
      [
        entry("a", statement({ "2026-09": [1, 1] }, { withheldEur: 10, importedAt: "2026-09-01T00:00:00.000Z", sourceCurrency: "USD", eurRate: 0.9, fx: { source: "ecb", eurPerUnit: { "2026-09": 0.9 } } })),
        entry("b", statement({ "2026-09": [1, 1] }, { importedAt: "2026-10-01T00:00:00.000Z" })),
      ],
      opts,
    );
    expect(data!.withheldEur).toBe(10);
    expect(data!.importedAt).toBe("2026-10-01T00:00:00.000Z");
    expect(data!.sourceCurrency).toBe("EUR");
    expect(data!.eurRate).toBe(1);
    expect(data!.fx).toBeUndefined();
    expect(data!.format).toBe("generic");
  });

  it("aucun relevé : data null, couverture vide", () => {
    const r = mergeStatements([], opts);
    expect(r.data).toBeNull();
    expect(r.withStatement).toBe(0);
    expect(r.coverage).toEqual({});
  });

  it("les montants sont arrondis au centime", () => {
    const { data } = mergeStatements([entry("a", statement({ "2026-09": [1, 0.1] })), entry("b", statement({ "2026-09": [1, 0.2] }))], opts);
    expect(data!.revenueByMonth["2026-09"]).toBe(0.3);
  });
});

import { describe, expect, it } from "vitest";
import { addMonths, summarizeRoster, type RosterArtist, type RosterStatement } from "../roster";

/** Relevé mensuel : `rev` et `streams` par mois (un seul DSP suffit ici). */
function statement(byMonth: Record<string, [rev: number, streams: number]>): RosterStatement {
  const months = Object.keys(byMonth).sort();
  return {
    months,
    revenueByMonth: Object.fromEntries(months.map((m) => [m, byMonth[m][0]])),
    streamsByMonth: Object.fromEntries(months.map((m) => [m, { spotify: byMonth[m][1] }])),
    importedAt: "2026-09-28T10:00:00.000Z",
    format: "tunecore",
  };
}
const artist = (id: string, s: RosterStatement | null): RosterArtist => ({ id, name: id.toUpperCase(), statement: s });

/** Mois consécutifs de `from` à `to` inclus, tous au même montant. */
function flat(from: string, to: string, rev: number, streams: number) {
  const out: Record<string, [number, number]> = {};
  for (let m = from; m <= to; m = addMonths(m, 1)) out[m] = [rev, streams];
  return out;
}

describe("addMonths", () => {
  it("passe les années dans les deux sens", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-11", 3)).toBe("2026-02");
    expect(addMonths("2026-09", -11)).toBe("2025-10");
  });
});

describe("summarizeRoster", () => {
  it("fenêtre commune : les 12 mois qui finissent au mois le plus récent du roster", () => {
    const s = summarizeRoster([
      artist("a", statement(flat("2025-01", "2026-08", 10, 1000))),
      artist("b", statement(flat("2026-03", "2026-06", 10, 1000))),
    ]);
    expect(s.window).toEqual({ from: "2025-09", to: "2026-08", months: 12 });
  });

  it("ne compte que les mois de la fenêtre", () => {
    const s = summarizeRoster([artist("a", statement(flat("2024-01", "2026-08", 10, 1000)))]);
    expect(s.lines[0]).toMatchObject({ revenue: 120, streams: 12_000, per1000: 10 });
    expect(s.totals).toMatchObject({ revenue: 120, streams: 12_000, per1000: 10 });
  });

  it("part de chacun, premier artiste et trois premiers", () => {
    const s = summarizeRoster([
      artist("petit", statement(flat("2026-01", "2026-08", 5, 100))),
      artist("gros", statement(flat("2026-01", "2026-08", 60, 100))),
      artist("moyen", statement(flat("2026-01", "2026-08", 25, 100))),
      artist("mini", statement(flat("2026-01", "2026-08", 10, 100))),
    ]);
    expect(s.lines.map((l) => l.id)).toEqual(["gros", "moyen", "mini", "petit"]);
    expect(s.top).toMatchObject({ id: "gros", share: 0.6 });
    expect(s.topThreeShare).toBeCloseTo(0.95);
    expect(s.lines.reduce((sum, l) => sum + l.share, 0)).toBeCloseTo(1);
  });

  it("artiste sans relevé : en fin de liste, hors totaux, signalé", () => {
    const s = summarizeRoster([artist("vide", null), artist("a", statement(flat("2026-01", "2026-08", 10, 100)))]);
    expect(s.lines.map((l) => l.id)).toEqual(["a", "vide"]);
    expect(s.lines[1]).toMatchObject({ hasStatement: false, revenue: 0, share: 0, per1000: null, trend: null });
    expect(s.totals).toMatchObject({ artists: 2, withStatement: 1, revenue: 80 });
    expect(s.alerts).toContainEqual({ kind: "missing", id: "vide", name: "VIDE" });
  });

  it("relevé qui s'arrête avant le dernier mois du roster : en retard, signalé", () => {
    const s = summarizeRoster([
      artist("a", statement(flat("2026-01", "2026-08", 10, 100))),
      artist("b", statement(flat("2026-01", "2026-05", 10, 100))),
    ]);
    expect(s.lines.find((l) => l.id === "b")).toMatchObject({ behind: true, lastMonth: "2026-05" });
    expect(s.lines.find((l) => l.id === "a")).toMatchObject({ behind: false });
    expect(s.alerts).toContainEqual({ kind: "behind", id: "b", name: "B", lastMonth: "2026-05" });
  });

  it("tendance : 3 derniers mois de SON relevé contre les 3 d'avant", () => {
    const s = summarizeRoster([
      artist("baisse", statement({ ...flat("2026-01", "2026-03", 100, 10), ...flat("2026-04", "2026-06", 70, 10) })),
      artist("hausse", statement({ ...flat("2026-01", "2026-03", 100, 10), ...flat("2026-04", "2026-06", 110, 10) })),
    ]);
    expect(s.lines.find((l) => l.id === "baisse")?.trend).toBeCloseTo(-0.3);
    expect(s.lines.find((l) => l.id === "hausse")?.trend).toBeCloseTo(0.1);
    // Baisse de 20 % ou plus : signalée ; la hausse, non.
    expect(s.alerts).toContainEqual({ kind: "decline", id: "baisse", name: "BAISSE", change: expect.closeTo(-0.3) });
    expect(s.alerts.some((a) => a.id === "hausse")).toBe(false);
  });

  it("tendance inconnue sans 6 mois d'historique (jamais un 0 inventé)", () => {
    const s = summarizeRoster([artist("court", statement(flat("2026-04", "2026-08", 10, 100)))]);
    expect(s.lines[0].trend).toBeNull();
  });

  it("aucun relevé dans le roster : pas de fenêtre, pas de premier", () => {
    const s = summarizeRoster([artist("a", null), artist("b", null)]);
    expect(s.window).toBeNull();
    expect(s.top).toBeNull();
    expect(s.totals).toMatchObject({ artists: 2, withStatement: 0, revenue: 0, per1000: null });
  });
});

describe("summarizeRoster — latest, le dernier mois couvert", () => {
  it("additionne les artistes qui couvrent le dernier mois et nomme les autres avec la raison", () => {
    const s = summarizeRoster([
      artist("a", statement(flat("2026-01", "2026-09", 100, 10_000))),
      artist("b", statement(flat("2026-01", "2026-09", 50, 5_000))),
      artist("c", statement(flat("2026-01", "2026-08", 30, 3_000))), // en retard
      artist("d", null), // sans relevé
    ]);
    expect(s.latest).not.toBeNull();
    expect(s.latest!.month).toBe("2026-09");
    expect(s.latest!.revenue).toBe(150);
    expect(s.latest!.streams).toBe(15_000);
    expect(s.latest!.per1000).toBe(10);
    expect(s.latest!.covered.map((a) => a.id)).toEqual(["a", "b"]);
    expect(s.latest!.uncovered).toEqual([
      { id: "c", name: "C", reason: "behind" },
      { id: "d", name: "D", reason: "missing" },
    ]);
  });
  it("l'évolution se calcule sur les artistes qui couvrent les DEUX mois", () => {
    const s = summarizeRoster([
      artist("a", statement({ ...flat("2026-01", "2026-08", 100, 1_000), "2026-09": [120, 1_000] })),
      artist("b", statement({ "2026-09": [50, 500] })), // commence ce mois-ci
    ]);
    expect(s.latest!.revenue).toBe(170);
    expect(s.latest!.previous).not.toBeNull();
    expect(s.latest!.previous!.revenue).toBe(100);
    expect(s.latest!.previous!.streams).toBe(1_000);
    expect(s.latest!.previous!.onArtists).toBe(1);
    expect(s.latest!.previous!.change).toBeCloseTo(0.2, 10); // 120 / 100 − 1, en flottant
  });
  it("sans mois précédent, ou avec un précédent à zéro : pas d'évolution", () => {
    const only = summarizeRoster([artist("a", statement({ "2026-09": [10, 100] }))]);
    expect(only.latest!.previous).toBeNull();
    const zero = summarizeRoster([artist("a", statement({ "2026-08": [0, 0], "2026-09": [10, 100] }))]);
    expect(zero.latest!.previous).toEqual({ revenue: 0, streams: 0, change: null, onArtists: 1 });
  });
  it("aucun relevé : latest est null", () => {
    expect(summarizeRoster([artist("a", null)]).latest).toBeNull();
  });
});

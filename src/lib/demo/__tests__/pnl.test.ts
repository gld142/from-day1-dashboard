/**
 * Filet de sécurité n°2 : cohérence comptable du P&L.
 * net = revenus − dépenses, marges correctes, agrégats label = somme du roster.
 */
import { describe, expect, it } from "vitest";
import {
  ARTISTS,
  catalogValuation,
  expensesFor,
  labelTotals,
  monthlyRevenueTotals,
  pnlByArtist,
  pnlByYear,
  rosterRows,
} from "@/lib/demo/api";

describe("pnlByArtist", () => {
  const pnl = pnlByArtist(12);

  it("retourne une ligne par artiste du roster", () => {
    expect(pnl.map((p) => p.artistId).sort()).toEqual(
      ARTISTS.map((a) => a.id).sort(),
    );
  });

  it("net = revenue - expenses pour chaque artiste", () => {
    for (const p of pnl) {
      expect(p.net).toBe(p.revenue - p.expenses);
    }
  });

  it("marge = net / revenue × 100 (ou 0 si revenue nul)", () => {
    for (const p of pnl) {
      const expected = p.revenue === 0 ? 0 : (p.net / p.revenue) * 100;
      expect(p.margin).toBeCloseTo(expected, 6);
    }
  });

  it("est trié par net décroissant", () => {
    for (let i = 1; i < pnl.length; i++) {
      expect(pnl[i - 1].net).toBeGreaterThanOrEqual(pnl[i].net);
    }
  });
});

describe("pnlByYear", () => {
  it.each(ARTISTS.map((a) => a.id))(
    "%s : somme des années = totaux revenus/dépenses",
    (id) => {
      const byYear = pnlByYear(id);
      const totalRev = monthlyRevenueTotals(id, 24).reduce(
        (s, m) => s + m.amount,
        0,
      );
      const totalExp = expensesFor(id).reduce((s, e) => s + e.amount, 0);
      expect(byYear.reduce((s, y) => s + y.revenue, 0)).toBe(totalRev);
      expect(byYear.reduce((s, y) => s + y.expenses, 0)).toBe(totalExp);
      for (const y of byYear) {
        expect(y.net).toBe(y.revenue - y.expenses);
      }
    },
  );

  it("les années sont triées croissantes", () => {
    const years = pnlByYear("kayro").map((y) => y.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });
});

describe("rosterRows", () => {
  const rows = rosterRows();

  it("est trié par revenue12m décroissant", () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].revenue12m).toBeGreaterThanOrEqual(rows[i].revenue12m);
    }
  });

  it("reprend exactement le P&L 12 mois par artiste", () => {
    const pnl = pnlByArtist(12);
    for (const r of rows) {
      const p = pnl.find((x) => x.artistId === r.id);
      expect(p).toBeDefined();
      expect(r.revenue12m).toBe(p!.revenue);
      expect(r.net12m).toBe(p!.net);
      expect(r.margin).toBeCloseTo(p!.margin, 6);
    }
  });

  it("valuationMid = mid de catalogValuation", () => {
    for (const r of rows) {
      expect(r.valuationMid).toBe(catalogValuation(r.id).mid);
    }
  });
});

describe("labelTotals", () => {
  it("= somme des rosterRows", () => {
    const rows = rosterRows();
    const totals = labelTotals();
    expect(totals.artists).toBe(rows.length);
    expect(totals.streams30d).toBe(rows.reduce((s, r) => s + r.streams30d, 0));
    expect(totals.revenue12m).toBe(rows.reduce((s, r) => s + r.revenue12m, 0));
    expect(totals.net12m).toBe(rows.reduce((s, r) => s + r.net12m, 0));
    expect(totals.valuationMid).toBe(
      rows.reduce((s, r) => s + r.valuationMid, 0),
    );
  });
});

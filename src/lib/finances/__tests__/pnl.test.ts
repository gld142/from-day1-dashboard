import { describe, expect, it } from "vitest";
import { parseExpense, pnl, type Expense, type PnlInput } from "../pnl";

const A1 = "9693e109-1b8f-4269-ac0c-7e27b0576019";
const A2 = "5cb20277-0ddc-443e-8b4e-745213042be8";
const TODAY = "2026-09-28";

describe("parseExpense", () => {
  it("dépense d'un artiste ou de la structure (artiste vide)", () => {
    expect(parseExpense({ artist_id: A1, category: "studio", spent_on: "2026-07-05", amount_eur: "1 200,50", label: " Studio " }, TODAY)).toEqual({
      ok: true,
      value: { artist_id: A1, category: "studio", spent_on: "2026-07-05", amount_eur: 1200.5, label: "Studio", notes: null },
    });
    const r = parseExpense({ artist_id: "", category: "other", spent_on: "2026-07-05", amount_eur: "90", label: "Comptable" }, TODAY);
    expect(r.ok && r.value.artist_id).toBeNull();
  });
  it("refuse avec un message clair", () => {
    const base = { artist_id: A1, category: "studio", spent_on: "2026-07-05", amount_eur: "100", label: "x" };
    expect(parseExpense({ ...base, amount_eur: "0" }, TODAY)).toEqual({ ok: false, error: "Le montant doit être positif." });
    expect(parseExpense({ ...base, label: " " }, TODAY)).toEqual({ ok: false, error: "Décris la dépense." });
    expect(parseExpense({ ...base, spent_on: "2026-10-01" }, TODAY)).toEqual({ ok: false, error: "Enregistre la dépense à la date où elle est payée (pas dans le futur)." });
    expect(parseExpense({ ...base, category: "pirate" }, TODAY).ok).toBe(false);
  });
});

const exp = (artist_id: string | null, spent_on: string, amount_eur: number, category: Expense["category"] = "studio"): Expense => ({
  id: `${artist_id}-${spent_on}-${amount_eur}`, updated_at: TODAY, artist_id, category, spent_on, amount_eur, label: "x", notes: null,
});

describe("pnl", () => {
  const input: Omit<PnlInput, "scope"> = {
    today: TODAY,
    statements: [
      { artistId: A1, revenueByMonth: { "2026-06": 100, "2026-07": 120, "2025-08": 999 } },
      { artistId: A2, revenueByMonth: { "2026-07": 50 } },
    ],
    rights: [{ artistId: A1, paid_on: "2026-07-05", amount_eur: 30 }],
    expenses: [exp(A1, "2026-07-10", 200), exp(A2, "2026-06-02", 80, "clip"), exp(null, "2026-09-01", 40, "other")],
  };

  it("12 mois qui finissent au mois en cours", () => {
    const p = pnl({ ...input, scope: "all" });
    expect(p.months[0]).toBe("2025-10");
    expect(p.months.at(-1)).toBe("2026-09");
  });

  it("structure : relevés + droits − dépenses (frais généraux compris), mois par mois", () => {
    const p = pnl({ ...input, scope: "all" });
    expect(p.rows.find((r) => r.month === "2026-07")).toEqual({ month: "2026-07", statements: 170, rights: 30, revenue: 200, expenses: 200, net: 0 });
    expect(p.rows.find((r) => r.month === "2026-09")).toMatchObject({ revenue: 0, expenses: 40, net: -40 });
    expect(p.totals).toEqual({ statements: 270, rights: 30, revenue: 300, expenses: 320, net: -20, margin: expect.closeTo(-20 / 300) });
    expect(p.byCategory).toEqual([
      { category: "studio", amount: 200 },
      { category: "clip", amount: 80 },
      { category: "other", amount: 40 },
    ]);
  });

  it("un artiste : ses relevés, ses droits, ses dépenses — pas les frais de la structure", () => {
    const p = pnl({ ...input, scope: A1 });
    expect(p.totals).toMatchObject({ statements: 220, rights: 30, expenses: 200, net: 50 });
  });

  it("dernier mois connu des relevés, pour dire où s'arrêtent les revenus distributeur", () => {
    expect(pnl({ ...input, scope: "all" }).statementsUntil).toBe("2026-07");
    expect(pnl({ ...input, statements: [], scope: "all" }).statementsUntil).toBeNull();
  });

  it("sans revenus : marge inconnue (null), pas une division par zéro", () => {
    expect(pnl({ today: TODAY, statements: [], rights: [], expenses: [exp(A1, "2026-07-10", 10)], scope: "all" }).totals.margin).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { parsePayment, summarizePayments, type RightsPayment } from "../payment";

const ARTIST = "9693e109-1b8f-4269-ac0c-7e27b0576019";
const TODAY = "2026-09-28";

describe("parsePayment", () => {
  it("valide un versement ; montant à la française ; texte nettoyé", () => {
    expect(parsePayment({ artist_id: ARTIST, organism: "sacem", paid_on: "2026-07-05", amount_eur: "1 234,56", period_label: " Répartition juillet " }, TODAY)).toEqual({
      ok: true,
      value: { artist_id: ARTIST, organism: "sacem", paid_on: "2026-07-05", amount_eur: 1234.56, period_label: "Répartition juillet", notes: null },
    });
  });
  it("une régularisation négative est acceptée", () => {
    const r = parsePayment({ artist_id: ARTIST, organism: "adami", paid_on: "2026-07-05", amount_eur: "-45" }, TODAY);
    expect(r.ok && r.value.amount_eur).toBe(-45);
  });
  it("refuse avec un message clair", () => {
    const base = { artist_id: ARTIST, organism: "sacem", paid_on: "2026-07-05", amount_eur: "10" };
    expect(parsePayment({ ...base, organism: "pirate" }, TODAY)).toEqual({ ok: false, error: "Choisis l'organisme." });
    expect(parsePayment({ ...base, paid_on: "" }, TODAY)).toEqual({ ok: false, error: "Indique la date du versement." });
    expect(parsePayment({ ...base, paid_on: "2026-12-01" }, TODAY)).toEqual({ ok: false, error: "La date du versement est dans le futur." });
    expect(parsePayment({ ...base, amount_eur: "" }, TODAY)).toEqual({ ok: false, error: "Indique le montant reçu." });
    expect(parsePayment({ ...base, amount_eur: "douze" }, TODAY).ok).toBe(false);
  });
});

const pay = (organism: RightsPayment["organism"], paid_on: string, amount_eur: number): RightsPayment => ({
  id: `${organism}-${paid_on}`, updated_at: TODAY, artist_id: ARTIST, organism, paid_on, amount_eur, period_label: null, notes: null,
});

describe("summarizePayments", () => {
  const s = summarizePayments(
    [pay("sacem", "2025-10-05", 100), pay("sacem", "2026-01-05", 150), pay("sacem", "2026-04-05", 50), pay("adami", "2025-06-15", 300), pay("spedidam", "2026-03-01", 40)],
    TODAY,
  );
  it("totaux sur 12 mois et depuis toujours, par organisme et en tout", () => {
    expect(s.total12m).toBe(100 + 150 + 50 + 40);
    expect(s.totalAll).toBe(640);
    expect(s.byOrganism.find((o) => o.organism === "sacem")).toMatchObject({ total12m: 300, count: 3, last: { paid_on: "2026-04-05", amount_eur: 50 } });
  });
  it("par année civile", () => {
    expect(s.byYear).toEqual([
      { year: 2026, total: 240, byOrganism: { sacem: 200, spedidam: 40 } },
      { year: 2025, total: 400, byOrganism: { sacem: 100, adami: 300 } },
    ]);
  });
  it("organisme silencieux au-delà de son rythme habituel : signalé (SACEM > 4 mois, autres > 13 mois)", () => {
    expect(s.byOrganism.find((o) => o.organism === "sacem")?.stale).toEqual({ monthsSince: 5 });
    expect(s.byOrganism.find((o) => o.organism === "adami")?.stale).toEqual({ monthsSince: 15 });
    expect(s.byOrganism.find((o) => o.organism === "spedidam")?.stale).toBeNull();
  });
});

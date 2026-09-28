import { describe, expect, it } from "vitest";
import type { Split } from "@/lib/splits/split";
import type { SyncLicense } from "@/lib/registers/sync";
import type { Show } from "@/lib/registers/shows";
import { contractEndRisk, payoutsByPerson, recoupment, showEconomics, splitCoverage, syncStats } from "../business";

const TODAY = "2026-09-29";
const A = "9693e109-1b8f-4269-ac0c-7e27b0576019";

describe("recoupement calculé sur les relevés", () => {
  const rev = { "2026-01": 1000, "2026-02": 1000, "2026-03": 2000, "2026-04": 2000, "2026-05": 2000 };
  it("revenus depuis le début du contrat × taux ; reste ; mois restants au rythme des 3 derniers mois", () => {
    const r = recoupment({ advance_eur: 5000, royalty_rate: 20, starts_on: "2026-02-15", signed_on: null, recouped_eur: 1000 }, rev)!;
    // Depuis février : 1000 + 2000·3 = 7000 € ; × 20 % = 1400 € recoupés ; reste 3600 €
    expect(r.since).toBe("2026-02");
    expect(r.revenue).toBe(7000);
    expect(r.recouped).toBe(1400);
    expect(r.remaining).toBe(3600);
    // Rythme : moyenne des 3 derniers mois (2000) × 20 % = 400 €/mois → 9 mois
    expect(r.monthly).toBe(400);
    expect(r.monthsLeft).toBe(9);
    expect(r.gapWithDeclared).toBe(400); // 1400 calculés − 1000 saisis
  });
  it("avance entièrement recoupée → 0 mois ; sans avance ni taux → rien", () => {
    expect(recoupment({ advance_eur: 500, royalty_rate: 50, starts_on: null, signed_on: null, recouped_eur: null }, rev)).toMatchObject({ recouped: 500, remaining: 0, monthsLeft: 0, since: null });
    expect(recoupment({ advance_eur: null, royalty_rate: 20, starts_on: null, signed_on: null, recouped_eur: null }, rev)).toBeNull();
    expect(recoupment({ advance_eur: 500, royalty_rate: null, starts_on: null, signed_on: null, recouped_eur: null }, rev)).toBeNull();
  });
});

const split = (title: string, status: Split["status"], shares: [string, number][]): Split => ({
  id: title, updated_at: TODAY, artist_id: A, title, isrc: null, status, notes: null,
  shares: shares.map(([name, master]) => ({ name, role: "interprète", email: null, master, publishing: 0 })),
});

describe("ayants droit", () => {
  const revenue = { "titre a": 1000, "titre b": 500, "titre c": 250 };
  const splits = [split("Titre A", "agreed", [["Léa", 60], ["Max", 40]]), split("Titre B", "draft", [["Léa", 50], ["Sam", 50]]), split("Titre Z", "agreed", [["Max", 100]])];

  it("ce que touche chacun sur tout le catalogue ; les brouillons à part", () => {
    const p = payoutsByPerson(splits, revenue);
    expect(p.find((x) => x.name === "Léa")).toEqual({ name: "Léa", agreed: 600, draft: 250, titles: 2 });
    expect(p.find((x) => x.name === "Max")).toEqual({ name: "Max", agreed: 400, draft: 0, titles: 1 }); // Titre Z absent du relevé
    expect(p.find((x) => x.name === "Sam")).toEqual({ name: "Sam", agreed: 0, draft: 250, titles: 1 });
  });
  it("part des revenus couverte par un split validé / en brouillon / sans split", () => {
    expect(splitCoverage(splits, revenue)).toEqual({ agreed: 1000 / 1750, draft: 500 / 1750, none: 250 / 1750 });
  });
});

describe("sync", () => {
  const l = (status: SyncLicense["status"], over: Partial<SyncLicense> = {}): SyncLicense => ({
    id: status + (over.project ?? ""), updated_at: TODAY, artist_id: A, track_title: "T", project: "P", media: "pub", client: null, territory: null, term: null,
    fee_master_eur: 1000, fee_publishing_eur: null, status, signed_on: null, paid_on: null, notes: null, ...over,
  });
  it("taux de réussite (signées + payées sur conclues), délai de paiement, montant moyen par média", () => {
    const s = syncStats([
      l("paid", { signed_on: "2026-01-01", paid_on: "2026-03-02", fee_master_eur: 3000 }),
      l("signed", { media: "film", fee_master_eur: 5000 }),
      l("lost"),
      l("proposed"),
    ]);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.avgDaysToPay).toBe(60);
    expect(s.avgFeeByMedia).toEqual({ pub: 3000, film: 5000 });
  });
});

describe("concerts", () => {
  const show = (show_date: string, over: Partial<Show> = {}): Show => ({
    id: show_date, updated_at: TODAY, artist_id: A, show_date, city: "X", country: null, venue: null, capacity: null, tickets_sold: null, gross_eur: null, fee_eur: null, notes: null, ...over,
  });
  it("recette par billet, part du cachet dans la billetterie, marge de tournée sur 12 mois", () => {
    const e = showEconomics(
      [show("2026-05-01", { tickets_sold: 500, gross_eur: 10000, fee_eur: 2500 }), show("2026-06-01", { tickets_sold: 300, gross_eur: 6000, fee_eur: 1500 }), show("2025-01-01", { fee_eur: 9999 })],
      [{ category: "tour", spent_on: "2026-05-10", amount_eur: 1200 }, { category: "studio", spent_on: "2026-05-10", amount_eur: 999 }, { category: "tour", spent_on: "2025-02-01", amount_eur: 777 }],
      TODAY,
    );
    expect(e.perTicket).toBe(20); // 16 000 € / 800 billets
    expect(e.feeToGross).toBe(0.25); // 4 000 / 16 000
    expect(e.tourMargin12).toBe(2800); // 4 000 de cachets − 1 200 de frais de tournée
  });
});

describe("contrats qui arrivent à échéance", () => {
  it("part des revenus 12 mois des artistes dont un contrat finit dans les 180 jours (sans reconduction)", () => {
    const r = contractEndRisk(
      [
        { artist_id: "a1", kind: "artiste", ends_on: "2026-12-01", auto_renew: false },
        { artist_id: "a2", kind: "artiste", ends_on: "2026-11-01", auto_renew: true },
        { artist_id: "a3", kind: "booking", ends_on: "2026-10-01", auto_renew: false },
        { artist_id: "a4", kind: "licence", ends_on: "2027-12-01", auto_renew: false },
      ],
      { a1: 300, a2: 200, a3: 100, a4: 400 },
      TODAY,
    );
    expect(r.artists).toEqual([{ artistId: "a1", endsOn: "2026-12-01" }]);
    expect(r.share).toBeCloseTo(300 / 1000);
  });
});

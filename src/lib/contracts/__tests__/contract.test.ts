import { describe, expect, it } from "vitest";
import { contractTimeline, parseContract, type Contract } from "../contract";

const ARTIST = "9693e109-1b8f-4269-ac0c-7e27b0576019";
const base = { artist_id: ARTIST, kind: "licence", counterparty: "  Label X  " };

describe("parseContract", () => {
  it("le minimum : artiste, type, partenaire (nettoyé) ; le reste vide = null", () => {
    const r = parseContract(base);
    expect(r).toEqual({
      ok: true,
      value: {
        artist_id: ARTIST, kind: "licence", counterparty: "Label X", signed_on: null, starts_on: null, ends_on: null,
        notice_days: null, auto_renew: false, royalty_rate: null, advance_eur: null, recouped_eur: null, recouped_at: null,
        territory: null, exclusive: false, notes: null,
      },
    });
  });

  it("nombres à la française, cases cochées, dates", () => {
    const r = parseContract({
      ...base, royalty_rate: "18,5", advance_eur: "10 000", recouped_eur: "2500,50", notice_days: "90",
      auto_renew: "on", exclusive: "on", starts_on: "2025-01-01", ends_on: "2027-12-31",
    });
    expect(r.ok && r.value).toMatchObject({ royalty_rate: 18.5, advance_eur: 10000, recouped_eur: 2500.5, notice_days: 90, auto_renew: true, exclusive: true, ends_on: "2027-12-31" });
  });

  it("refuse avec un message clair", () => {
    expect(parseContract({ ...base, counterparty: " " })).toEqual({ ok: false, error: "Indique avec qui le contrat est signé." });
    expect(parseContract({ ...base, kind: "pirate" }).ok).toBe(false);
    expect(parseContract({ ...base, artist_id: "pas-un-id" }).ok).toBe(false);
    expect(parseContract({ ...base, ends_on: "2025-01-01", starts_on: "2026-01-01" })).toEqual({ ok: false, error: "La fin du contrat est avant son début." });
    expect(parseContract({ ...base, royalty_rate: "120" })).toEqual({ ok: false, error: "Le taux doit être entre 0 et 100 %." });
    expect(parseContract({ ...base, advance_eur: "1000", recouped_eur: "1500" })).toEqual({ ok: false, error: "Le montant recoupé dépasse l'avance." });
    expect(parseContract({ ...base, ends_on: "2026-02-31" })).toEqual({ ok: false, error: "Une date n'est pas valide." });
    expect(parseContract({ ...base, notes: "x".repeat(2001) }).ok).toBe(false);
  });
});

const contract = (over: Partial<Contract>): Contract => ({
  id: "c1", updated_at: "2026-09-28T10:00:00Z", artist_id: ARTIST, kind: "licence", counterparty: "Label X",
  signed_on: null, starts_on: "2024-01-01", ends_on: null, notice_days: null, auto_renew: false, royalty_rate: null,
  advance_eur: null, recouped_eur: null, recouped_at: null, territory: null, exclusive: false, notes: null, ...over,
});
const TODAY = "2026-09-28";

describe("contractTimeline", () => {
  it("sans date de fin : en cours, aucune échéance", () => {
    expect(contractTimeline(contract({}), TODAY)).toMatchObject({ status: "active", noticeDeadline: null, alerts: [] });
  });

  it("date limite de préavis = fin − préavis, signalée dans les 120 jours", () => {
    const t = contractTimeline(contract({ ends_on: "2027-01-31", notice_days: 90, auto_renew: true }), TODAY);
    expect(t.noticeDeadline).toBe("2026-11-02");
    expect(t.alerts).toContainEqual({ kind: "notice", date: "2026-11-02", daysLeft: 35 });
  });

  it("préavis encore loin : pas d'alerte de préavis", () => {
    const t = contractTimeline(contract({ ends_on: "2028-06-30", notice_days: 90 }), TODAY);
    expect(t.alerts).toEqual([]);
  });

  it("date limite de préavis passée, contrat pas encore fini : dit tel quel", () => {
    const t = contractTimeline(contract({ ends_on: "2026-12-31", notice_days: 180 }), TODAY);
    expect(t.alerts).toContainEqual({ kind: "notice-passed", date: "2026-07-04", daysLeft: -86 });
  });

  it("fin dans les 180 jours ; contrat fini ; contrat à venir", () => {
    expect(contractTimeline(contract({ ends_on: "2027-02-15" }), TODAY).alerts).toContainEqual({ kind: "ending", date: "2027-02-15", daysLeft: 140 });
    expect(contractTimeline(contract({ ends_on: "2026-06-30" }), TODAY)).toMatchObject({ status: "ended", alerts: [] });
    expect(contractTimeline(contract({ starts_on: "2027-01-01" }), TODAY).status).toBe("upcoming");
  });

  it("reste à recouper : avance − déjà recoupé (déclaré) ; sans avance, rien", () => {
    expect(contractTimeline(contract({ advance_eur: 10000, recouped_eur: 2500 }), TODAY).recoupRemaining).toBe(7500);
    expect(contractTimeline(contract({ advance_eur: 10000 }), TODAY).recoupRemaining).toBe(10000);
    expect(contractTimeline(contract({}), TODAY).recoupRemaining).toBeNull();
  });
});

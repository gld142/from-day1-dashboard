import { describe, expect, it } from "vitest";
import { parsePlacement, summarizePlacements, type Placement } from "../placements";
import { parseShow, summarizeShows, type Show } from "../shows";
import { parseSync, summarizeSync, type SyncLicense } from "../sync";

const A = "9693e109-1b8f-4269-ac0c-7e27b0576019";
const TODAY = "2026-09-28";

describe("concerts", () => {
  it("valide : pays en 2 lettres, montants à la française, jauge cohérente", () => {
    const r = parseShow({ artist_id: A, show_date: "2026-05-10", city: " Lyon ", country: "fr", capacity: "800", tickets_sold: "640", gross_eur: "12 800", fee_eur: "3500,50" });
    expect(r).toEqual({ ok: true, value: { artist_id: A, show_date: "2026-05-10", city: "Lyon", country: "FR", venue: null, capacity: 800, tickets_sold: 640, gross_eur: 12800, fee_eur: 3500.5, notes: null } });
    expect(parseShow({ artist_id: A, show_date: "2026-05-10", city: "Lyon", capacity: "100", tickets_sold: "150" })).toEqual({ ok: false, error: "Plus de billets vendus que de places." });
    expect(parseShow({ artist_id: A, show_date: "", city: "Lyon" })).toEqual({ ok: false, error: "Indique la date du concert." });
    expect(parseShow({ artist_id: A, show_date: "2026-05-10", city: "Lyon", country: "France" }).ok).toBe(false);
  });
  const show = (show_date: string, over: Partial<Show> = {}): Show => ({
    id: show_date, updated_at: TODAY, artist_id: A, show_date, city: "X", country: null, venue: null, capacity: null, tickets_sold: null, gross_eur: null, fee_eur: null, notes: null, ...over,
  });
  it("bilan : à venir, 12 derniers mois, remplissage sur les dates connues, cachets", () => {
    const s = summarizeShows([
      show("2026-10-05"),
      show("2026-05-10", { capacity: 800, tickets_sold: 640, gross_eur: 12800, fee_eur: 3500 }),
      show("2026-03-01", { capacity: 200, tickets_sold: 200, fee_eur: 900 }),
      show("2026-02-01", { fee_eur: 500 }),
      show("2025-06-01", { capacity: 100, tickets_sold: 10, fee_eur: 9999 }),
    ], TODAY);
    expect(s.upcoming.map((x) => x.show_date)).toEqual(["2026-10-05"]);
    expect(s.count12).toBe(3);
    expect(s.fill).toBeCloseTo(840 / 1000);
    expect(s.fillBase).toBe(2);
    expect(s.fees12).toBe(4900);
    expect(s.gross12).toBe(12800);
  });
});

describe("placements", () => {
  it("valide : au moins un rôle, date obligatoire si sortie", () => {
    const r = parsePlacement({ artist_id: A, title: "Titre", performer: "Interprète", status: "released", release_date: "2026-04-01", writer_share: "25", sacem_declared: "" }, ["auteur", "compositeur", "pirate"]);
    expect(r.ok && r.value).toMatchObject({ roles: ["auteur", "compositeur"], writer_share: 25, sacem_declared: false });
    expect(parsePlacement({ artist_id: A, title: "T", performer: "P", status: "released" }, ["auteur"])).toEqual({ ok: false, error: "Indique la date de sortie." });
    expect(parsePlacement({ artist_id: A, title: "T", performer: "P", status: "signed" }, [])).toEqual({ ok: false, error: "Coche au moins un rôle (auteur, compositeur, producteur)." });
  });
  const pl = (status: Placement["status"], over: Partial<Placement> = {}): Placement => ({
    id: status + Math.random(), updated_at: TODAY, artist_id: A, title: "T", performer: "P", roles: ["auteur"], writer_share: 20, producer_points: null, status, release_date: null, sacem_declared: true, notes: null, ...over,
  });
  it("bilan : carnet de commandes, sorties non déclarées à la SACEM (auteur/compositeur seulement)", () => {
    const s = summarizePlacements([
      pl("released"), pl("released", { sacem_declared: false }), pl("released", { sacem_declared: false, roles: ["producteur"], writer_share: null }),
      pl("signed"), pl("pitched", { writer_share: 40 }),
    ]);
    expect(s.released).toBe(3);
    expect(s.signed).toHaveLength(1);
    expect(s.pitched).toBe(1);
    expect(s.undeclared).toHaveLength(1);
    expect(s.avgWriterShare).toBeCloseTo((20 + 20 + 20 + 40) / 4);
  });
});

describe("sync", () => {
  it("valide : payée ⇒ date d'encaissement, pas dans le futur", () => {
    const base = { artist_id: A, track_title: "Titre", project: "Pub Marque", media: "pub", fee_master_eur: "5000", fee_publishing_eur: "5 000" };
    expect(parseSync({ ...base, status: "paid", paid_on: "2026-08-01" }, TODAY)).toMatchObject({ ok: true, value: { paid_on: "2026-08-01", fee_publishing_eur: 5000 } });
    expect(parseSync({ ...base, status: "paid" }, TODAY)).toEqual({ ok: false, error: "Indique la date d'encaissement." });
    expect(parseSync({ ...base, status: "paid", paid_on: "2026-12-01" }, TODAY)).toEqual({ ok: false, error: "La date d'encaissement est dans le futur." });
    expect(parseSync({ ...base, status: "signed", paid_on: "2026-08-01" }, TODAY)).toMatchObject({ ok: true, value: { paid_on: null } });
  });
  const lic = (status: SyncLicense["status"], master: number, paid_on: string | null = null): SyncLicense => ({
    id: status + master, updated_at: TODAY, artist_id: A, track_title: "T", project: "P", media: "pub", client: null, territory: null, term: null,
    fee_master_eur: master, fee_publishing_eur: master, status, signed_on: null, paid_on, notes: null,
  });
  it("bilan : encaissé sur 12 mois, signé non payé, pipeline", () => {
    const s = summarizeSync([lic("paid", 1000, "2026-08-01"), lic("paid", 700, "2025-01-01"), lic("signed", 500), lic("proposed", 300), lic("negotiating", 200), lic("lost", 999)], TODAY);
    expect(s).toEqual({ paid12: 2000, signedUnpaid: 1000, pipeline: 1000, open: 3 });
  });
});

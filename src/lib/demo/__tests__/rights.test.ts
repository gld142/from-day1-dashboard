/**
 * Relevés de droits FR (façade api.ts) : pour les artistes réels, l'attendu
 * SACEM sort de l'estimateur (part auteur de l'édition sur le brut master du
 * trimestre), les droits voisins suivent l'échelle du générateur, le reçu reste
 * simulé mais stable, et /audit reprend exactement les mêmes écarts.
 */
import { describe, expect, it } from "vitest";
import {
  ARTISTS,
  RIGHTS_PENDING_PERIOD,
  RIGHTS_PERIODS,
  auditFindings,
  dailyEstimates,
  hasReal,
  rightsStatements,
} from "@/lib/demo/api";
import {
  RIGHTS_ORGANISMS,
  RIGHTS_ORG_SCALE,
  rightsStatements as genRightsStatements,
  simulatedReceipt,
} from "@/lib/demo/generators";
import { AUTHOR_SHARE_OF_PUBLISHING, PUBLISHING_SHARE_OF_DSP } from "@/lib/real/params";

const quarterOf = (date: string) => `${date.slice(0, 4)}-T${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
const CLOSED = RIGHTS_PERIODS.filter((p) => p !== RIGHTS_PENDING_PERIOD);
/** Les seuls signalements issus des relevés de droits — /audit en mêle d'autres (écarts DSP, label). */
const ORGANISM_SOURCES = new Set(RIGHTS_ORGANISMS.map((o) => o.toUpperCase()));

/** Part auteur de l'édition sur le brut master estimé (mid) d'un trimestre. */
function publishingOfQuarter(artistId: string, period: string): number {
  const sum = dailyEstimates(artistId, 730)
    .filter((d) => quarterOf(d.date) === period)
    .reduce((s, d) => s + d.grossMaster.mid, 0);
  return Math.round(sum * PUBLISHING_SHARE_OF_DSP * AUTHOR_SHARE_OF_PUBLISHING);
}

describe("rightsStatements (artistes réels)", () => {
  const dadju = rightsStatements("dadju");
  const sacemOf = (period: string) => dadju.find((s) => s.organism === "sacem" && s.period === period)!;

  it("dadju : l'attendu SACEM d'un trimestre clos = somme de l'estimateur sur ses jours (± arrondi)", () => {
    expect(hasReal("dadju")).toBe(true);
    for (const period of CLOSED) {
      const s = sacemOf(period);
      expect(s.status).not.toBe("pending");
      expect(Math.abs(s.expected - publishingOfQuarter("dadju", period))).toBeLessThanOrEqual(1);
    }
    // Ordre de grandeur : garde-fou contre une erreur d'unité (× 100, / 100).
    for (const period of CLOSED) {
      expect(sacemOf(period).expected).toBeGreaterThan(50_000);
      expect(sacemOf(period).expected).toBeLessThan(300_000);
    }
  });

  it("dadju : ADAMI ≈ SACEM / 3, SPEDIDAM ≈ 0,6 × ADAMI, SPRE ≈ 0,4 × ADAMI (± 12 %)", () => {
    for (const period of RIGHTS_PERIODS) {
      const sacem = sacemOf(period).expected;
      for (const organism of ["adami", "spedidam", "spre"] as const) {
        const s = dadju.find((x) => x.organism === organism && x.period === period)!;
        const ratio = s.expected / ((sacem * RIGHTS_ORG_SCALE[organism]) / RIGHTS_ORG_SCALE.sacem);
        expect(ratio).toBeGreaterThanOrEqual(0.88 - 1e-3);
        expect(ratio).toBeLessThanOrEqual(1.12 + 1e-3);
      }
    }
  });

  it("le trimestre en cours de traitement reste « pending », sans reçu, pour les quatre organismes", () => {
    const pending = dadju.filter((s) => s.period === RIGHTS_PENDING_PERIOD);
    expect(pending).toHaveLength(4);
    for (const s of pending) {
      expect(s.status).toBe("pending");
      expect(s.received).toBe(0);
      expect(s.expected).toBeGreaterThan(0);
    }
    expect(dadju.filter((s) => s.status === "pending")).toHaveLength(4);
  });

  it("statuts, reçus et écarts sont déterministes entre deux appels, pour chaque artiste réel", () => {
    for (const a of ARTISTS) {
      const first = rightsStatements(a.id);
      const second = rightsStatements(a.id);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(first).toHaveLength(24);
      for (const s of first) {
        expect(s.received).toBeLessThanOrEqual(s.expected * 1.03 + 1);
        if (s.status === "gap-detected") expect(s.received).toBeLessThan(s.expected * 0.81);
        if (s.status === "received") expect(s.received).toBeGreaterThanOrEqual(s.expected * 0.93 - 1);
      }
    }
  });

  it("provenance : attendu « estimé », reçu « simulé » pour un artiste réel ; tout « simulé » chez le générateur", () => {
    for (const s of dadju) {
      expect(s.expectedProvenance).toBe("estimated");
      expect(s.receivedProvenance).toBe("simulated");
    }
    for (const s of genRightsStatements("dadju")) {
      expect(s.expectedProvenance).toBe("simulated");
      expect(s.receivedProvenance).toBe("simulated");
    }
  });

  it("le reçu simulé est seedé par (artiste, organisme, période) : même statut et même ratio si l'attendu bouge", () => {
    const a = simulatedReceipt("dadju", "sacem", "2025-T1", 100_000);
    const b = simulatedReceipt("dadju", "sacem", "2025-T1", 150_000);
    expect(b.status).toBe(a.status);
    expect(b.received / 150_000).toBeCloseTo(a.received / 100_000, 3);
    // Un autre trimestre ou un autre organisme tire sa propre séquence.
    expect(simulatedReceipt("dadju", "sacem", "2025-T1", 100_000).received).toBe(a.received);
    expect(simulatedReceipt("dadju", "sacem", "2025-T1", 100_000)).toEqual(a);
    expect(simulatedReceipt("dadju", "sacem", RIGHTS_PENDING_PERIOD, 100_000)).toEqual({ received: 0, status: "pending" });
  });

  it("/audit reprend les écarts de /rights à l'euro près (mêmes relevés)", () => {
    const gaps = dadju.filter((s) => s.status === "gap-detected");
    expect(gaps.length).toBeGreaterThan(0);
    // Filtré sur l'identité de l'organisme, pas sur la typographie du libellé :
    // le `source` d'un signalement est une donnée d'affichage, il a déjà changé.
    const findings = auditFindings("dadju").filter((f) => ORGANISM_SOURCES.has(f.source));
    expect(findings).toHaveLength(gaps.length);
    for (const [i, g] of gaps.entries()) {
      expect(findings[i].source).toBe(g.organism.toUpperCase());
      expect(findings[i].period).toBe(g.period);
      expect(findings[i].expected).toBe(g.expected);
      expect(findings[i].reported).toBe(g.received);
    }
    expect(findings[0].status).toBe("letter-generated");
  });
});

/**
 * Le KPI « Écarts détectés » de /rights, en vue structure, porte le total du
 * roster. Deux façons de le calculer, une seule est réclamable.
 */
describe("l'écart du roster se compte relevé par relevé", () => {
  const roster = ARTISTS.flatMap((a) => rightsStatements(a.id));
  const ecart = (ss: typeof roster) =>
    ss
      .filter((s) => s.status === "gap-detected")
      .reduce((t, s) => t + Math.max(0, s.expected - s.received), 0);

  it("le total du roster est la somme des écarts artiste par artiste", () => {
    const parArtiste = ARTISTS.map((a) => ecart(rightsStatements(a.id)));
    expect(parArtiste.every((v) => v >= 0)).toBe(true);
    expect(ecart(roster)).toBe(parArtiste.reduce((s, v) => s + v, 0));
    expect(ecart(roster)).toBeGreaterThan(0);
  });

  /**
   * Le piège que ce découpage évite. Agrégée par (organisme, période), une case
   * bascule en écart dès qu'UN artiste y est sous-versé ; son « attendu − reçu »
   * embarque alors les résidus des artistes normalement payés de la même case
   * (le reçu tourne autour de l'attendu sans le toucher). Le total enfle d'un
   * montant qu'on ne peut réclamer à personne — 7 314 € sur les données du
   * 24/09/2026, soit 4,6 % du total. Si cette marche venait à disparaître, ce
   * test le dirait : le commentaire de /rights n'aurait alors plus d'objet.
   */
  it("l'agrégat (organisme, période) enfle le total d'un résidu non attribuable", () => {
    const cases = new Map<string, { expected: number; received: number; gap: boolean }>();
    for (const s of roster) {
      const key = `${s.organism}:${s.period}`;
      const cur = cases.get(key) ?? { expected: 0, received: 0, gap: false };
      cur.expected += s.expected;
      cur.received += s.received;
      if (s.status === "gap-detected") cur.gap = true;
      cases.set(key, cur);
    }
    const agrege = Array.from(cases.values())
      .filter((c) => c.gap)
      .reduce((t, c) => t + Math.max(0, c.expected - c.received), 0);
    expect(agrege).toBeGreaterThan(ecart(roster));
  });

  it("/audit reprend le total du roster à l'euro près, sur les mêmes relevés", () => {
    const findings = ARTISTS.flatMap((a) => auditFindings(a.id)).filter((f) =>
      ORGANISM_SOURCES.has(f.source),
    );
    expect(findings).toHaveLength(roster.filter((s) => s.status === "gap-detected").length);
    expect(findings.reduce((t, f) => t + Math.max(0, f.expected - f.reported), 0)).toBe(
      ecart(roster),
    );
  });
});

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
  RIGHTS_ORG_SCALE,
  rightsStatements as genRightsStatements,
  simulatedReceipt,
} from "@/lib/demo/generators";
import { AUTHOR_SHARE_OF_PUBLISHING, PUBLISHING_SHARE_OF_DSP } from "@/lib/real/params";

const quarterOf = (date: string) => `${date.slice(0, 4)}-T${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
const CLOSED = RIGHTS_PERIODS.filter((p) => p !== RIGHTS_PENDING_PERIOD);

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
    const findings = auditFindings("dadju").filter((f) => !f.source.includes("·"));
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

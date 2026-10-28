import { describe, expect, it } from "vitest";
import { ARTISTS, estimateSummary, isComposer, isWriter, ownWorksFacts } from "@/lib/demo/api";
import { TENANT } from "@/lib/tenant";

/*
 * Maison d'édition (universal) : tout le roster est auteur ou compositeur (Gaël, 28/10/2026).
 * L'interprète y voit SES titres comme œuvres, avec les droits d'auteur de la page Revenus.
 */
describe("auteurs du roster", () => {
  it("un compositeur est toujours auteur ; un interprète l'est dans une maison d'édition", () => {
    for (const a of ARTISTS) {
      expect(isWriter(a.id)).toBe(isComposer(a.id) || TENANT.writersRoster);
    }
  });

  it("la maison universal compte tout son roster comme auteurs, la maison day1 non", () => {
    expect(TENANT.writersRoster).toBe(TENANT.id === "universal");
  });
});

describe("ownWorksFacts : les œuvres d'un auteur-interprète", () => {
  const performer = ARTISTS.find((a) => !isComposer(a.id))!;

  it("les droits d'auteur sont le chiffre de Revenus (même calcul, 12 mois)", () => {
    const facts = ownWorksFacts(performer.id);
    expect(facts.publishing).toBe(estimateSummary(performer.id, "year").publishing.mid);
    expect(facts.publishing).toBeGreaterThan(0);
  });

  it("titre par titre + reste du catalogue = le total, au prorata des streams", () => {
    const facts = ownWorksFacts(performer.id);
    const sum = facts.works.reduce((s, w) => s + w.publishing, 0) + facts.others;
    expect(sum).toBeCloseTo(facts.publishing, 6);
    const [a, b] = facts.works;
    if (a && b && b.streams > 0) expect(a.publishing / b.publishing).toBeCloseTo(a.streams / b.streams, 6);
  });
});

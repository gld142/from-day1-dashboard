import { describe, expect, it } from "vitest";
import { DEP_SPLIT, DR_SPLIT, EXPLOITATION_MIX, creatorsShare } from "../sacem";

describe("clés officielles de la Sacem (Règlement général 2026, Règles de répartition 2025)", () => {
  it("DEP par tiers (art. 57), DR 25/25/50", () => {
    expect(DEP_SPLIT.author + DEP_SPLIT.composer + DEP_SPLIT.publisher).toBeCloseTo(1);
    expect(DEP_SPLIT.publisher).toBeCloseTo(1 / 3);
    expect(DR_SPLIT).toEqual({ author: 0.25, composer: 0.25, publisher: 0.5 });
  });
  it("chaque exploitation se partage à 100 % entre DEP, DR et phono", () => {
    for (const [k, m] of Object.entries(EXPLOITATION_MIX)) expect(m.dep + m.dr + m.phono, k).toBeCloseTo(1);
    expect(EXPLOITATION_MIX.streaming_paid).toEqual({ dep: 0.5, dr: 0, phono: 0.5 });
    expect(EXPLOITATION_MIX.radio).toEqual({ dep: 0.67, dr: 0.33, phono: 0 });
  });
});

describe("part des créateurs (auteur + compositeur) — témoins calculés à la main", () => {
  const edited = { published: true, publisherPhonoShare: 0.5 };
  it("œuvre éditée, phono 50/50 du contrat", () => {
    expect(creatorsShare("streaming_paid", edited)).toBeCloseTo(0.5 * (2 / 3) + 0.5 * 0.5); // 58,33 %
    expect(creatorsShare("radio", edited)).toBeCloseTo(0.67 * (2 / 3) + 0.33 * 0.5); // 61,17 %
    expect(creatorsShare("tv", edited)).toBeCloseTo(0.75 * (2 / 3) + 0.25 * 0.5); // 62,5 %
    expect(creatorsShare("live", edited)).toBeCloseTo(2 / 3);
    expect(creatorsShare("download", edited)).toBeCloseTo(0.25 * (2 / 3) + 0.75 * 0.5); // 54,17 %
    expect(creatorsShare("physical", edited)).toBeCloseTo(0.5);
  });
  it("œuvre sans éditeur : les créateurs touchent la part de l'éditeur (art. 58 et 61)", () => {
    expect(creatorsShare("streaming_paid", { published: false })).toBe(1);
  });
  it("contrat d'édition plus favorable : éditeur à 25 % du phono", () => {
    expect(creatorsShare("streaming_paid", { published: true, publisherPhonoShare: 0.25 })).toBeCloseTo(0.5 * (2 / 3) + 0.5 * 0.75); // 70,83 %
    // DR : 50 % aux créateurs, sauf clé phono plus avantageuse (ici 75 %)
    expect(creatorsShare("radio", { published: true, publisherPhonoShare: 0.25 })).toBeCloseTo(0.67 * (2 / 3) + 0.33 * 0.75);
  });
  it("une clé phono moins favorable ne fait pas baisser la part DR sous 50 %", () => {
    expect(creatorsShare("radio", { published: true, publisherPhonoShare: 0.6 })).toBeCloseTo(0.67 * (2 / 3) + 0.33 * 0.5);
  });
});

import { describe, expect, it } from "vitest";
import { ARTISTS, DAS, getDa } from "@/lib/demo/data";
import { ARTIST_CATEGORIES, isArtistCategory } from "@/lib/demo/types";
import { TENANTS } from "@/lib/tenant";

describe("catégories et DA", () => {
  it("trois catégories, un DA par catégorie", () => {
    expect(ARTIST_CATEGORIES).toEqual(["urbain", "variete", "compositeur"]);
    expect(DAS.map((d) => d.category).sort()).toEqual([...ARTIST_CATEGORIES].sort());
    expect(new Set(DAS.map((d) => d.id)).size).toBe(DAS.length);
  });
  it("chaque artiste a une catégorie connue et le DA de sa catégorie", () => {
    for (const a of ARTISTS) {
      expect(isArtistCategory(a.category), a.id).toBe(true);
      const da = getDa(a.daId);
      expect(da, `${a.id} : DA ${a.daId} inconnu`).not.toBeNull();
      expect(da!.category, `${a.id} suit un DA d'une autre catégorie`).toBe(a.category);
    }
  });
  it("un compositeur est de la catégorie compositeur, et réciproquement", () => {
    for (const a of ARTISTS) expect(a.category === "compositeur", a.id).toBe(a.kind === "composer");
  });
  it("ids et teintes uniques", () => {
    expect(new Set(ARTISTS.map((a) => a.id)).size).toBe(ARTISTS.length);
    expect(new Set(ARTISTS.map((a) => a.hue)).size).toBe(ARTISTS.length);
  });
  it("getDa : null pour un id inconnu", () => {
    expect(getDa("da-nulle-part")).toBeNull();
  });
  it("l'artiste par défaut de chaque maison existe dans le roster complet", () => {
    for (const t of Object.values(TENANTS)) expect(ARTISTS.some((a) => a.id === t.defaultArtistId), t.id).toBe(true);
  });
});

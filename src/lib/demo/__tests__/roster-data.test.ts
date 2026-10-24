import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_ARTISTS, ARTISTS, CONTRACTS, DAS, PROJECTS, TEAM, getDa } from "@/lib/demo/data";
import { ARTIST_CATEGORIES, isArtistCategory } from "@/lib/demo/types";
import { TENANTS } from "@/lib/tenant";

type Seed = { id: string; spotifyId?: string; deezerId?: string; youtubeChannelId?: string };
const SEEDS: Seed[] = JSON.parse(readFileSync(new URL("../../../../scripts/artists.json", import.meta.url), "utf8"));

describe("catégories et DA", () => {
  it("trois catégories, un DA par catégorie", () => {
    expect(ARTIST_CATEGORIES).toEqual(["urbain", "variete", "compositeur"]);
    expect(DAS.map((d) => d.category).sort()).toEqual([...ARTIST_CATEGORIES].sort());
    expect(new Set(DAS.map((d) => d.id)).size).toBe(DAS.length);
  });
  it("chaque artiste a une catégorie connue et le DA de sa catégorie", () => {
    for (const a of ALL_ARTISTS) {
      expect(isArtistCategory(a.category), a.id).toBe(true);
      const da = getDa(a.daId);
      expect(da, `${a.id} : DA ${a.daId} inconnu`).not.toBeNull();
      expect(da!.category, `${a.id} suit un DA d'une autre catégorie`).toBe(a.category);
    }
  });
  it("un compositeur est de la catégorie compositeur, et réciproquement", () => {
    for (const a of ALL_ARTISTS) expect(a.category === "compositeur", a.id).toBe(a.kind === "composer");
  });
  it("ids et teintes uniques", () => {
    expect(new Set(ALL_ARTISTS.map((a) => a.id)).size).toBe(ALL_ARTISTS.length);
    expect(new Set(ALL_ARTISTS.map((a) => a.hue)).size).toBe(ALL_ARTISTS.length);
  });
  it("getDa : null pour un id inconnu", () => {
    expect(getDa("da-nulle-part")).toBeNull();
  });
  it("l'artiste par défaut de chaque maison existe dans le roster complet", () => {
    for (const t of Object.values(TENANTS)) expect(ALL_ARTISTS.some((a) => a.id === t.defaultArtistId), t.id).toBe(true);
  });
});

describe("le roster complet et la maison", () => {
  it("douze artistes, sept urbain, deux variété, trois compositeurs", () => {
    expect(ALL_ARTISTS).toHaveLength(12);
    const count = (c: string) => ALL_ARTISTS.filter((a) => a.category === c).length;
    expect([count("urbain"), count("variete"), count("compositeur")]).toEqual([7, 2, 3]);
  });
  it("day1 (défaut) : onze artistes, Kiko absent, Dadju présent", () => {
    expect(ARTISTS).toHaveLength(11);
    expect(ARTISTS.map((a) => a.id)).not.toContain("kiko");
    expect(ARTISTS.map((a) => a.id)).toContain("dadju");
  });
  it("tout ce qui dérive du roster suit l'exclusion", () => {
    const ids = new Set(ARTISTS.map((a) => a.id));
    for (const p of PROJECTS) expect(ids.has(p.artistId), p.id).toBe(true);
    for (const c of CONTRACTS) expect(ids.has(c.artistId), c.id).toBe(true);
    for (const m of TEAM) if (Array.isArray(m.artistAccess)) for (const id of m.artistAccess) expect(ids.has(id), m.id).toBe(true);
  });
});

describe("scripts/artists.json — le relevé quotidien lit les mêmes identifiants", () => {
  it("chaque artiste du roster complet y figure, avec les mêmes ids", () => {
    for (const a of ALL_ARTISTS) {
      const s = SEEDS.find((x) => x.id === a.id);
      expect(s, `${a.id} absent de scripts/artists.json`).toBeDefined();
      expect(s!.spotifyId ?? undefined).toBe(a.spotifyId);
      expect(s!.deezerId ?? undefined).toBe(a.deezerId);
      expect(s!.youtubeChannelId ?? undefined).toBe(a.youtubeChannelId);
    }
  });
  it("les ids ont la forme attendue (Spotify : 22 caractères base62 ; Deezer : chiffres ; YouTube : UC…)", () => {
    for (const a of ALL_ARTISTS) {
      if (a.spotifyId) expect(a.spotifyId, a.id).toMatch(/^[0-9A-Za-z]{22}$/);
      if (a.deezerId) expect(a.deezerId, a.id).toMatch(/^\d+$/);
      if (a.youtubeChannelId) expect(a.youtubeChannelId, a.id).toMatch(/^UC[0-9A-Za-z_-]{22}$/);
    }
  });
});

describe("maison universal", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("onze artistes, Dadju absent, Kiko présent, LABEL au nom de la maison", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT", "universal");
    vi.resetModules();
    const data = await import("@/lib/demo/data");
    expect(data.ARTISTS).toHaveLength(11);
    expect(data.ARTISTS.map((a) => a.id)).not.toContain("dadju");
    expect(data.ARTISTS.map((a) => a.id)).toContain("kiko");
    expect(data.LABEL.name).toBe("Day One × Universal");
    expect(data.CONTRACTS.map((c) => c.artistId)).not.toContain("dadju");
  });
  it("le repli de discovery et de position algo ne cite pas Dadju", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT", "universal");
    vi.resetModules();
    const { demosFor } = await import("@/components/modules/algo/discovery-data");
    const { scenarioFor } = await import("@/components/modules/pilotage/algo-trend-panel");
    // Leto n'a ni inédits ni scénario propres : il reçoit le repli de la maison.
    const titles = demosFor("leto").map((d) => d.title);
    expect(titles.length).toBeGreaterThan(0);
    for (const t of ["Éclipse totale", "Peau neuve", "Minuit moins le quart", "Apnée", "Lumière noire"]) expect(titles).not.toContain(t);
    const fallback = scenarioFor("leto");
    expect(fallback.sound).not.toBe("Reine");
    // Mêmes placements que le premier artiste du roster qui a un scénario (Nono), pas ceux de Dadju.
    expect(fallback.placements).toEqual(scenarioFor("nono-la-grinta").placements);
    expect(fallback.placements).not.toEqual(scenarioFor("dadju").placements);
  });
});

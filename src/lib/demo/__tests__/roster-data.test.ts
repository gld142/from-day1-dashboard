import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_ARTISTS,
  ALL_CONTRACTS,
  ALL_PLACEMENTS,
  DAS,
  PROJECT_SEEDS,
  SPLITS,
  TRACKS,
  getDa,
} from "@/lib/demo/data";
import { ARTIST_CATEGORIES, isArtistCategory } from "@/lib/demo/types";
import { SNAPSHOTS } from "@/lib/real/snapshots";
import { TENANTS, type TenantId } from "@/lib/tenant";

type Seed = { id: string; spotifyId?: string; deezerId?: string; youtubeChannelId?: string };
const SEEDS: Seed[] = JSON.parse(readFileSync(new URL("../../../../scripts/artists.json", import.meta.url), "utf8"));

/* La maison est lue AU CHARGEMENT de data.ts (NEXT_PUBLIC_TENANT). Pour tester les deux
   maisons dans un même processus, on stubbe la variable et on recharge le module : les
   imports statiques ci-dessus restent ceux de la maison du processus, et ne servent
   qu'aux assertions indépendantes de la maison (roster complet, tables complètes). */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadHouse(id: TenantId) {
  vi.stubEnv("NEXT_PUBLIC_TENANT", id);
  vi.resetModules();
  return import("@/lib/demo/data");
}

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

describe("le roster complet", () => {
  it("douze artistes, sept urbain, deux variété, trois compositeurs", () => {
    expect(ALL_ARTISTS).toHaveLength(12);
    const count = (c: string) => ALL_ARTISTS.filter((a) => a.category === c).length;
    expect([count("urbain"), count("variete"), count("compositeur")]).toEqual([7, 2, 3]);
  });
});

/*
 * Les tables complètes (contrats, placements, graines de projets) sont écrites à la main
 * avec l'id de l'artiste en clair. Une faute de frappe (« brice-davolli ») ne casse rien
 * au chargement : `inRoster` ne reconnaît pas l'id, la ligne disparaît silencieusement de
 * la maison. MESURÉ le 24/10/2026 : avec cette faute dans `c-bd-edition`, les 13 tests
 * du fichier restaient verts. D'où ce filet : chaque artistId cité est un artiste du
 * roster complet.
 */
describe("intégrité des tables complètes : chaque artistId est un artiste d'ALL_ARTISTS", () => {
  const ids = new Set(ALL_ARTISTS.map((a) => a.id));
  it("ALL_CONTRACTS", () => {
    for (const c of ALL_CONTRACTS) expect(ids.has(c.artistId), `contrat ${c.id} : artistId « ${c.artistId} » inconnu`).toBe(true);
  });
  it("ALL_PLACEMENTS", () => {
    for (const p of ALL_PLACEMENTS) expect(ids.has(p.artistId), `placement ${p.id} : artistId « ${p.artistId} » inconnu`).toBe(true);
  });
  it("clés de PROJECT_SEEDS", () => {
    for (const id of Object.keys(PROJECT_SEEDS)) expect(ids.has(id), `PROJECT_SEEDS : clé « ${id} » inconnue`).toBe(true);
  });
  it("TRACKS et SPLITS (via le titre du split)", () => {
    for (const t of TRACKS) expect(ids.has(t.artistId), `titre ${t.id} : artistId « ${t.artistId} » inconnu`).toBe(true);
    const artistOfTrack = new Map(TRACKS.map((t) => [t.id, t.artistId]));
    for (const s of SPLITS) {
      const artistId = artistOfTrack.get(s.trackId);
      expect(artistId, `split ${s.trackId} : titre inconnu`).toBeDefined();
      expect(ids.has(artistId!), `split ${s.trackId} : artistId « ${artistId} » inconnu`).toBe(true);
    }
  });
});

describe.each(Object.values(TENANTS))("maison $id", (tenant) => {
  const excluded = new Set(tenant.excludedArtists);
  const keep = <T extends { artistId: string }>(list: T[]) => list.filter((x) => !excluded.has(x.artistId));

  it("le roster complet moins ses exclus ; l'artiste par défaut présent ; LABEL au nom de la maison", async () => {
    const data = await loadHouse(tenant.id);
    const ids = data.ARTISTS.map((a) => a.id);
    expect(ids).toEqual(ALL_ARTISTS.map((a) => a.id).filter((id) => !excluded.has(id)));
    expect(data.ARTISTS).toHaveLength(ALL_ARTISTS.length - tenant.excludedArtists.length);
    for (const id of tenant.excludedArtists) expect(ids).not.toContain(id);
    expect(ids).toContain(tenant.defaultArtistId);
    expect(data.LABEL.name).toBe(tenant.name);
  });

  it("CONTRACTS, PLACEMENTS, PROJECTS = la table complète moins les exclus, rien d'autre", async () => {
    const data = await loadHouse(tenant.id);
    expect(data.CONTRACTS).toEqual(keep(data.ALL_CONTRACTS));
    expect(data.PLACEMENTS).toEqual(keep(data.ALL_PLACEMENTS));
    const seedEntries = Object.entries(data.PROJECT_SEEDS).filter(([id]) => !excluded.has(id));
    expect(new Set(data.PROJECTS.map((p) => p.artistId))).toEqual(new Set(seedEntries.map(([id]) => id)));
    expect(data.PROJECTS).toHaveLength(seedEntries.reduce((s, [, seeds]) => s + seeds.length, 0));
    expect(data.PROJECTS.map((p) => p.id)).toEqual(seedEntries.flatMap(([, seeds]) => seeds.map((s) => s.id)));
  });

  it("tout ce qui dérive du roster suit l'exclusion", async () => {
    const data = await loadHouse(tenant.id);
    const ids = new Set(data.ARTISTS.map((a) => a.id));
    for (const p of data.PROJECTS) expect(ids.has(p.artistId), p.id).toBe(true);
    for (const t of data.TRACKS) expect(ids.has(t.artistId), t.id).toBe(true);
    for (const c of data.CONTRACTS) expect(ids.has(c.artistId), c.id).toBe(true);
    for (const p of data.PLACEMENTS) expect(ids.has(p.artistId), p.id).toBe(true);
    for (const m of data.TEAM) if (Array.isArray(m.artistAccess)) for (const id of m.artistAccess) expect(ids.has(id), m.id).toBe(true);
  });

  /*
   * Discovery : `discovery/page.tsx` lit `demos[0].score` sans garde — chaque artiste de la
   * maison doit donc avoir au moins un inédit. Et un artiste sans inédits propres reçoit des
   * inédits SIMULÉS qui lui appartiennent : avant (mesuré le 24/10/2026), les huit artistes
   * sans inédits recevaient les cinq de Dadju (universal : ceux de Nono), et « Éclipse
   * totale » était le meilleur inédit de quatre artistes différents en vue label.
   */
  it("discovery : chaque artiste a des inédits, classés sans égalité ; les simulés sont propres à l'artiste et plausibles", async () => {
    const data = await loadHouse(tenant.id);
    const { demosFor, hasOwnDemos } = await import("@/components/modules/algo/discovery-data");
    const ids = data.ARTISTS.map((a) => a.id);
    const placeholders = ids.filter((id) => !hasOwnDemos(id));
    expect(placeholders.length, "au moins deux artistes sans inédits propres pour comparer").toBeGreaterThanOrEqual(2);

    const seen = new Map<string, string>();
    for (const id of ids) {
      const demos = demosFor(id);
      expect(demos.length, `${id} : aucun inédit`).toBeGreaterThan(0);
      expect(new Set(demos.map((d) => d.score)).size, `${id} : deux inédits au même score`).toBe(demos.length);
      expect(demos.map((d) => d.rank)).toEqual(demos.map((_, i) => i + 1));
      for (const d of demos) {
        expect(seen.get(d.title), `« ${d.title} » apparaît chez ${seen.get(d.title)} et chez ${id}`).toBeUndefined();
        seen.set(d.title, id);
      }
    }
    // Les simulés ne reprennent jamais un inédit réel, ni ceux d'un artiste exclu de la maison.
    const foreign = new Set([...ids.filter(hasOwnDemos), ...tenant.excludedArtists].flatMap((id) => demosFor(id).map((d) => d.title)));
    for (const id of placeholders) for (const d of demosFor(id)) expect(foreign.has(d.title), `${id} : « ${d.title} » est l'inédit d'un autre artiste`).toBe(false);
    // Deux artistes simulés n'ont pas les mêmes titres.
    expect(demosFor(placeholders[0]).map((d) => d.title)).not.toEqual(demosFor(placeholders[1]).map((d) => d.title));
    // BPM plausible pour la catégorie.
    const bpmRange = { urbain: [85, 140], variete: [70, 120], compositeur: [60, 110] } as const;
    for (const id of placeholders) {
      const artist = data.ARTISTS.find((a) => a.id === id)!;
      const [lo, hi] = bpmRange[artist.category];
      for (const d of demosFor(id)) {
        expect(d.bpm, `${id} : ${d.title} à ${d.bpm} BPM`).toBeGreaterThanOrEqual(lo);
        expect(d.bpm, `${id} : ${d.title} à ${d.bpm} BPM`).toBeLessThanOrEqual(hi);
        expect(d.durationSec).toBeGreaterThan(0);
        expect(d.key).toMatch(/^[A-G][#b]?m?$/);
      }
    }
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

/*
 * La couche réelle apparie les titres du relevé aux titres des projets par ÉGALITÉ
 * STRICTE (real-source.ts : `t.title === title`, dans releaseDateOf et realTopTracks).
 * Un titre abrégé à la main (« Avenir » pour « Avenir - Radio Edit ») n'est jamais
 * retrouvé — et chez Louane, Kworb liste aussi un « Avenir » distinct : l'abréviation
 * lierait la mauvaise version. Pour les six artistes arrivés au relevé du 24/10/2026,
 * chaque titre de PROJECT_SEEDS doit donc exister tel quel dans les top titres Spotify
 * d'un de leurs relevés.
 */
describe("titres des projets = titres du relevé, à la lettre", () => {
  const NEW_SIX = ["leto", "dakeez", "louane", "wamen", "gustave-rudman", "brice-davoli"];
  it.each(NEW_SIX)("%s : chaque titre de PROJECT_SEEDS figure parmi les top titres Spotify relevés", (id) => {
    const snaps = SNAPSHOTS[id] ?? [];
    expect(snaps.length, `${id} : aucun relevé`).toBeGreaterThan(0);
    const measured = new Set(snaps.flatMap((s) => s.spotify.topTracks.map((t) => t.name)));
    const seeds = PROJECT_SEEDS[id];
    expect(seeds, `${id} : aucune graine de projet`).toBeDefined();
    for (const seed of seeds) for (const title of seed.tracks) {
      expect(measured.has(title), `${id} : « ${title} » absent du relevé — titres relevés : ${[...measured].join(" | ")}`).toBe(true);
    }
  });
});

/**
 * Couche marché (market.ts) sur une fixture de 6 titres : parts par groupe /
 * artiste / genre, métrique jour ou 7 jours, groupe d'un artiste, méta,
 * lecture du matin et présence du roster.
 */
import { describe, expect, it } from "vitest";
import {
  groupOf,
  marketDates,
  marketMeta,
  marketSnapshot,
  morningReading,
  rosterPresence,
  rosterTrackCount,
  sharesBy,
  type MarketSnapshots,
} from "../market";
import type { MarketSnapshot, MarketTrack } from "../types";

const track = (over: Partial<MarketTrack> & Pick<MarketTrack, "rank" | "artist" | "title" | "streams">): MarketTrack => ({
  delta: 0,
  trackId: `id${over.rank}`,
  artistId: null,
  featuring: [],
  days: 10,
  peak: over.rank,
  peakDays: null,
  streamsDelta: 0,
  streams7d: over.streams * 7,
  streams7dDelta: 0,
  total: over.streams * 100,
  label: { lines: ["℗ 2026 X"], group: "other", provenance: "measured", evidence: "℗ 2026 X" },
  genre: "rap",
  ...over,
});

const snap = (date: string, tracks: MarketTrack[]): MarketSnapshot => ({
  date,
  capturedAt: `${date}T06:00:00.000Z`,
  chartDate: null,
  country: "FR",
  source: "fixture",
  tracks,
});

/* Total jour = 1000 ; 7 jours = 7000 sauf le titre 1 (Dadju) qui pèse 2× plus sur 7 jours. */
const TRACKS: MarketTrack[] = [
  track({
    rank: 1,
    artist: "Dadju",
    title: "Reine",
    streams: 400,
    streams7d: 5600,
    artistId: "4sbXXFzEWJY2zsZjelerjX",
    genre: "rnb",
    label: { lines: ["℗ Polydor"], group: "universal", provenance: "measured", evidence: "℗ Polydor" },
  }),
  track({
    rank: 2,
    artist: "Ninho",
    title: "Lettre à une femme",
    streams: 250,
    streams7d: 1750,
    label: { lines: ["℗ Rec. 118"], group: "warner", provenance: "measured", evidence: "℗ Rec. 118" },
  }),
  track({
    rank: 3,
    artist: "Ninho",
    title: "Jefe",
    streams: 150,
    streams7d: 1050,
    label: { lines: ["℗ Rec. 118"], group: "warner", provenance: "measured", evidence: "℗ Rec. 118" },
  }),
  track({
    rank: 4,
    artist: "Werenoi",
    title: "Pyramide",
    streams: 100,
    streams7d: 700,
    label: { lines: ["℗ AllPoints"], group: "believe", provenance: "measured", evidence: "℗ AllPoints" },
  }),
  track({
    rank: 5,
    artist: "Kiko",
    title: "Odjo",
    streams: 60,
    streams7d: 420,
    genre: "afro",
    featuring: ["Nono La Grinta"],
  }),
  track({
    rank: 6,
    artist: "Mystère",
    title: "Sans page",
    streams: 40,
    streams7d: 280,
    genre: "unknown",
    label: { lines: [], group: "unknown", provenance: "estimated", evidence: null },
  }),
];

const SNAPS: MarketSnapshots = {
  "2026-09-16": snap("2026-09-16", TRACKS.slice(0, 2)),
  "2026-09-17": snap("2026-09-17", TRACKS),
};

describe("marketSnapshot / marketDates", () => {
  it("sert le relevé le plus récent par défaut, une date précise sinon, null sans relevé", () => {
    expect(marketSnapshot(undefined, SNAPS)?.date).toBe("2026-09-17");
    expect(marketSnapshot("2026-09-16", SNAPS)?.tracks).toHaveLength(2);
    expect(marketSnapshot("2020-01-01", SNAPS)).toBeNull();
    expect(marketSnapshot(undefined, {})).toBeNull();
    expect(marketDates(SNAPS)).toEqual(["2026-09-16", "2026-09-17"]);
  });
});

describe("sharesBy", () => {
  it("groupe : lignes triées par streams, parts 0-1 sommant à 1, meilleur titre et nombre de titres", () => {
    const rows = sharesBy("group", {}, SNAPS);
    expect(rows.map((r) => r.key)).toEqual(["universal", "warner", "believe", "other", "unknown"]);
    expect(rows[0]).toMatchObject({ key: "universal", streams: 400, share: 0.4, tracks: 1, provenance: "measured" });
    expect(rows[1]).toMatchObject({ key: "warner", streams: 400, share: 0.4, tracks: 2 });
    expect(rows[1].topTrack).toEqual({ rank: 2, artist: "Ninho", title: "Lettre à une femme", streams: 250 });
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
    // Le titre sans label lu tire la provenance de sa ligne vers « estimé ».
    expect(rows.find((r) => r.key === "unknown")?.provenance).toBe("estimated");
  });

  it("à streams égaux, l'ordre est alphabétique (stable)", () => {
    const rows = sharesBy("group", {}, SNAPS);
    expect(rows[0].key).toBe("universal");
    expect(rows[1].key).toBe("warner");
  });

  it("métrique 7 jours : parts recalculées sur streams7d", () => {
    const rows = sharesBy("group", { metric: "streams7d" }, SNAPS);
    // Universal : 5600 / (5600 + 2800 + 700 + 420 + 280) = 5600 / 9800
    expect(rows[0]).toMatchObject({ key: "universal", streams: 5600 });
    expect(rows[0].share).toBeCloseTo(5600 / 9800, 10);
    expect(rows[0].topTrack?.streams).toBe(5600);
  });

  it("delta7d = part du jour − part 7 jours, en points, quel que soit le métrique", () => {
    const day = sharesBy("group", {}, SNAPS).find((r) => r.key === "universal")!;
    const week = sharesBy("group", { metric: "streams7d" }, SNAPS).find((r) => r.key === "universal")!;
    const expected = (0.4 - 5600 / 9800) * 100;
    expect(day.delta7d).toBeCloseTo(expected, 10);
    expect(week.delta7d).toBeCloseTo(expected, 10);
  });

  it("artiste : par artiste principal, provenance mesurée", () => {
    const rows = sharesBy("artist", {}, SNAPS);
    expect(rows[0]).toMatchObject({ key: "Dadju", label: "Dadju", streams: 400, tracks: 1, provenance: "measured" });
    expect(rows[1]).toMatchObject({ key: "Ninho", streams: 400, tracks: 2 });
    expect(rows).toHaveLength(5);
  });

  it("genre : renseigné, sauf la ligne « unknown » (estimée)", () => {
    const rows = sharesBy("genre", {}, SNAPS);
    expect(rows.map((r) => r.key)).toEqual(["rap", "rnb", "afro", "unknown"]);
    expect(rows[0]).toMatchObject({ streams: 500, share: 0.5, provenance: "declared" });
    expect(rows[3]).toMatchObject({ key: "unknown", provenance: "estimated" });
  });

  it("within : sous-lignes restreintes au parent, parts toujours rapportées au Top 200 entier", () => {
    const rows = sharesBy("artist", { within: [{ dim: "group", key: "warner" }] }, SNAPS);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "Ninho", streams: 400, share: 0.4, tracks: 2 });
    const deep = sharesBy("genre", { within: [{ dim: "group", key: "other" }, { dim: "artist", key: "Kiko" }] }, SNAPS);
    expect(deep).toEqual([expect.objectContaining({ key: "afro", streams: 60, share: 0.06, tracks: 1 })]);
    expect(sharesBy("artist", { within: [{ dim: "group", key: "sony" }] }, SNAPS)).toEqual([]);
  });

  it("date précise et relevé absent", () => {
    expect(sharesBy("group", { date: "2026-09-16" }, SNAPS)).toHaveLength(2);
    expect(sharesBy("group", { date: "2020-01-01" }, SNAPS)).toEqual([]);
    expect(sharesBy("artist", {}, {})).toEqual([]);
  });
});

describe("groupOf", () => {
  it("groupe qui porte le plus de streams de l'artiste, insensible à la casse ; null si absent", () => {
    expect(groupOf("ninho", undefined, SNAPS)).toBe("warner");
    expect(groupOf("Dadju", undefined, SNAPS)).toBe("universal");
    expect(groupOf("Inconnu", undefined, SNAPS)).toBeNull();
  });
});

describe("marketMeta", () => {
  it("compte titres, artistes, labels non lus et genres non renseignés", () => {
    expect(marketMeta(undefined, SNAPS)).toEqual({
      date: "2026-09-17",
      capturedAt: "2026-09-17T06:00:00.000Z",
      chartDate: null,
      source: "fixture",
      tracks: 6,
      artists: 5,
      unknownLabels: 1,
      unknownGenres: 1,
    });
    expect(marketMeta(undefined, {})).toBeNull();
  });
});

describe("rosterPresence / morningReading", () => {
  const ROSTER = [
    { id: "dadju", name: "Dadju", spotifyId: "4sbXXFzEWJY2zsZjelerjX" },
    { id: "nono-la-grinta", name: "Nono La Grinta" },
    { id: "kiko", name: "Kiko", spotifyId: "4P2zZ1OLqeeKDLXc34Yfsv" },
    { id: "absent", name: "Personne" },
  ];

  it("repère le roster par identifiant Spotify, par nom (principal ou invité), et signale les absents", () => {
    expect(rosterPresence(ROSTER, TRACKS)).toEqual([
      { id: "dadju", name: "Dadju", tracks: 1, featured: 0, bestRank: 1, bestTitle: "Reine" },
      // Nono n'est qu'invité sur « Odjo » : le titre compte, mais comme featuring.
      { id: "nono-la-grinta", name: "Nono La Grinta", tracks: 1, featured: 1, bestRank: 5, bestTitle: "Odjo" },
      // Kiko : identifiant Spotify absent du relevé mais le nom correspond.
      { id: "kiko", name: "Kiko", tracks: 1, featured: 0, bestRank: 5, bestTitle: "Odjo" },
      { id: "absent", name: "Personne", tracks: 0, featured: 0, bestRank: null, bestTitle: null },
    ]);
  });

  it("compte les titres DISTINCTS du roster — un titre partagé ne compte qu'une fois", () => {
    // « Odjo » réunit Kiko (principal) et Nono (invité) ; « Reine » est à Dadju.
    // Additionner les lignes donnerait 3 ; les titres distincts sont 2.
    expect(rosterPresence(ROSTER, TRACKS).reduce((s, r) => s + r.tracks, 0)).toBe(3);
    expect(rosterTrackCount(ROSTER, TRACKS)).toBe(2);
  });

  it("compte le featuring même quand l'artiste n'est jamais principal", () => {
    const seulementInvite = [{ id: "nono-la-grinta", name: "Nono La Grinta" }];
    expect(rosterTrackCount(seulementInvite, TRACKS)).toBe(1);
  });

  it("lecture du matin : majors ordonnées, indés, autres, sans label, genres, leader — estimée", () => {
    const r = morningReading(ROSTER, undefined, SNAPS)!;
    expect(r.majors.map((m) => m.group)).toEqual(["universal", "warner", "sony"]);
    expect(r.majors[0].share).toBeCloseTo(40, 10);
    expect(r.majors[2]).toEqual({ group: "sony", share: 0, delta7d: 0 });
    expect(r.indies.share).toBeCloseTo(10, 10);
    expect(r.other.share).toBeCloseTo(6, 10);
    expect(r.unknown).toEqual({ share: 4, tracks: 1 });
    expect(r.genres).toEqual({ rap: 50, top: "rap", topShare: 50 });
    expect(r.leader).toEqual({ rank: 1, artist: "Dadju", title: "Reine", streams: 400 });
    expect(r.roster).toHaveLength(4);
    expect(r.provenance).toBe("estimated");
  });

  it("null sans relevé", () => {
    expect(morningReading(ROSTER, undefined, {})).toBeNull();
  });
});

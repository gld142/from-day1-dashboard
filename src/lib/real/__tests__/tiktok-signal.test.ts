import { describe, expect, it } from "vitest";
import { tiktokSignal } from "@/lib/real/tiktok-signal";
import { SNAPSHOTS } from "@/lib/real/snapshots";
import type { Snapshot } from "@/lib/real/types";

const TODAY = new Date("2026-09-16T00:00:00Z");

/* ─── Fixtures ─── */

/** Dadju sans relevé TikTok : la branche simulée s'appuie sur ses titres Kworb. */
const dadjuNoTiktok: Snapshot = {
  date: "2026-09-16",
  spotify: {
    monthlyListeners: 6_473_478,
    followers: null,
    topTracks: [{ name: "Reine", spotifyId: null, playcount: 228_869_436 }],
  },
  kworb: {
    totalStreams: 4_633_277_280,
    dailyStreams: 150_000,
    tracks: [
      { name: "Reine", total: 228_869_436, daily: 82_112 },
      { name: "Meleğim", total: 206_422_360, daily: 55_787 },
    ],
  },
  deezer: null,
  youtube: null,
  topCities: null,
};

/** Relevé TikTok mesuré : 120 k + 30 k = 150 k vidéos, rang 14 en France. */
const dadjuMeasured: Snapshot = {
  ...dadjuNoTiktok,
  tiktok: {
    sounds: [
      { name: "Reine", videoCount: 120_000, url: null },
      { name: "Jaloux", videoCount: 30_000, url: null },
    ],
    trendingRankFr: 14,
  },
};

/** Relevé de la veille : 118 k + 30 k = 148 k vidéos. */
const dadjuMeasuredPrev: Snapshot = {
  ...dadjuNoTiktok,
  date: "2026-09-15",
  tiktok: {
    sounds: [
      { name: "Reine", videoCount: 118_000, url: null },
      { name: "Jaloux", videoCount: 30_000, url: null },
    ],
    trendingRankFr: 17,
  },
};

describe("tiktokSignal — branche mesurée", () => {
  const snaps = { dadju: [dadjuMeasuredPrev, dadjuMeasured] };

  it("somme les vidéos, calcule le delta vs la veille, prend le son le plus repris", () => {
    const s = tiktokSignal("dadju", snaps, TODAY);
    expect(s).toEqual({
      videos: 150_000,
      deltaYesterday: 2_000,
      topSound: "Reine",
      trendingRankFr: 14,
      provenance: "measured",
    });
  });

  it("delta = 0 sans relevé précédent", () => {
    const s = tiktokSignal("dadju", { dadju: [dadjuMeasured] }, TODAY);
    expect(s.videos).toBe(150_000);
    expect(s.deltaYesterday).toBe(0);
    expect(s.provenance).toBe("measured");
  });

  it("delta = 0 si le relevé précédent n'a pas de TikTok (pas de delta négatif fantôme)", () => {
    const s = tiktokSignal("dadju", { dadju: [dadjuNoTiktok, dadjuMeasured] }, TODAY);
    expect(s.deltaYesterday).toBe(0);
    expect(s.provenance).toBe("measured");
  });

  it("un relevé TikTok sans aucun son retombe en simulé", () => {
    const empty: Snapshot = { ...dadjuNoTiktok, tiktok: { sounds: [], trendingRankFr: null } };
    expect(tiktokSignal("dadju", { dadju: [empty] }, TODAY).provenance).toBe("simulated");
  });
});

describe("tiktokSignal — branche simulée", () => {
  it("est déterministe : deux appels donnent le même résultat", () => {
    const a = tiktokSignal("dadju", { dadju: [dadjuNoTiktok] }, TODAY);
    const b = tiktokSignal("dadju", { dadju: [dadjuNoTiktok] }, TODAY);
    expect(a).toEqual(b);
  });

  it("Dadju : simulé, ratio 1,2–3 % des auditeurs, delta ≥ 0, top son = Reine, rang FR 8–60", () => {
    const s = tiktokSignal("dadju", { dadju: [dadjuNoTiktok] }, TODAY);
    expect(s.provenance).toBe("simulated");
    expect(s.videos).toBeGreaterThan(0);
    expect(Number.isInteger(s.videos)).toBe(true);
    // 6 473 478 auditeurs × [0,012 ; 0,03] → [77 682 ; 194 204]
    expect(s.videos).toBeGreaterThanOrEqual(77_000);
    expect(s.videos).toBeLessThanOrEqual(195_000);
    expect(s.deltaYesterday).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(s.deltaYesterday)).toBe(true);
    // delta = videos × [0,002 ; 0,006]
    expect(s.deltaYesterday).toBeLessThanOrEqual(Math.ceil(s.videos * 0.006));
    expect(s.topSound).toBe("Reine");
    expect(s.trendingRankFr).not.toBeNull();
    expect(s.trendingRankFr!).toBeGreaterThanOrEqual(8);
    expect(s.trendingRankFr!).toBeLessThanOrEqual(60);
  });

  it("Kiko (24 k auditeurs, sans Kworb) : quelques centaines de vidéos, pas de rang FR", () => {
    const s = tiktokSignal("kiko", SNAPSHOTS, TODAY);
    expect(s.provenance).toBe("simulated");
    // 24 222 auditeurs × [0,012 ; 0,03] → [291 ; 727]
    expect(s.videos).toBeGreaterThanOrEqual(290);
    expect(s.videos).toBeLessThanOrEqual(730);
    expect(s.deltaYesterday).toBeGreaterThanOrEqual(0);
    expect(s.trendingRankFr).toBeNull();
    // Le top son est un vrai titre du relevé Spotify de Kiko.
    const names = SNAPSHOTS.kiko[SNAPSHOTS.kiko.length - 1].spotify.topTracks.map((t) => t.name);
    expect(names).toContain(s.topSound);
  });

  it("sur les vrais relevés, le top son de Dadju est un titre Kworb", () => {
    const s = tiktokSignal("dadju", SNAPSHOTS, TODAY);
    expect(s.provenance).toBe("simulated");
    const names = SNAPSHOTS.dadju[SNAPSHOTS.dadju.length - 1].kworb!.tracks.map((t) => t.name);
    expect(names).toContain(s.topSound);
  });

  it("deux artistes ont des tirages différents (graine par artiste)", () => {
    const d = tiktokSignal("dadju", SNAPSHOTS, TODAY);
    const n = tiktokSignal("nono-la-grinta", SNAPSHOTS, TODAY);
    expect(d.videos).not.toBe(n.videos);
  });

  it("topSound = null pour un artiste sans titre relevé", () => {
    const bare: Snapshot = {
      date: "2026-09-16",
      spotify: { monthlyListeners: 10_000, followers: null, topTracks: [] },
      kworb: null,
      deezer: null,
      youtube: null,
      topCities: null,
    };
    const s = tiktokSignal("kiko", { kiko: [bare] }, TODAY);
    expect(s.provenance).toBe("simulated");
    expect(s.topSound).toBeNull();
  });
});

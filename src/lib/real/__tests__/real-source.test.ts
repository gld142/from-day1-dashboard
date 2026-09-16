import { describe, expect, it } from "vitest";
import {
  hasRealData,
  realCountryBreakdown,
  realDailyEstimates,
  realStreamSeries,
  realTopTracks,
  spotifyDailyByTrack,
} from "@/lib/real/real-source";
import type { Snapshot } from "@/lib/real/types";

const TODAY = new Date("2026-09-15T00:00:00Z");

// dailyStreams volontairement bas : le résidu (150 000 − 82 112 − 55 787 = 12 101) va au titre sans débit, Reine reste n°1
const dadju: Snapshot = {
  date: "2026-09-15",
  spotify: { monthlyListeners: 6_481_936, followers: null, topTracks: [{ name: "Reine", spotifyId: null, playcount: 228_869_436 }] },
  kworb: {
    totalStreams: 4_633_277_280,
    dailyStreams: 150_000,
    tracks: [
      { name: "Reine", total: 228_869_436, daily: 82_112 },
      { name: "Meleğim", total: 206_422_360, daily: 55_787 },
      { name: "Vieux titre", total: 1_000_000, daily: null },
    ],
  },
  deezer: { fans: 3_276_021, topTracks: [] },
  youtube: { subscribers: 8_010_000, videos: [{ videoId: "tVKaN_H35xs", title: "Reine", channel: "official", views: 439_698_165 }] },
  topCities: [
    { city: "Paris", country: "FR", listeners: 600_000 },
    { city: "Abidjan", country: "CI", listeners: 200_000 },
  ],
};
const dadjuPrev: Snapshot = {
  ...dadju,
  date: "2026-09-14",
  spotify: { ...dadju.spotify, topTracks: [{ name: "Reine", spotifyId: null, playcount: 228_787_324 }] },
  kworb: { ...dadju.kworb!, tracks: [{ name: "Reine", total: 228_787_324, daily: 80_000 }, { name: "Meleğim", total: 206_366_573, daily: 55_000 }] },
  youtube: { subscribers: 8_000_000, videos: [{ videoId: "tVKaN_H35xs", title: "Reine", channel: "official", views: 439_000_000 }] },
};
const kiko: Snapshot = {
  date: "2026-09-15",
  spotify: {
    monthlyListeners: 24_468,
    followers: null,
    topTracks: [
      { name: "Odjo", spotifyId: null, playcount: 203_809 },
      { name: "Business class", spotifyId: null, playcount: 122_254 },
    ],
  },
  kworb: null,
  deezer: null,
  youtube: null,
  topCities: null,
};
const SNAPS = { dadju: [dadjuPrev, dadju], kiko: [kiko] };

describe("real-source", () => {
  it("hasRealData", () => {
    expect(hasRealData("dadju", SNAPS)).toBe(true);
    expect(hasRealData("inconnu", SNAPS)).toBe(false);
  });

  it("Kworb : le quotidien par titre est mesuré pour les jours couverts, reconstitué avant ; le delta Spotify prime sur Kworb", () => {
    const byTrack = spotifyDailyByTrack("dadju", 30, TODAY, SNAPS);
    const reine = byTrack.get("Reine")!;
    expect(reine).toHaveLength(30);
    // Delta de playcount Spotify 14→15 = 82 112 : c'est la valeur mesurée d'aujourd'hui (elle vaut ici le daily Kworb).
    expect(reine[29]).toMatchObject({ date: "2026-09-15", streams: 82_112, provenance: "measured" });
    expect(reine[28]).toMatchObject({ date: "2026-09-14", streams: 80_000, provenance: "measured" });
    expect(reine[0].provenance).toBe("reconstructed");
    const meleg = byTrack.get("Meleğim")!;
    expect(meleg[29]).toMatchObject({ streams: 55_787, provenance: "measured" });
    // Un titre sans débit quotidien est réparti au prorata de son total.
    expect(byTrack.get("Vieux titre")![29].streams).toBeGreaterThan(0);
  });

  it("Spotify du jour = débit du snapshot ; YouTube du jour = delta de vues ; les autres DSP sont estimés ; pas de TikTok", () => {
    const s = realStreamSeries("dadju", 2, TODAY, SNAPS);
    const today = s.filter((p) => p.date === "2026-09-15");
    const sp = today.find((p) => p.dsp === "spotify")!;
    expect(sp.streams).toBe(150_000);
    expect(sp.provenance).toBe("measured");
    const yt = today.find((p) => p.dsp === "youtube")!;
    expect(yt.streams).toBe(698_165);
    expect(yt.provenance).toBe("measured");
    expect(today.find((p) => p.dsp === "deezer")!.provenance).toBe("estimated");
    expect(today.find((p) => p.dsp === "tiktok")).toBeUndefined();
  });

  it("Kiko (pas de Kworb) : reconstitution à partir des play counts, cohérente avec les auditeurs", () => {
    const s = realStreamSeries("kiko", 30, TODAY, SNAPS);
    const spotify30 = s.filter((p) => p.dsp === "spotify").reduce((a, p) => a + p.streams, 0);
    // ≈ auditeurs mensuels × 2,6 écoutes, à ±40 %.
    expect(spotify30).toBeGreaterThan(24_468 * 2.6 * 0.6);
    expect(spotify30).toBeLessThan(24_468 * 2.6 * 1.4);
    expect(s.every((p) => p.provenance !== "measured" || p.date === "2026-09-15")).toBe(true);
  });

  it("topTracks reflète les débits", () => {
    const t = realTopTracks("dadju", 7, 2, TODAY, SNAPS);
    expect(t[0].title).toBe("Reine");
    expect(t[0].streams).toBeGreaterThan(t[1].streams);
  });

  it("countryBreakdown vient des villes quand elles existent, null sinon", () => {
    const c = realCountryBreakdown("dadju", 30, TODAY, SNAPS)!;
    expect(c[0].iso3).toBe("FRA");
    expect(c.find((x) => x.iso3 === "CIV")).toBeDefined();
    expect(realCountryBreakdown("kiko", 30, TODAY, SNAPS)).toBeNull();
  });

  it("dailyEstimates : autant de jours que demandé, brut > 0, Spotify mesuré, jour tiré vers estimé par les DSP estimés", () => {
    const e = realDailyEstimates("dadju", 7, TODAY, SNAPS);
    expect(e).toHaveLength(7);
    expect(e[6].date).toBe("2026-09-15");
    expect(e[6].grossMaster.mid).toBeGreaterThan(1_000);
    expect(e[6].provenance).toBe("estimated");
    expect(e[6].byDsp.spotify!.provenance).toBe("measured");
  });

  it("est déterministe", () => {
    expect(JSON.stringify(realDailyEstimates("dadju", 10, TODAY, SNAPS))).toBe(JSON.stringify(realDailyEstimates("dadju", 10, TODAY, SNAPS)));
  });
});

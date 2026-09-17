import { describe, expect, it } from "vitest";
import {
  hasRealData,
  playcountRate,
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
  capturedAt: "2026-09-15T12:00:00Z",
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
  capturedAt: "2026-09-14T12:00:00Z",
  spotify: { ...dadju.spotify, topTracks: [{ name: "Reine", spotifyId: null, playcount: 228_787_324 }] },
  kworb: { ...dadju.kworb!, tracks: [{ name: "Reine", total: 228_787_324, daily: 80_000 }, { name: "Meleğim", total: 206_366_573, daily: 55_000 }] },
  youtube: { subscribers: 8_000_000, videos: [{ videoId: "tVKaN_H35xs", title: "Reine", channel: "official", views: 439_000_000 }] },
};
const kiko: Snapshot = {
  date: "2026-09-15",
  capturedAt: "2026-09-15T12:00:00Z",
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

  it("Kworb : le quotidien par titre est mesuré pour les jours couverts, reconstitué avant ; le daily Kworb ancre aujourd'hui", () => {
    const byTrack = spotifyDailyByTrack("dadju", 30, TODAY, SNAPS);
    const reine = byTrack.get("Reine")!;
    expect(reine).toHaveLength(30);
    // Aujourd'hui = daily Kworb (82 112), un vrai débit quotidien ; le delta 14→15 (82 112 sur 24 h) ne sert qu'aux jours antérieurs.
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

/* ─── Deltas de compteurs normalisés par le temps écoulé ─── */

/** Deux relevés Dadju à `hours` heures d'écart (le dernier capturé à `lastAt`), play count de Reine +`delta`. */
function dadjuPair(hours: number, delta: number, lastAt = "2026-09-15T01:00:00Z"): { prev: Snapshot; last: Snapshot } {
  const lastMs = Date.parse(lastAt);
  const prevMs = lastMs - hours * 3.6e6;
  const prevDate = new Date(prevMs).toISOString().slice(0, 10);
  const last: Snapshot = {
    ...dadju,
    capturedAt: new Date(lastMs).toISOString(),
    spotify: {
      ...dadju.spotify,
      topTracks: [
        { name: "Reine", spotifyId: null, playcount: 228_869_436 },
        { name: "Meleğim", spotifyId: null, playcount: 206_422_360 },
        { name: "Vieux titre", spotifyId: null, playcount: 1_000_000 },
      ],
    },
  };
  const prev: Snapshot = {
    ...dadjuPrev,
    date: prevDate,
    capturedAt: new Date(prevMs).toISOString(),
    spotify: {
      ...dadjuPrev.spotify,
      topTracks: [
        { name: "Reine", spotifyId: null, playcount: 228_869_436 - delta },
        { name: "Meleğim", spotifyId: null, playcount: 206_422_360 },
        { name: "Vieux titre", spotifyId: null, playcount: 1_000_000 },
      ],
    },
  };
  return { prev, last };
}

describe("playcountRate (Spotify avance ses compteurs publics une fois par jour, d'un bloc)", () => {
  it("delta > 0 sur 30 h = un seul rafraîchissement → un jour de streams : 171 455 / jour", () => {
    const { prev, last } = dadjuPair(30, 171_455);
    expect(playcountRate(prev, last, "Reine")).toEqual({ perDay: 171_455, days: 1 });
  });

  it("50 h → deux rafraîchissements → delta / 2", () => {
    const { prev, last } = dadjuPair(50, 171_455);
    expect(playcountRate(prev, last, "Reine")).toEqual({ perDay: 85_728, days: 2 });
    expect(playcountRate(dadjuPair(36, 60_000).prev, dadjuPair(36, 60_000).last, "Reine")).toEqual({ perDay: 30_000, days: 2 });
    expect(playcountRate(dadjuPair(35, 60_000).prev, dadjuPair(35, 60_000).last, "Reine")).toEqual({ perDay: 60_000, days: 1 });
  });

  it("delta nul ou négatif → null (Spotify n'a pas rafraîchi son compteur : ce n'est pas une mesure)", () => {
    expect(playcountRate(dadjuPair(24, 0).prev, dadjuPair(24, 0).last, "Reine")).toBeNull();
    expect(playcountRate(dadjuPair(24, -5).prev, dadjuPair(24, -5).last, "Reine")).toBeNull();
    expect(playcountRate(dadjuPair(2, 0).prev, dadjuPair(2, 0).last, "Reine")).toBeNull();
  });

  it("delta > 0 sur 11 h (ou 2 h) : un rafraîchissement a eu lieu = un jour de streams, pas de seuil horaire", () => {
    expect(playcountRate(dadjuPair(11, 5_000).prev, dadjuPair(11, 5_000).last, "Reine")).toEqual({ perDay: 5_000, days: 1 });
    expect(playcountRate(dadjuPair(2, 5_000).prev, dadjuPair(2, 5_000).last, "Reine")).toEqual({ perDay: 5_000, days: 1 });
  });

  it("captures dans le désordre (durée ≤ 0) → null", () => {
    const { prev, last } = dadjuPair(24, 5_000);
    expect(playcountRate(last, prev, "Reine")).toBeNull();
  });

  it("titre absent d'un des deux relevés → null", () => {
    const { prev, last } = dadjuPair(24, 1_000);
    expect(playcountRate(prev, last, "Inconnu")).toBeNull();
  });

  it("sans capturedAt : 24 h exactement si les dates sont consécutives, sinon null", () => {
    const { prev, last } = dadjuPair(24, 82_112);
    const prevNoTime: Snapshot = { ...prev, capturedAt: undefined };
    const lastNoTime: Snapshot = { ...last, capturedAt: undefined };
    expect(playcountRate(prevNoTime, lastNoTime, "Reine")).toEqual({ perDay: 82_112, days: 1 });
    expect(playcountRate({ ...prevNoTime, date: "2026-09-12" }, lastNoTime, "Reine")).toBeNull();
    // Un seul des deux horodatages ne suffit pas non plus.
    expect(playcountRate(prevNoTime, { ...lastNoTime, date: "2026-09-14" }, "Reine")).toBeNull();
    expect(playcountRate(prev, { ...lastNoTime, date: "2026-09-13" }, "Reine")).toBeNull();
  });
});

describe("Spotify : relevés rapprochés ou espacés", () => {
  it("(a) deux relevés à 2 h d'écart, play counts identiques : aujourd'hui = daily Kworb, la veille n'est pas « mesurée » à 0 par le delta", () => {
    const { prev, last } = dadjuPair(2, 0); // prev le 14 à 23:00Z, last le 15 à 01:00Z
    const snaps = { dadju: [prev, last] };
    const byTrack = spotifyDailyByTrack("dadju", 30, TODAY, snaps);
    // Aujourd'hui : le daily Kworb reste l'ancre.
    expect(byTrack.get("Reine")![29]).toMatchObject({ date: "2026-09-15", streams: 82_112, provenance: "measured" });
    expect(byTrack.get("Meleğim")![29]).toMatchObject({ streams: 55_787, provenance: "measured" });
    // La veille : le daily Kworb du relevé précédent, pas le delta (0).
    expect(byTrack.get("Reine")![28]).toMatchObject({ date: "2026-09-14", streams: 80_000, provenance: "measured" });
    expect(byTrack.get("Meleğim")![28]).toMatchObject({ streams: 55_000, provenance: "measured" });
    // Titre sans daily Kworb la veille : reconstitué, jamais « mesuré » à 0.
    const vieux = byTrack.get("Vieux titre")!;
    expect(vieux[28].provenance).toBe("reconstructed");
    expect(vieux[28].streams).toBeGreaterThan(0);
    // Total Spotify du jour = dailyStreams Kworb.
    const today = realStreamSeries("dadju", 1, TODAY, snaps).find((p) => p.dsp === "spotify")!;
    expect(today).toMatchObject({ streams: 150_000, provenance: "measured" });
  });

  it("(b) 30 h d'écart, delta 171 455 = un jour de streams : il couvre le 15 = aujourd'hui, ancré sur Kworb ; le 14 garde son daily Kworb", () => {
    const { prev, last } = dadjuPair(30, 171_455, "2026-09-15T06:00:00Z"); // prev le 14 à 00:00Z → last le 15 à 06:00Z
    expect(prev.date).toBe("2026-09-14");
    const byTrack = spotifyDailyByTrack("dadju", 30, TODAY, { dadju: [prev, last] });
    const reine = byTrack.get("Reine")!;
    expect(reine[29]).toMatchObject({ date: "2026-09-15", streams: 82_112, provenance: "measured" });
    expect(reine[28]).toMatchObject({ date: "2026-09-14", streams: 80_000, provenance: "measured" });
  });

  it("(b') 50 h d'écart, delta 171 455 = deux jours : le 14 reçoit delta / 2, aujourd'hui reste ancré sur Kworb", () => {
    // prev le 13 à 00:00Z → last le 15 à 02:00Z : deux rafraîchissements → les 2 derniers jours (14, 15) à 85 728 ; le 15 = aujourd'hui, ancré.
    const { prev, last } = dadjuPair(50, 171_455, "2026-09-15T02:00:00Z");
    expect(prev.date).toBe("2026-09-13");
    const prevNoKworb: Snapshot = { ...prev, kworb: { ...prev.kworb!, tracks: [] } };
    const byTrack = spotifyDailyByTrack("dadju", 30, TODAY, { dadju: [prevNoKworb, last] });
    const reine = byTrack.get("Reine")!;
    expect(reine[28]).toMatchObject({ date: "2026-09-14", streams: 85_728, provenance: "measured" });
    expect(reine[27]).toMatchObject({ date: "2026-09-13", provenance: "reconstructed" });
    expect(reine[29]).toMatchObject({ date: "2026-09-15", streams: 82_112, provenance: "measured" });
  });

  it("(b'') 30 h d'écart sur deux dates non consécutives : un seul jour de streams, attribué au 15 (aujourd'hui) ; le 14 n'est pas mesuré", () => {
    const { prev, last } = dadjuPair(30, 171_455, "2026-09-15T00:00:00Z"); // prev le 13 à 18:00Z
    expect(prev.date).toBe("2026-09-13");
    const prevNoKworb: Snapshot = { ...prev, kworb: { ...prev.kworb!, tracks: [] } };
    const reine = spotifyDailyByTrack("dadju", 30, TODAY, { dadju: [prevNoKworb, last] }).get("Reine")!;
    expect(reine[28]).toMatchObject({ date: "2026-09-14", provenance: "reconstructed" });
    expect(reine[29]).toMatchObject({ date: "2026-09-15", streams: 82_112, provenance: "measured" });
  });

  it("trois relevés : la paire la plus récente l'emporte sur un jour couvert deux fois", () => {
    // 11 (22:00Z) → 14 (00:00Z) : 50 h, +171 455 → 2 jours (13, 14) à 85 728 ;
    // 14 (00:00Z) → 15 (12:30Z) : 36,5 h, +60 000 → 2 jours (14, 15) à 30 000 ; le 15 = aujourd'hui, ancré sur Kworb.
    const withReine = (base: Snapshot, date: string, capturedAt: string, playcount: number): Snapshot => ({
      ...base,
      date,
      capturedAt,
      kworb: { ...base.kworb!, tracks: [] },
      spotify: { ...base.spotify, topTracks: [{ name: "Reine", spotifyId: null, playcount }] },
    });
    const first = withReine(dadjuPrev, "2026-09-11", "2026-09-11T22:00:00Z", 228_869_436 - 60_000 - 171_455);
    const mid = withReine(dadjuPrev, "2026-09-14", "2026-09-14T00:00:00Z", 228_869_436 - 60_000);
    const last: Snapshot = { ...dadju, capturedAt: "2026-09-15T12:30:00Z" };
    const reine = spotifyDailyByTrack("dadju", 30, TODAY, { dadju: [first, mid, last] }).get("Reine")!;
    expect(reine[27]).toMatchObject({ date: "2026-09-13", streams: 85_728, provenance: "measured" });
    expect(reine[28]).toMatchObject({ date: "2026-09-14", streams: 30_000, provenance: "measured" });
    expect(reine[29]).toMatchObject({ date: "2026-09-15", streams: 82_112, provenance: "measured" });
    expect(reine[26]).toMatchObject({ date: "2026-09-12", provenance: "reconstructed" });
  });

  it("titre sans daily Kworb : le débit normalisé du delta sert d'ancre du jour à la place du résidu", () => {
    const { prev, last } = dadjuPair(24, 82_112, "2026-09-15T12:00:00Z");
    const withDelta: Snapshot = {
      ...last,
      spotify: { ...last.spotify, topTracks: last.spotify.topTracks.map((t) => (t.name === "Vieux titre" ? { ...t, playcount: 1_030_000 } : t)) },
    };
    const byTrack = spotifyDailyByTrack("dadju", 30, TODAY, { dadju: [prev, withDelta] });
    expect(byTrack.get("Vieux titre")![29]).toMatchObject({ date: "2026-09-15", streams: 30_000, provenance: "measured" });
  });

  it("(c) Kiko sans Kworb : 2 h d'écart et play counts identiques → estimation auditeurs, aujourd'hui « reconstructed »", () => {
    const prev: Snapshot = { ...kiko, date: "2026-09-14", capturedAt: "2026-09-14T23:00:00Z" };
    const last: Snapshot = { ...kiko, capturedAt: "2026-09-15T01:00:00Z" };
    const byTrack = spotifyDailyByTrack("kiko", 30, TODAY, { kiko: [prev, last] });
    const odjo = byTrack.get("Odjo")!;
    expect(odjo[29].provenance).toBe("reconstructed");
    // 24 468 × 2,6 / 30 × 0,8 × (203 809 / 326 063) ≈ 1 060, jamais 0.
    expect(odjo[29].streams).toBeGreaterThan(500);
    expect(odjo[29].streams).toBeLessThan(2_000);
    const today = realStreamSeries("kiko", 1, TODAY, { kiko: [prev, last] }).find((p) => p.dsp === "spotify")!;
    expect(today.provenance).toBe("reconstructed");
    expect(today.streams).toBeGreaterThan(1_500);
  });

  it("(c') Kiko sans Kworb : 24 h d'écart, delta 665 → 665 mesuré aujourd'hui", () => {
    const prev: Snapshot = {
      ...kiko,
      date: "2026-09-14",
      capturedAt: "2026-09-14T12:00:00Z",
      spotify: { ...kiko.spotify, topTracks: [{ name: "Odjo", spotifyId: null, playcount: 203_809 - 665 }, kiko.spotify.topTracks[1]] },
    };
    const byTrack = spotifyDailyByTrack("kiko", 30, TODAY, { kiko: [prev, kiko] });
    expect(byTrack.get("Odjo")![29]).toMatchObject({ date: "2026-09-15", streams: 665, provenance: "measured" });
    // « Business class » n'a pas bougé : estimation, pas 0 mesuré.
    expect(byTrack.get("Business class")![29].provenance).toBe("reconstructed");
    expect(byTrack.get("Business class")![29].streams).toBeGreaterThan(0);
  });

  it("(c'') Kiko : delta 665 sur 30 h comme sur 11 h = un rafraîchissement = 665 / jour mesuré", () => {
    const at = (capturedAt: string): Snapshot => ({
      ...kiko,
      date: "2026-09-14",
      capturedAt,
      spotify: { ...kiko.spotify, topTracks: [{ name: "Odjo", spotifyId: null, playcount: 203_809 - 665 }, kiko.spotify.topTracks[1]] },
    });
    expect(spotifyDailyByTrack("kiko", 30, TODAY, { kiko: [at("2026-09-14T06:00:00Z"), kiko] }).get("Odjo")![29]).toMatchObject({ streams: 665, provenance: "measured" });
    expect(spotifyDailyByTrack("kiko", 30, TODAY, { kiko: [at("2026-09-15T01:00:00Z"), kiko] }).get("Odjo")![29]).toMatchObject({ streams: 665, provenance: "measured" });
  });
});

describe("YouTube : deltas de vues normalisés", () => {
  it("(d) delta sur 2 h (< 20 h) ignoré : repli « Σ vues × 0,05 % », provenance « reconstructed »", () => {
    const { prev, last } = dadjuPair(2, 0);
    const today = realStreamSeries("dadju", 1, TODAY, { dadju: [prev, last] }).find((p) => p.dsp === "youtube")!;
    expect(today).toMatchObject({ streams: Math.round(439_698_165 * 0.0005), provenance: "reconstructed" });
    const five = dadjuPair(5.9, 0);
    expect(realStreamSeries("dadju", 1, TODAY, { dadju: [five.prev, five.last] }).find((p) => p.dsp === "youtube")!.provenance).toBe("reconstructed");
  });

  it("fenêtre de 12 h (< 20 h) : trop bruyante, repli sur le dernier débit valide s'il existe, sinon sur l'estimation", () => {
    const { prev, last } = dadjuPair(12, 0);
    const today = realStreamSeries("dadju", 1, TODAY, { dadju: [prev, last] }).find((p) => p.dsp === "youtube")!;
    expect(today).toMatchObject({ streams: Math.round(439_698_165 * 0.0005), provenance: "reconstructed" });
    // Trois relevés : 30 h valides (558 532 / j) puis 12 h trop courtes → on reporte 558 532, reconstitué.
    const older: Snapshot = { ...prev, date: "2026-09-13", capturedAt: "2026-09-13T12:00:00Z", youtube: { subscribers: null, videos: [{ videoId: "tVKaN_H35xs", title: "Reine", channel: "official", views: 439_000_000 - 698_165 }] } };
    const mid: Snapshot = { ...prev, date: "2026-09-14", capturedAt: "2026-09-14T18:00:00Z" };
    const short: Snapshot = { ...last, capturedAt: "2026-09-15T06:00:00Z" };
    const t3 = realStreamSeries("dadju", 1, TODAY, { dadju: [older, mid, short] }).find((p) => p.dsp === "youtube")!;
    expect(t3).toMatchObject({ streams: 558_532, provenance: "reconstructed" });
  });

  it("delta 698 165 sur 30 h → 558 532 / jour mesuré", () => {
    const { prev, last } = dadjuPair(30, 0, "2026-09-15T06:00:00Z");
    const today = realStreamSeries("dadju", 1, TODAY, { dadju: [prev, last] }).find((p) => p.dsp === "youtube")!;
    expect(today).toMatchObject({ streams: 558_532, provenance: "measured" });
  });

  it("vues identiques (delta 0) sur 24 h → repli, pas 0 mesuré", () => {
    const { prev, last } = dadjuPair(24, 0, "2026-09-15T12:00:00Z");
    const same: Snapshot = { ...prev, youtube: last.youtube };
    const today = realStreamSeries("dadju", 1, TODAY, { dadju: [same, last] }).find((p) => p.dsp === "youtube")!;
    expect(today.provenance).toBe("reconstructed");
    expect(today.streams).toBeGreaterThan(0);
  });
});

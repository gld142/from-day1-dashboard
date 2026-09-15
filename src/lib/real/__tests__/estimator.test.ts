import { describe, expect, it } from "vitest";
import {
  artistShare,
  confidenceOf,
  estimateDay,
  publishingShare,
  summarize,
  type DayInput,
} from "@/lib/real/estimator";
import { RATE_FR, TIER_FR, blendedRate } from "@/lib/real/params";

const base: DayInput = {
  date: "2026-09-15",
  byDsp: { spotify: { streams: 1_000_000, provenance: "measured" } },
  territoryCoef: 1,
  tier: TIER_FR,
  deezerPro: true,
  payableShare: 1,
};

describe("estimateDay", () => {
  it("1 M de streams Spotify en France ≈ 1 M × taux mixé × 0,85, en fourchette ordonnée", () => {
    const e = estimateDay(base);
    const expected = 1_000_000 * blendedRate(TIER_FR) * 0.85;
    expect(e.grossMaster.mid).toBeCloseTo(expected, 0);
    expect(e.grossMaster.low).toBeLessThan(e.grossMaster.mid);
    expect(e.grossMaster.high).toBeGreaterThan(e.grossMaster.mid);
    expect(e.streams).toBe(1_000_000);
    expect(e.payableStreams).toBe(1_000_000);
  });

  it("le territoire divise le brut (Afrique)", () => {
    const fr = estimateDay(base).grossMaster.mid;
    const tg = estimateDay({ ...base, territoryCoef: 0.5 }).grossMaster.mid;
    expect(tg).toBeCloseTo(fr / 2, 0);
  });

  it("un stream Deezer d'un artiste pro vaut plus qu'un stream Spotify", () => {
    const e = estimateDay({
      ...base,
      byDsp: {
        spotify: { streams: 1_000, provenance: "measured" },
        deezer: { streams: 1_000, provenance: "estimated" },
      },
    });
    expect(e.byDsp.deezer!.gross.mid).toBeGreaterThan(e.byDsp.spotify!.gross.mid * 1.5);
  });

  it("les streams non rémunérables ne rapportent rien", () => {
    const e = estimateDay({ ...base, payableShare: 0.5 });
    expect(e.payableStreams).toBe(500_000);
    expect(e.grossMaster.mid).toBeCloseTo(estimateDay(base).grossMaster.mid / 2, 0);
  });

  it("un taux calibré remplace le taux par défaut", () => {
    const e = estimateDay({ ...base, rateOverrides: { spotify: 0.0031 } });
    expect(e.byDsp.spotify!.gross.mid).toBeCloseTo(1_000_000 * 0.0031, 0);
    expect(e.byDsp.spotify!.gross.low).toBeCloseTo(1_000_000 * 0.0031 * 0.95, 0);
  });

  it("la provenance du jour est la plus faible des DSP", () => {
    const e = estimateDay({
      ...base,
      byDsp: {
        spotify: { streams: 10, provenance: "measured" },
        apple: { streams: 10, provenance: "estimated" },
      },
    });
    expect(e.provenance).toBe("estimated");
  });

  it("TikTok ne génère pas de brut master", () => {
    const e = estimateDay({ ...base, byDsp: { tiktok: { streams: 1_000_000, provenance: "estimated" } } });
    expect(e.grossMaster.mid).toBe(0);
  });

  it("YouTube : la part d'art tracks « Topic » relève le coefficient", () => {
    const clips = estimateDay({ ...base, byDsp: { youtube: { streams: 1_000, provenance: "measured", youtubeTopicShare: 0 } } });
    const topic = estimateDay({ ...base, byDsp: { youtube: { streams: 1_000, provenance: "measured", youtubeTopicShare: 1 } } });
    expect(topic.grossMaster.mid).toBeGreaterThan(clips.grossMaster.mid * 2);
  });
});

describe("summarize / confiance / cascades", () => {
  const days = Array.from({ length: 10 }, (_, i) =>
    estimateDay({ ...base, date: `2026-09-${String(6 + i).padStart(2, "0")}` }),
  );

  it("somme les jours et garde les bornes", () => {
    const s = summarize(days, "week", { calibrated: false, dealType: "artiste" });
    expect(s.streams).toBe(7 * 1_000_000);
    expect(s.from).toBe("2026-09-09");
    expect(s.to).toBe("2026-09-15");
    expect(s.grossMaster.mid).toBeCloseTo(days[0].grossMaster.mid * 7, 0);
    expect(s.artistShare.mid).toBeCloseTo(s.grossMaster.mid * 0.2, 0);
    expect(s.publishing.mid).toBeCloseTo(s.grossMaster.mid * 0.15 * 0.5, 0);
  });

  it("confiance : mesuré + calibré = élevé ; reconstitué + défaut = indicatif", () => {
    expect(confidenceOf("measured", true)).toBe("high");
    expect(confidenceOf("measured", false)).toBe("medium");
    expect(confidenceOf("reconstructed", true)).toBe("medium");
    expect(confidenceOf("reconstructed", false)).toBe("indicative");
    expect(confidenceOf("estimated", false)).toBe("indicative");
  });

  it("cascades en fourchette", () => {
    const g = { low: 900, mid: 1000, high: 1100 };
    expect(artistShare(g, "distribution").mid).toBeCloseTo(900, 6);
    expect(artistShare(g, "indé")).toEqual(g);
    expect(publishingShare(g).mid).toBeCloseTo(75, 6);
  });

  it("le taux premium SNEP reste la référence (sanity)", () => {
    expect(RATE_FR.premium * 1_000_000).toBeGreaterThan(4_000);
  });
});

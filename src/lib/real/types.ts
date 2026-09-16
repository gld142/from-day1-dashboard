import type { DSP, Provenance } from "@/lib/demo/types";

export type { Provenance };

export type SnapshotTrack = { name: string; total: number; daily: number | null };
export type SnapshotVideo = {
  videoId: string;
  title: string;
  channel: "official" | "topic";
  views: number;
};
export type SnapshotCity = { city: string; country: string; listeners: number };

/** Un son TikTok de l'artiste : nom, nombre de vidéos qui l'utilisent, page publique éventuelle. */
export type TikTokSound = { name: string; videoCount: number; url: string | null };
/** Relevé TikTok d'un artiste — absent des relevés actuels (page son anti-bot), prêt pour Soundcharts ou un compte connecté. */
export type TikTokSnapshot = { sounds: TikTokSound[]; trendingRankFr: number | null };

/** Un relevé quotidien d'un artiste — fichier src/lib/real/snapshots/<id>/<date>.json */
export type Snapshot = {
  date: string; // YYYY-MM-DD
  spotify: {
    monthlyListeners: number | null;
    followers: number | null;
    topTracks: Array<{ name: string; spotifyId: string | null; playcount: number }>;
  };
  kworb: {
    totalStreams: number;
    dailyStreams: number;
    tracks: SnapshotTrack[];
  } | null;
  deezer: { fans: number; topTracks: Array<{ title: string; rank: number }> } | null;
  youtube: { subscribers: number | null; videos: SnapshotVideo[] } | null;
  topCities: SnapshotCity[] | null;
  /** Optionnel : les fichiers JSON existants restent valides sans ce champ. */
  tiktok?: TikTokSnapshot | null;
};

/**
 * Signal de viralité TikTok — PAS un revenu : vidéos utilisant les sons de
 * l'artiste, delta depuis hier, titre le plus repris, rang tendances France.
 */
export type TikTokSignal = {
  videos: number;
  deltaYesterday: number;
  topSound: string | null;
  trendingRankFr: number | null;
  provenance: Provenance;
};

export type Range = { low: number; mid: number; high: number };
export type Confidence = "high" | "medium" | "indicative";

export type DailyEstimate = {
  date: string;
  streams: number;
  payableStreams: number;
  byDsp: Partial<Record<DSP, { streams: number; gross: Range; provenance: Provenance }>>;
  grossMaster: Range;
  provenance: Provenance;
};

export type EstimatePeriod = "day" | "week" | "month" | "year";

export type EstimateSummary = {
  period: EstimatePeriod;
  from: string;
  to: string;
  streams: number;
  payableStreams: number;
  grossMaster: Range;
  artistShare: Range;
  publishing: Range;
  confidence: Confidence;
  provenance: Provenance;
  calibrated: boolean;
};

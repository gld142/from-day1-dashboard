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

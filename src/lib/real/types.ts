import type { DSP, Provenance } from "@/lib/demo/types";
import type { MarketGroup } from "./market/groups";

export type { MarketGroup, Provenance };

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
  date: string; // YYYY-MM-DD (jour local Europe/Paris du relevé)
  /**
   * Instant de la capture, ISO 8601 UTC. Optionnel : les anciens fichiers et
   * les fixtures restent valides sans lui (deux relevés à dates consécutives
   * sont alors supposés espacés de 24 h exactement). Sert à normaliser les
   * deltas de compteurs cumulés (play counts, vues) par le temps écoulé.
   */
  capturedAt?: string;
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

/* ─── Marché : Top 200 Spotify France (Kworb) + labels mesurés ─── */

/**
 * Genres de la table manuelle src/lib/real/market/genres.json (provenance
 * « declared ») ; « unknown » = artiste non renseigné dans la table.
 */
export const MARKET_GENRES = [
  "rap",
  "pop",
  "variete",
  "electro",
  "rnb",
  "afro",
  "rock",
  "latin",
  "international",
  "autre",
  "unknown",
] as const;
export type MarketGenre = (typeof MARKET_GENRES)[number];

/** Une ligne du Top 200 : chiffres Kworb (mesurés) + label Spotify + groupe + genre. */
export type MarketTrack = {
  rank: number;
  /** Variation de rang (« P+ ») ; null = entrée (NEW) ou retour (RE). */
  delta: number | null;
  trackId: string;
  artistId: string | null;
  /** Artiste principal (premier lien Kworb). */
  artist: string;
  title: string;
  /** Artistes invités (« w/ … »). */
  featuring: string[];
  /** Jours de présence dans le classement. */
  days: number;
  peak: number;
  /** Jours passés au pic (colonne « (x?) »), null si absent. */
  peakDays: number | null;
  /** Streams du jour du classement (`chartDate`). */
  streams: number;
  streamsDelta: number | null;
  streams7d: number;
  streams7dDelta: number | null;
  total: number;
  label: {
    /** Lignes ℗ / © lues sur la page Spotify (vides si non obtenues). */
    lines: string[];
    group: MarketGroup;
    provenance: Provenance;
    evidence: string | null;
  };
  genre: MarketGenre;
};

/** Un relevé du marché — fichier src/lib/real/snapshots/market/<date>.json */
export type MarketSnapshot = {
  /** Jour du relevé (Europe/Paris). */
  date: string;
  capturedAt: string;
  /** Date du classement telle qu'affichée par Kworb (J-2 en général), null si non lue. */
  chartDate: string | null;
  country: "FR";
  source: string;
  tracks: MarketTrack[];
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

/** Fenêtres de l'estimateur : hier, 7 j, 30 j, 90 j, 12 mois (cf. PERIOD_DAYS). */
export type EstimatePeriod = "day" | "week" | "month" | "quarter" | "year";

export type EstimateSummary = {
  period: EstimatePeriod;
  from: string;
  to: string;
  streams: number;
  payableStreams: number;
  grossMaster: Range;
  artistShare: Range;
  publishing: Range;
  /** « declared » si la part artiste vient des pourcentages renseignés, « simulated » si c'est l'hypothèse de contrat. */
  sharesProvenance: Provenance;
  /** Idem pour les droits d'auteur (pas auteur → 0, renseigné). */
  publishingProvenance: Provenance;
  confidence: Confidence;
  /** Provenance des streams sous-jacents (la plus faible de la fenêtre). */
  provenance: Provenance;
  calibrated: boolean;
};

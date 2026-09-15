/**
 * Paramètres de l'estimateur « stream rémunérateur » (spec §5.1, §5.2).
 * Chaque valeur porte sa source. MESURÉ = chiffre publié ; HYPOTHÈSE = valeur
 * de départ à recaler par relevé (calibration.ts).
 */
import type { DSP } from "@/lib/demo/types";
import type { Range } from "./types";

/* ─── Ancrage France — MESURÉ, SNEP bilan 2025 (revenus producteurs) ─── */
export const SNEP_2025 = {
  premiumRevenueEur: 553_000_000,
  premiumStreams: 122_000_000_000,
  /** Déduit de « audio gratuit +12 %, soit +9 M€ » → ≈ 84 M€ en 2025. */
  freemiumRevenueEur: 84_000_000,
  /** 122 Md = 80 % des streams audio → ≈ 30 Md de streams gratuits. */
  freemiumStreams: 30_000_000_000,
  source: "https://snepmusique.com/communiques-dossiers-de-presse/bilan-2025-snep/",
} as const;

export const RATE_FR = {
  premium: SNEP_2025.premiumRevenueEur / SNEP_2025.premiumStreams, // ≈ 0,00453 €
  free: SNEP_2025.freemiumRevenueEur / SNEP_2025.freemiumStreams, // ≈ 0,0028 €
} as const;

export type Tier = { premium: number; free: number };
/** Part premium/gratuit France — MESURÉ (80 % des streams audio sont premium). */
export const TIER_FR: Tier = { premium: 0.8, free: 0.2 };

export function blendedRate(tier: Tier): number {
  return RATE_FR.premium * tier.premium + RATE_FR.free * tier.free;
}

/* ─── Coefficients par DSP, appliqués au taux France mixé — HYPOTHÈSES ─── */
export const DSP_COEF: Record<DSP, Range> = {
  spotify: { low: 0.75, mid: 0.85, high: 0.95 },
  deezer: { low: 1.0, mid: 1.15, high: 1.3 },
  apple: { low: 1.25, mid: 1.45, high: 1.65 },
  amazon: { low: 0.85, mid: 1.0, high: 1.15 },
  /** Vues YouTube : mélange clips (AVOD) et art tracks « Topic » — voir YOUTUBE_COEF. */
  youtube: { low: 0.2, mid: 0.3, high: 0.45 },
  /** TikTok n'est pas un stream rémunéré au sens DSP. */
  tiktok: { low: 0, mid: 0, high: 0 },
  other: { low: 0.7, mid: 0.9, high: 1.1 },
};

export const YOUTUBE_COEF: Record<"official" | "topic", Range> = {
  official: { low: 0.2, mid: 0.25, high: 0.3 },
  topic: { low: 0.6, mid: 0.7, high: 0.8 },
};

/* ─── Parts de marché France par DSP — HYPOTHÈSE (streams audio + vidéo) ─── */
export const MARKET_MIX_FR: Record<DSP, number> = {
  spotify: 0.55,
  deezer: 0.17,
  apple: 0.14,
  amazon: 0.06,
  youtube: 0.05,
  tiktok: 0,
  other: 0.03,
};

/** Médiane de marché du ratio fans Deezer / auditeurs mensuels Spotify — HYPOTHÈSE. */
export const DEEZER_RATIO_MEDIAN = 0.25;
export const DEEZER_RATIO_CLAMP: [number, number] = [0.5, 2.5];

/* ─── Deezer artist-centric (UMG × Deezer 2023, SACEM 2025) — règles PUBLIÉES ─── */
export const DEEZER_ARTIST_CENTRIC = {
  proThreshold: { streamsPerMonth: 1_000, uniqueListeners: 500 },
  proBoost: 2,
  activeBoost: 2,
  /** Part d'écoutes actives (recherche, playlist non algo) — HYPOTHÈSE. */
  activeShareDefault: 0.4,
  /** Poids moyen d'un stream Deezer dans le pool (pro-rata boosté) — HYPOTHÈSE. */
  averageWeight: 1.6,
} as const;

/* ─── Seuils de rémunérabilité — règles PUBLIÉES ─── */
export const SPOTIFY_MIN_STREAMS_12M = 1_000;
export const MIN_STREAM_SECONDS = 30;

/* ─── Territoires — HYPOTHÈSES (fraction du taux France) ─── */
export type Zone = "frbech" | "europe" | "northAmerica" | "africa" | "rest";
export const ZONES: Zone[] = ["frbech", "europe", "northAmerica", "africa", "rest"];
export const TERRITORY_COEF: Record<Zone, number> = {
  frbech: 1.0,
  europe: 0.9,
  northAmerica: 1.1,
  africa: 0.15,
  rest: 0.5,
};
/** Répartition par défaut quand on n'a pas les villes, selon le pays de l'artiste. */
export const ZONE_DEFAULTS: Record<string, Record<Zone, number>> = {
  FR: { frbech: 0.7, europe: 0.12, northAmerica: 0.08, africa: 0.05, rest: 0.05 },
  TG: { frbech: 0.35, europe: 0.08, northAmerica: 0.05, africa: 0.45, rest: 0.07 },
  default: { frbech: 0.6, europe: 0.15, northAmerica: 0.1, africa: 0.05, rest: 0.1 },
};

/* ─── Cascades — HYPOTHÈSES cohérentes avec dealType ─── */
export const DEAL_SHARE: Record<"licence" | "distribution" | "artiste" | "indé", Range> = {
  distribution: { low: 0.85, mid: 0.9, high: 1.0 },
  licence: { low: 0.24, mid: 0.27, high: 0.3 },
  artiste: { low: 0.18, mid: 0.2, high: 0.25 },
  indé: { low: 1, mid: 1, high: 1 },
};
/** Part du chiffre DSP qui part vers l'édition, et part de l'auteur dans l'édition. */
export const PUBLISHING_SHARE_OF_DSP = 0.15;
export const AUTHOR_SHARE_OF_PUBLISHING = 0.5;

/* ─── Audit — seuils ─── */
export const AUDIT_GAP_REL = 0.12;
export const AUDIT_GAP_ABS_EUR = 100;

/* ─── Reconstruction ─── */
export const RECONSTRUCT = {
  weekly: { fri: 1.1, sat: 1.1, sun: 1.03, mon: 0.95, other: 1.0 },
  noiseAmplitude: 0.08,
  releaseSpike: 3,
  releaseDecayDays: 45,
} as const;

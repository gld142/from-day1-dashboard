"use client";

/**
 * Dérivations déterministes pour /algo-position.
 * Tout est seedé (rngFor/hashString) : mêmes chiffres serveur & client,
 * signatures pensées pour être remplacées par de vraies données Spotify API.
 */
import { dailyTotals, getArtist, sumStreams } from "@/lib/demo/api";
import { hashString, rngFor } from "@/lib/demo/seed";

export const ALGO_SOURCE_IDS = [
  "discoverWeekly",
  "releaseRadar",
  "radio",
  "autoplay",
  "dailyMix",
] as const;

export type AlgoSourceId = (typeof ALGO_SOURCE_IDS)[number];

/** Poids de base de chaque surface algorithmique (avant jitter seedé). */
const SOURCE_BASE: Record<AlgoSourceId, number> = {
  radio: 0.3,
  autoplay: 0.22,
  discoverWeekly: 0.18,
  releaseRadar: 0.16,
  dailyMix: 0.14,
};

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/** Part algorithmique totale des streams (30–45 %), stable par artiste. */
export function algoShare(artistId: string): number {
  return Math.round((30 + (hashString(`${artistId}:algo:share`) % 1501) / 100) * 10) / 10;
}

/** Score de santé algorithmique 0-100 — dérivé du Day 1 Index + croissance. */
export function algoHealthScore(artistId: string): number {
  const a = getArtist(artistId);
  return clamp(Math.round(a.day1Index * 0.68 + a.growthRate * 320 + 12));
}

export type AlgoSourceSlice = {
  id: AlgoSourceId;
  /** Part de ce canal dans le TOTAL des streams (les 5 somment = algoShare). */
  sharePct: number;
  streams28d: number;
};

export function algoSourceBreakdown(artistId: string): AlgoSourceSlice[] {
  const total = algoShare(artistId);
  const rand = rngFor(`${artistId}:algo:sources`);
  const weights = ALGO_SOURCE_IDS.map((id) => SOURCE_BASE[id] * (0.75 + rand() * 0.5));
  const sum = weights.reduce((s, w) => s + w, 0);
  const streams28 = sumStreams(artistId, 28);
  return ALGO_SOURCE_IDS.map((id, i) => {
    const sharePct = Math.round((weights[i] / sum) * total * 10) / 10;
    return {
      id,
      sharePct,
      streams28d: Math.round((sharePct / 100) * streams28),
    };
  }).sort((a, b) => b.sharePct - a.sharePct);
}

export type MixPoint = {
  date: string;
  algorithmic: number;
  editorial: number;
  organic: number;
};

/** Évolution 90 j des parts algo / éditorial / organique — sinusoïdes seedées lissées. */
export function algoMixSeries(artistId: string, days = 90): MixPoint[] {
  const a = getArtist(artistId);
  const base = algoShare(artistId);
  const rand = rngFor(`${artistId}:algo:mix`);
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const p3 = rand() * Math.PI * 2;
  const editorialBase = 12 + rand() * 9;
  const slope = clamp(a.growthRate * 60, -6, 6); // points gagnés/perdus sur 90 j
  return dailyTotals(artistId, days).map((d, i) => {
    const t = i / Math.max(1, days - 1);
    const algorithmic =
      base + slope * (t - 0.5) + Math.sin(i / 9 + p1) * 1.6 + Math.sin(i / 23 + p2) * 1.1;
    const editorial = editorialBase + Math.sin(i / 13 + p3) * 1.8;
    const organic = 100 - algorithmic - editorial;
    return {
      date: d.date,
      algorithmic: Math.round(algorithmic * 10) / 10,
      editorial: Math.round(editorial * 10) / 10,
      organic: Math.round(organic * 10) / 10,
    };
  });
}

export type AlgoPerception = {
  saveRate: number;
  skipRate: number;
  completion: number;
};

/** Seuils pédagogiques annotés sur les jauges. */
export const PERCEPTION_THRESHOLDS = {
  saveRate: 30, // au-dessus : déclenche Radio
  skipRate: 25, // en dessous : signal positif
  completion: 65, // au-dessus : titre "retenu" par l'algo
} as const;

export function algoPerception(artistId: string): AlgoPerception {
  const a = getArtist(artistId);
  const rand = rngFor(`${artistId}:algo:perception`);
  return {
    saveRate: Math.round((20 + a.day1Index * 0.16 + rand() * 6) * 10) / 10,
    skipRate: Math.round((36 - a.day1Index * 0.16 + rand() * 6) * 10) / 10,
    completion: Math.round((50 + a.day1Index * 0.28 + rand() * 6) * 10) / 10,
  };
}

/** Bond de la part Release Radar après la dernière sortie (+55 à +144 %). */
export function releaseRadarBoost(artistId: string): number {
  return 55 + (hashString(`${artistId}:algo:rr-boost`) % 90);
}

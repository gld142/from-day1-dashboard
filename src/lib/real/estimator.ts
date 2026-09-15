/**
 * Estimateur « stream rémunérateur » (spec §5.1).
 *
 *   € brut master (jour, DSP) = streams rémunérables × taux(DSP, territoire, tier)
 *
 * Le taux part de l'ancrage France (SNEP 2025) mixé premium/gratuit, puis :
 *   × coefficient de territoire (Σ part de zone × coef de zone, cf. territory.ts)
 *   × coefficient par DSP (fourchette low/mid/high, cf. params.ts)
 *   × poids artist-centric pour Deezer (cf. dsp-mix.ts)
 * Un taux calibré (€/stream relevé sur un vrai décompte) remplace tout ça.
 *
 * Tout est exprimé en fourchette {low, mid, high} et porte une provenance :
 * la provenance d'un jour est la plus faible de ses DSP.
 */
import type { Artist, DSP, Provenance } from "@/lib/demo/types";
import { DSPS } from "@/lib/demo/types";
import { deezerWeight } from "./dsp-mix";
import {
  AUTHOR_SHARE_OF_PUBLISHING,
  DEAL_SHARE,
  DSP_COEF,
  PUBLISHING_SHARE_OF_DSP,
  YOUTUBE_COEF,
  blendedRate,
  type Tier,
} from "./params";
import type { Confidence, DailyEstimate, EstimatePeriod, EstimateSummary, Range } from "./types";

export type DayInput = {
  date: string;
  byDsp: Partial<Record<DSP, { streams: number; provenance: Provenance; youtubeTopicShare?: number }>>;
  /** Σ part de zone × coefficient de zone (territory.ts). */
  territoryCoef: number;
  tier: Tier;
  deezerPro: boolean;
  /** Part des streams rémunérables (0-1) : > 30 s, seuil Spotify, etc. */
  payableShare: number;
  /** Taux € / stream calibrés — remplacent coef × taux France pour ce DSP. */
  rateOverrides?: Partial<Record<DSP, number>>;
};

/* ─── Petits utilitaires de fourchette ─── */
const ZERO: Range = { low: 0, mid: 0, high: 0 };
/** Multiplie chaque borne par un scalaire. */
const scaleRange = (r: Range, k: number): Range => ({ low: r.low * k, mid: r.mid * k, high: r.high * k });
/** Somme borne à borne. */
const addRange = (a: Range, b: Range): Range => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
/** Produit borne à borne (low×low, mid×mid, high×high). */
const mulRange = (a: Range, b: Range): Range => ({ low: a.low * b.low, mid: a.mid * b.mid, high: a.high * b.high });
/** Interpolation linéaire borne à borne entre deux fourchettes. */
const lerpRange = (a: Range, b: Range, t: number): Range => addRange(scaleRange(a, 1 - t), scaleRange(b, t));

/* ─── Provenance ─── */
const PROVENANCE_ORDER: Provenance[] = ["measured", "reconstructed", "estimated", "simulated"];

/** La plus faible des provenances (measured < reconstructed < estimated < simulated). */
export function weakest(ps: Provenance[]): Provenance {
  let worst = 0;
  for (const p of ps) worst = Math.max(worst, PROVENANCE_ORDER.indexOf(p));
  return ps.length === 0 ? "simulated" : PROVENANCE_ORDER[worst];
}

/* ─── Estimation d'un jour ─── */
export function estimateDay(input: DayInput): DailyEstimate {
  // Taux France mixé premium/gratuit, corrigé du territoire d'écoute.
  const base = blendedRate(input.tier) * input.territoryCoef;
  const byDsp: DailyEstimate["byDsp"] = {};
  let streams = 0;
  let payableStreams = 0;
  let grossMaster = ZERO;
  const provenances: Provenance[] = [];

  for (const dsp of DSPS) {
    const entry = input.byDsp[dsp];
    if (!entry) continue;
    const payable = entry.streams * input.payableShare;
    const override = input.rateOverrides?.[dsp];
    let gross: Range;
    if (override !== undefined) {
      // Taux calibré : fourchette resserrée à ±5 % autour du taux relevé.
      gross = scaleRange({ low: 0.95, mid: 1, high: 1.05 }, payable * override);
    } else {
      // YouTube : mélange clips officiels (AVOD) / art tracks « Topic » selon la part fournie.
      const coef =
        dsp === "youtube" && entry.youtubeTopicShare !== undefined
          ? lerpRange(YOUTUBE_COEF.official, YOUTUBE_COEF.topic, entry.youtubeTopicShare)
          : DSP_COEF[dsp];
      // Deezer artist-centric : un stream de l'artiste pèse plus (ou moins) que la moyenne du pool.
      const weight = dsp === "deezer" ? deezerWeight({ pro: input.deezerPro }) : 1;
      gross = scaleRange(coef, payable * base * weight);
    }
    byDsp[dsp] = { streams: entry.streams, gross, provenance: entry.provenance };
    streams += entry.streams;
    payableStreams += payable;
    grossMaster = addRange(grossMaster, gross);
    provenances.push(entry.provenance);
  }

  return {
    date: input.date,
    streams: Math.round(streams),
    payableStreams: Math.round(payableStreams),
    byDsp,
    grossMaster,
    provenance: weakest(provenances),
  };
}

/* ─── Confiance ─── */
export function confidenceOf(provenance: Provenance, calibrated: boolean): Confidence {
  if (provenance === "measured") return calibrated ? "high" : "medium";
  if (provenance === "reconstructed") return calibrated ? "medium" : "indicative";
  return "indicative";
}

/* ─── Cascades ─── */
/** Part artiste du brut master selon le type de contrat (borne à borne). */
export function artistShare(gross: Range, dealType: Artist["dealType"]): Range {
  return mulRange(gross, DEAL_SHARE[dealType]);
}

/** Part auteur de l'édition : brut × part édition du DSP × part auteur dans l'édition. */
export function publishingShare(gross: Range): Range {
  return scaleRange(gross, PUBLISHING_SHARE_OF_DSP * AUTHOR_SHARE_OF_PUBLISHING);
}

/* ─── Agrégation sur une période ─── */
const PERIOD_DAYS: Record<EstimatePeriod, number> = { day: 1, week: 7, month: 30, year: 365 };

/** Résume les N derniers jours (tableau supposé trié par date croissante). */
export function summarize(
  days: DailyEstimate[],
  period: EstimatePeriod,
  opts: { calibrated: boolean; dealType: Artist["dealType"] },
): EstimateSummary {
  const slice = days.slice(-PERIOD_DAYS[period]);
  const grossMaster = slice.reduce((acc, d) => addRange(acc, d.grossMaster), ZERO);
  const provenance = weakest(slice.map((d) => d.provenance));
  return {
    period,
    from: slice[0]?.date ?? "",
    to: slice[slice.length - 1]?.date ?? "",
    streams: slice.reduce((s, d) => s + d.streams, 0),
    payableStreams: slice.reduce((s, d) => s + d.payableStreams, 0),
    grossMaster,
    artistShare: artistShare(grossMaster, opts.dealType),
    publishing: publishingShare(grossMaster),
    confidence: confidenceOf(provenance, opts.calibrated),
    provenance,
    calibrated: opts.calibrated,
  };
}

/** Mix DSP France corrigé par artiste (spec §5.2) et poids Deezer artist-centric. */
import type { DSP } from "@/lib/demo/types";
import { DSPS } from "@/lib/demo/types";
import { DEEZER_ARTIST_CENTRIC, DEEZER_RATIO_CLAMP, DEEZER_RATIO_MEDIAN, MARKET_MIX_FR } from "./params";

export type MixInput = { deezerFans: number | null; spotifyMonthlyListeners: number };

export function artistMix(input: MixInput): Record<DSP, number> {
  if (input.deezerFans === null || input.spotifyMonthlyListeners <= 0) return { ...MARKET_MIX_FR };
  const r = input.deezerFans / input.spotifyMonthlyListeners;
  const factor = Math.min(DEEZER_RATIO_CLAMP[1], Math.max(DEEZER_RATIO_CLAMP[0], r / DEEZER_RATIO_MEDIAN));
  const raw: Record<DSP, number> = { ...MARKET_MIX_FR, deezer: MARKET_MIX_FR.deezer * factor };
  const sum = DSPS.reduce((s, d) => s + raw[d], 0);
  const out = {} as Record<DSP, number>;
  for (const d of DSPS) out[d] = raw[d] / sum;
  return out;
}

/** Poids d'un stream Deezer de l'artiste relativement au stream Deezer moyen. */
export function deezerWeight(opts: { pro: boolean; activeShare?: number }): number {
  const { proBoost, activeBoost, activeShareDefault, averageWeight } = DEEZER_ARTIST_CENTRIC;
  const active = opts.activeShare ?? activeShareDefault;
  const own = (opts.pro ? proBoost : 1) * (active * activeBoost + (1 - active));
  return own / averageWeight;
}

export function isDeezerPro(opts: { monthlyStreams: number; monthlyListeners: number }): boolean {
  const t = DEEZER_ARTIST_CENTRIC.proThreshold;
  return opts.monthlyStreams >= t.streamsPerMonth && opts.monthlyListeners >= t.uniqueListeners;
}

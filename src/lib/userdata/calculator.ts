/**
 * Calculateur de revenus sur les TAUX RÉELS de l'artiste (son relevé importé) :
 * « avec X streams, combien ? » et « pour X €, combien de streams ? ». Ce n'est
 * pas une projection : un calcul sur ses propres taux, qui varient d'un mois à
 * l'autre (pays, abonnés gratuits/payants) — la page le dit.
 */
import type { DSP } from "@/lib/demo/types";
import type { UserData } from "./store";

/** Sous ce volume sur tout le relevé, le taux d'une plateforme ne veut rien dire. */
const MIN_STREAMS = 1_000;

export type Rate = { dsp: DSP; share: number; per1000: number };

export function platformRates(d: UserData): Rate[] {
  if (!d.revenueByMonthDsp) return [];
  const streams: Partial<Record<DSP, number>> = {};
  const revenue: Partial<Record<DSP, number>> = {};
  for (const per of Object.values(d.streamsByMonth)) for (const [k, n] of Object.entries(per) as [DSP, number][]) streams[k] = (streams[k] ?? 0) + n;
  for (const per of Object.values(d.revenueByMonthDsp)) for (const [k, n] of Object.entries(per) as [DSP, number][]) revenue[k] = (revenue[k] ?? 0) + n;
  const kept = (Object.keys(streams) as DSP[]).filter((k) => (streams[k] ?? 0) >= MIN_STREAMS && (revenue[k] ?? 0) > 0);
  const total = kept.reduce((s, k) => s + (streams[k] ?? 0), 0);
  return kept
    .map((dsp) => ({ dsp, share: (streams[dsp] ?? 0) / total, per1000: Math.round(((revenue[dsp] ?? 0) / (streams[dsp] ?? 1)) * 1000 * 10000) / 10000 }))
    .sort((a, b) => b.share - a.share);
}

const normalized = (rates: Rate[]) => {
  const sum = rates.reduce((s, r) => s + r.share, 0);
  return sum > 0 ? rates.map((r) => ({ ...r, share: r.share / sum })) : rates;
};

export function revenueFor(rates: Rate[], streams: number) {
  const lines = normalized(rates).map((r) => {
    const st = Math.round(streams * r.share);
    return { dsp: r.dsp, streams: st, revenue: Math.round((st * r.per1000) / 10) / 100 };
  });
  const total = Math.round(lines.reduce((s, l) => s + l.revenue, 0) * 100) / 100;
  return { lines, total, per1000: streams > 0 ? Math.round((total / streams) * 1000 * 100) / 100 : null };
}

/** Streams nécessaires pour `target` € au taux moyen pondéré par la répartition ; null sans taux. */
export function streamsFor(rates: Rate[], target: number): number | null {
  const blended = normalized(rates).reduce((s, r) => s + r.share * r.per1000, 0);
  return blended > 0 ? Math.round((target / blended) * 1000) : null;
}

/**
 * Calibration par relevé importé (spec §5.3).
 * Quand l'artiste a importé un relevé distributeur (mode « Mes données »),
 * on en déduit son taux réel moyen par stream, sa ventilation par DSP
 * (au prorata des coefficients par défaut) et son mix DSP réel.
 */
import type { DSP } from "@/lib/demo/types";
import type { UserData } from "@/lib/userdata/store";
import { DSP_COEF } from "./params";

export type Calibration = {
  averageRate: number; // € / stream moyen observé
  ratePerStream: Partial<Record<DSP, number>>; // ventilé par DSP : k × DSP_COEF[dsp].mid, k tel que Σ mix × taux = averageRate
  mix: Partial<Record<DSP, number>>; // parts réelles par DSP (somme 1)
  period: { from: string; to: string }; // mois min / max (triés)
};

export function calibrationFromUserData(ud: UserData | null): Calibration | null {
  if (!ud) return null;
  if (!ud.active) return null;
  if (ud.totalStreams <= 0) return null;
  if (ud.months.length === 0) return null;

  // Somme des streams par DSP sur tous les mois du relevé.
  const streamsByDsp: Partial<Record<DSP, number>> = {};
  let totalFromMonths = 0;
  for (const m of ud.months) {
    const bucket = ud.streamsByMonth[m] ?? {};
    for (const [dsp, streams] of Object.entries(bucket)) {
      const v = streams ?? 0;
      streamsByDsp[dsp as DSP] = (streamsByDsp[dsp as DSP] ?? 0) + v;
      totalFromMonths += v;
    }
  }
  const total = totalFromMonths > 0 ? totalFromMonths : ud.totalStreams;

  const mix: Partial<Record<DSP, number>> = {};
  for (const [dsp, streams] of Object.entries(streamsByDsp)) {
    mix[dsp as DSP] = (streams ?? 0) / total;
  }

  const averageRate = ud.totalRevenueEur / ud.totalStreams;

  // k tel que Σ mix[dsp] × k × DSP_COEF[dsp].mid = averageRate
  const weightedCoef = Object.entries(mix).reduce(
    (s, [dsp, part]) => s + (part ?? 0) * DSP_COEF[dsp as DSP].mid,
    0,
  );
  const k = weightedCoef > 0 ? averageRate / weightedCoef : 0;

  const ratePerStream: Partial<Record<DSP, number>> = {};
  for (const dsp of Object.keys(mix) as DSP[]) {
    ratePerStream[dsp] = k * DSP_COEF[dsp].mid;
  }

  const sortedMonths = [...ud.months].sort();

  return {
    averageRate,
    ratePerStream,
    mix,
    period: { from: sortedMonths[0], to: sortedMonths[sortedMonths.length - 1] },
  };
}

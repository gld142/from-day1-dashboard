/**
 * Reconstruction déterministe de l'historique quotidien d'un titre (spec §4.3).
 *
 * On connaît le total cumulé et le débit d'aujourd'hui ; on en déduit une série
 * de `days` points ancrée sur le débit relevé, avec saisonnalité hebdo, bruit
 * seedé (jamais Math.random : hydration serveur/client) et pic de sortie.
 * Chaque point porte sa provenance : `measured` pour aujourd'hui et les jours
 * réellement relevés, `reconstructed` pour le reste.
 */
import { isoDay, rngFor } from "@/lib/demo/seed";
import { RECONSTRUCT } from "./params";
import type { Provenance } from "./types";

export type ReconstructedDay = { date: string; streams: number; provenance: Provenance };

export type ReconstructInput = {
  key: string; // clé de seed stable, ex. "dadju:Reine"
  total: number; // streams cumulés du titre
  dailyNow: number; // débit relevé aujourd'hui
  days: number; // longueur de la série (se termine à `today`)
  today: Date;
  releaseDate?: string; // ISO ; si dans la fenêtre : 0 avant, pic décroissant après
  measured?: Record<string, number>; // date → streams réellement mesurés (remplacent)
};

const DAY_MS = 86_400_000;

/** Facteur de saisonnalité hebdo (0 = dimanche … 6 = samedi). */
function weeklyFactor(dow: number): number {
  const w = RECONSTRUCT.weekly;
  if (dow === 5) return w.fri;
  if (dow === 6) return w.sat;
  if (dow === 0) return w.sun;
  if (dow === 1) return w.mon;
  return w.other;
}

/** Poids de la rampe pour un jour à `i` jours d'aujourd'hui (w ≥ 0, w(0) = 1). */
function rampWeight(alpha: number, i: number, N: number): number {
  return Math.max(0, 1 - (alpha * i) / N);
}

/**
 * Résout α tel que Σ raw_j · w(α, i_j) = cible sur les jours 0..N−1 (hors aujourd'hui).
 * La somme est strictement décroissante en α (de Σ raw à 0 pour α = N) : bissection,
 * 60 itérations, purement arithmétique → déterministe.
 */
function solveRamp(raw: number[], N: number, cible: number): number {
  const sumAt = (alpha: number) => {
    let s = 0;
    for (let j = 0; j < N; j++) s += raw[j] * rampWeight(alpha, N - j, N);
    return s;
  };
  let lo = 0;
  let hi = N;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (sumAt(mid) > cible) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function reconstructTrack(input: ReconstructInput): ReconstructedDay[] {
  const { key, total, dailyNow, days, today, measured } = input;
  const rand = rngFor(`reconstruct:${key}`);
  const todayIso = isoDay(today);
  const release = input.releaseDate ? input.releaseDate.slice(0, 10) : null;
  const releaseMs = release ? Date.parse(`${release}T00:00:00Z`) : NaN;
  // Pic de sortie normalisé par sa valeur à l'âge d'aujourd'hui : la série brute
  // reste continue avec `dailyNow`, seule l'échelle du pic change (absorbée par
  // la contrainte de somme).
  const spikeAt = (ageDays: number) =>
    1 + RECONSTRUCT.releaseSpike * Math.exp(-ageDays / RECONSTRUCT.releaseDecayDays);
  const spikeToday = release ? spikeAt((today.getTime() - releaseMs) / DAY_MS) : 1;

  // 1. Série brute : débit × saisonnalité × bruit, modulée par la sortie.
  //    Le RNG est consommé à chaque jour, même à zéro, pour une séquence stable.
  const dates: string[] = [];
  const raw: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const date = isoDay(d);
    const noise = 1 + (rand() * 2 - 1) * RECONSTRUCT.noiseAmplitude;
    let v = dailyNow * weeklyFactor(d.getUTCDay()) * noise;
    if (release) {
      if (date < release) v = 0;
      else v *= spikeAt((d.getTime() - releaseMs) / DAY_MS) / spikeToday;
    }
    dates.push(date);
    raw.push(v);
  }

  // 2. Aujourd'hui est exactement le débit relevé.
  raw[days - 1] = dailyNow;

  // 3. Contrainte de somme sur les autres jours (jamais sur aujourd'hui), par une
  //    rampe linéaire continue à aujourd'hui : w_i = max(0, 1 − α·i/N), i = jours
  //    avant aujourd'hui (i = 0 → poids 1, donc raccord avec dailyNow). α > 0
  //    réduit le passé (si α > 1 la rampe touche zéro dans la fenêtre : le titre
  //    « naît » plus tard, sans saut) ; α < 0 le relève (poids > 1).
  //    Sortie dans la fenêtre : toute l'histoire est visible → somme = total.
  //    Sinon : plafond à 95 % du total (un vieux titre du catalogue a pu streamer
  //    bien plus que 365 × son débit actuel, on le laisse tel quel).
  const N = days - 1;
  const others = raw.slice(0, -1).reduce((a, v) => a + v, 0);
  const releaseInWindow = release !== null && release >= dates[0] && release <= todayIso;
  const cible = Math.max(0, (releaseInWindow ? total : 0.95 * total) - dailyNow);
  const weights: number[] = new Array<number>(days).fill(1);
  if (others > 0 && (releaseInWindow || others > cible)) {
    // Σ raw·(1 − α·i/N) = cible est linéaire en α : forme fermée exacte tant que la
    // rampe ne touche pas zéro (α ≤ 1) ; au-delà la borne à 0 impose la bissection.
    const moment = raw.slice(0, -1).reduce((a, v, j) => a + (v * (N - j)) / N, 0);
    const linear = (others - cible) / moment;
    const alpha = linear <= 1 ? linear : solveRamp(raw, N, cible);
    for (let j = 0; j < N; j++) weights[j] = rampWeight(alpha, N - j, N);
  }

  const series: ReconstructedDay[] = dates.map((date, i) => {
    const isToday = i === days - 1;
    const streams = isToday ? dailyNow : raw[i] * weights[i];
    return { date, streams: Math.max(0, Math.round(streams)), provenance: isToday ? "measured" : "reconstructed" };
  });

  // 4. Les jours réellement mesurés remplacent la reconstruction (sauf aujourd'hui).
  if (measured) {
    for (const p of series) {
      if (p.date !== todayIso && measured[p.date] !== undefined) {
        p.streams = Math.max(0, Math.round(measured[p.date]));
        p.provenance = "measured";
      }
    }
  }

  // 5. Garde finale : si la somme dépasse encore le total (arrondis, jours
  //    mesurés), on réduit proportionnellement les seuls jours reconstruits.
  //    Le floor garantit que la somme retombe sous le total.
  const sum = series.reduce((a, p) => a + p.streams, 0);
  if (sum > total) {
    const recon = series.filter((p) => p.provenance === "reconstructed");
    const reconSum = recon.reduce((a, p) => a + p.streams, 0);
    const f = reconSum > 0 ? Math.max(0, (reconSum - (sum - total)) / reconSum) : 0;
    for (const p of recon) p.streams = Math.max(0, Math.floor(p.streams * f));
  }

  return series;
}

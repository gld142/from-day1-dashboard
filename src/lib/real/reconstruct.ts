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

export function reconstructTrack(input: ReconstructInput): ReconstructedDay[] {
  const { key, total, dailyNow, days, today, measured } = input;
  const rand = rngFor(`reconstruct:${key}`);
  const todayIso = isoDay(today);
  const release = input.releaseDate ? input.releaseDate.slice(0, 10) : null;
  const releaseMs = release ? Date.parse(`${release}T00:00:00Z`) : NaN;

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
      else {
        const age = (d.getTime() - releaseMs) / DAY_MS;
        v *= 1 + RECONSTRUCT.releaseSpike * Math.exp(-age / RECONSTRUCT.releaseDecayDays);
      }
    }
    dates.push(date);
    raw.push(v);
  }

  // 2. Aujourd'hui est exactement le débit relevé.
  raw[days - 1] = dailyNow;

  // 3. Contrainte de somme, appliquée aux autres jours (jamais à aujourd'hui).
  //    Sortie dans la fenêtre : toute l'histoire du titre est visible → somme ≈ total.
  //    Sinon : plafond à 95 % du total (un vieux titre du catalogue a pu
  //    streamer bien plus que 365 × son débit actuel, on le laisse tel quel).
  const others = raw.slice(0, -1).reduce((a, v) => a + v, 0);
  const releaseInWindow = release !== null && release >= dates[0] && release <= todayIso;
  let factor = 1;
  if (others > 0) {
    if (releaseInWindow) factor = (total - dailyNow) / others;
    else if (others + dailyNow > 0.95 * total) factor = (0.95 * total - dailyNow) / others;
  }
  factor = Math.max(0, factor);

  const series: ReconstructedDay[] = dates.map((date, i) => {
    const isToday = i === days - 1;
    const streams = isToday ? dailyNow : raw[i] * factor;
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

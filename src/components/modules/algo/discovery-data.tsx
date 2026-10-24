"use client";

/**
 * Discovery Lab — inédits fictifs par artiste + scoring IA déterministe.
 * Les titres/BPM/tonalités sont des CONSTANTES de démo (comme les noms
 * d'artistes) ; les scores sont seedés par (artistId, titre).
 */
import { getArtist } from "@/lib/demo/api";
import { ALL_ARTISTS } from "@/lib/demo/data";
import { rngFor } from "@/lib/demo/seed";
import type { Artist, ArtistCategory } from "@/lib/demo/types";

export type DemoDef = {
  title: string;
  durationSec: number;
  bpm: number;
  key: string;
};

export type DemoSub = {
  tiktok: number;
  playlist: number;
  hit: number;
  hook: number;
};

export const DEMO_SUB_KEYS = ["tiktok", "playlist", "hit", "hook"] as const;

export type DemoTrack = DemoDef & {
  id: string;
  artistId: string;
  score: number;
  sub: DemoSub;
  rank: number;
};

/**
 * Inédits de démo — titres crédibles par artiste (constantes produit).
 * `Partial` : l'absence d'un artiste est visible au typage ; il reçoit alors
 * des inédits simulés qui lui sont propres (voir `placeholderDemoDefs`).
 */
const DEMOS: Partial<Record<string, DemoDef[]>> = {
  dadju: [
    { title: "Éclipse totale", durationSec: 204, bpm: 96, key: "Am" },
    { title: "Peau neuve", durationSec: 178, bpm: 108, key: "F#m" },
    { title: "Minuit moins le quart", durationSec: 221, bpm: 82, key: "Dm" },
    { title: "Apnée", durationSec: 185, bpm: 120, key: "Cm" },
    { title: "Lumière noire", durationSec: 198, bpm: 74, key: "Gm" },
  ],
  "nono-la-grinta": [
    { title: "Hors-jeu", durationSec: 167, bpm: 140, key: "Fm" },
    { title: "Plein phare", durationSec: 182, bpm: 128, key: "Gm" },
    { title: "Zone 8", durationSec: 155, bpm: 145, key: "C#m" },
    { title: "Dernier étage", durationSec: 191, bpm: 92, key: "Am" },
    { title: "Carbone", durationSec: 172, bpm: 134, key: "Ebm" },
  ],
  kiko: [
    { title: "Néon pâle", durationSec: 252, bpm: 122, key: "Am" },
    { title: "Signal perdu", durationSec: 228, bpm: 126, key: "Cm" },
    { title: "Warehouse 22", durationSec: 302, bpm: 128, key: "Fm" },
    { title: "Basse saison", durationSec: 236, bpm: 118, key: "Dm" },
  ],
};

/** L'artiste a-t-il des inédits propres (sinon il reçoit des inédits simulés) ? */
export function hasOwnDemos(artistId: string): boolean {
  return (DEMOS[artistId]?.length ?? 0) > 0;
}

/** Plage de BPM plausible par catégorie (bornes incluses). */
const BPM_RANGE: Record<ArtistCategory, [number, number]> = {
  urbain: [85, 140],
  variete: [70, 120],
  compositeur: [60, 110],
};

/** Tonalités mineures et majeures courantes — un tirage par titre. */
const KEYS = ["Am", "Bm", "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Bbm", "C", "D", "E", "F", "G", "A", "Bb", "Eb"];

/**
 * Inédits SIMULÉS d'un artiste sans inédits propres : trois substituts neutres
 * (« Inédit 1 · Leto »), BPM et tonalité tirés déterministement de son id, dans
 * la plage plausible de sa catégorie. Ce sont des réservations en attendant de
 * vrais inédits — jamais les titres d'un autre artiste. Avant (mesuré le
 * 24/10/2026), les huit artistes sans inédits recevaient les cinq de Dadju
 * (universal : ceux de Nono) et « Éclipse totale » était le « meilleur inédit »
 * de quatre artistes différents en vue label.
 */
export function placeholderDemoDefs(artist: Artist): DemoDef[] {
  const rand = rngFor(`${artist.id}:demo:placeholder`);
  const [lo, hi] = BPM_RANGE[artist.category];
  return [1, 2, 3].map((n) => ({
    title: `Inédit ${n} · ${artist.name}`,
    durationSec: 150 + Math.round(rand() * 90),
    bpm: lo + Math.round(rand() * (hi - lo)),
    key: KEYS[Math.floor(rand() * KEYS.length)],
  }));
}

/**
 * Les inédits d'un artiste : les siens s'il en a, sinon ses simulés. La page
 * discovery lit `demos[0]` sans garde : cette fonction ne rend JAMAIS une liste
 * vide — un id hors du roster complet est un état impossible, et lève.
 */
function demoDefsFor(artistId: string): DemoDef[] {
  const own = DEMOS[artistId];
  if (own && own.length > 0) return own;
  const artist = ALL_ARTISTS.find((a) => a.id === artistId);
  if (!artist) {
    throw new Error(
      `Inédits demandés pour « ${artistId} », qui n'est pas un artiste du roster complet : état impossible, discovery ne reçoit que des artistes du roster.`,
    );
  }
  return placeholderDemoDefs(artist);
}

/**
 * Inédits scorés d'un artiste, triés du meilleur au moins bon. Deux inédits au
 * même score seraient affichés à égalité de rang pour un rang différent : le
 * second est abaissé d'un point (déterministe, et le badge « simulé » dit déjà
 * que la décimale ne vaut rien).
 */
export function demosFor(artistId: string): DemoTrack[] {
  const scored = demoDefsFor(artistId)
    .map((d, i) => {
      const rand = rngFor(`${artistId}:demo:${d.title}`);
      const sub: DemoSub = {
        tiktok: Math.round(34 + rand() * 62),
        playlist: Math.round(38 + rand() * 58),
        hit: Math.round(30 + rand() * 64),
        hook: Math.round(36 + rand() * 60),
      };
      const score = Math.round(
        sub.tiktok * 0.3 + sub.playlist * 0.25 + sub.hit * 0.2 + sub.hook * 0.25,
      );
      return { ...d, id: `${artistId}-demo-${i}`, artistId, score, sub, rank: 0 };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].score >= scored[i - 1].score) scored[i].score = scored[i - 1].score - 1;
  }
  return scored.map((d, i) => ({ ...d, rank: i + 1 }));
}

export type DemoTier = "priority" | "strong" | "promising" | "development";

export function demoTier(d: DemoTrack): DemoTier {
  if (d.rank === 1) return "priority";
  if (d.score >= 75) return "strong";
  if (d.score >= 60) return "promising";
  return "development";
}

/** Streams estimés 1re semaine si sorti en single (dérivé des auditeurs). */
export function firstWeekEstimate(artistId: string, demo: DemoTrack): number {
  const a = getArtist(artistId);
  return Math.round(a.monthlyListeners * 0.06 * (demo.score / 100));
}

export function fmtDurationSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

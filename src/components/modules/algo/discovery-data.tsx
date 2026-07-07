"use client";

/**
 * Discovery Lab — inédits fictifs par artiste + scoring IA déterministe.
 * Les titres/BPM/tonalités sont des CONSTANTES de démo (comme les noms
 * d'artistes) ; les scores sont seedés par (artistId, titre).
 */
import { getArtist } from "@/lib/demo/api";
import { rngFor } from "@/lib/demo/seed";

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

/** Inédits de démo — titres crédibles par artiste (constantes produit). */
const DEMOS: Record<string, DemoDef[]> = {
  "sky-lune": [
    { title: "Éclipse totale", durationSec: 204, bpm: 96, key: "Am" },
    { title: "Peau neuve", durationSec: 178, bpm: 108, key: "F#m" },
    { title: "Minuit moins le quart", durationSec: 221, bpm: 82, key: "Dm" },
    { title: "Apnée", durationSec: 185, bpm: 120, key: "Cm" },
    { title: "Lumière noire", durationSec: 198, bpm: 74, key: "Gm" },
  ],
  kayro: [
    { title: "Hors-jeu", durationSec: 167, bpm: 140, key: "Fm" },
    { title: "Plein phare", durationSec: 182, bpm: 128, key: "Gm" },
    { title: "Zone 8", durationSec: 155, bpm: 145, key: "C#m" },
    { title: "Dernier étage", durationSec: 191, bpm: 92, key: "Am" },
    { title: "Carbone", durationSec: 172, bpm: 134, key: "Ebm" },
  ],
  vela: [
    { title: "Néon pâle", durationSec: 252, bpm: 122, key: "Am" },
    { title: "Signal perdu", durationSec: 228, bpm: 126, key: "Cm" },
    { title: "Warehouse 22", durationSec: 302, bpm: 128, key: "Fm" },
    { title: "Basse saison", durationSec: 236, bpm: 118, key: "Dm" },
  ],
  "mira-sol": [
    { title: "Lagune", durationSec: 192, bpm: 104, key: "F" },
    { title: "Soleil de plomb", durationSec: 174, bpm: 110, key: "Am" },
    { title: "Wax", durationSec: 183, bpm: 98, key: "Gm" },
    { title: "Caramel", durationSec: 201, bpm: 102, key: "C" },
    { title: "Douala Nights", durationSec: 217, bpm: 95, key: "Em" },
  ],
  "leon-brume": [
    { title: "Les volets clos", durationSec: 224, bpm: 76, key: "C" },
    { title: "Novembre encore", durationSec: 245, bpm: 68, key: "Am" },
    { title: "Grand-rue", durationSec: 202, bpm: 84, key: "G" },
    { title: "À marée basse", durationSec: 238, bpm: 72, key: "Em" },
  ],
  orka: [
    { title: "Fracture", durationSec: 215, bpm: 148, key: "Em" },
    { title: "Sous la cendre", durationSec: 258, bpm: 132, key: "Bm" },
    { title: "Moteur froid", durationSec: 192, bpm: 155, key: "Am" },
    { title: "Vertige 9", durationSec: 227, bpm: 140, key: "Dm" },
  ],
};

/** Inédits scorés d'un artiste, triés du meilleur au moins bon. */
export function demosFor(artistId: string): DemoTrack[] {
  const defs = DEMOS[artistId] ?? DEMOS["sky-lune"];
  return defs
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
    .sort((a, b) => b.score - a.score)
    .map((d, i) => ({ ...d, rank: i + 1 }));
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

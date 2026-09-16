/**
 * Signal TikTok — viralité, PAS revenu.
 *
 * TikTok est exclu des séries de streams (pas un stream rémunéré, et la page
 * publique d'un son sert une coquille anti-bot : rien à relever). On le remet
 * sur Pulse comme SIGNAL : combien de vidéos utilisent les sons de l'artiste,
 * le delta depuis hier, le titre le plus repris, le rang dans les tendances FR.
 *
 * Deux branches :
 *   - MESURÉ  : le dernier relevé porte `tiktok.sounds` (Soundcharts « TikTok
 *               video count » par titre, ou compte TikTok connecté par l'artiste).
 *   - SIMULÉ  : sinon, tirage déterministe ancré sur les auditeurs mensuels
 *               Spotify (mesurés) — badge « simulé » obligatoire à l'affichage.
 *
 * Tout est déterministe (rngFor, pas de Date.now) : mêmes chiffres serveur/client.
 */
import { getArtist } from "@/lib/demo/data";
import { DEMO_TODAY, rngFor } from "@/lib/demo/seed";
import { realTopTracks, type Snaps } from "./real-source";
import { SNAPSHOTS } from "./snapshots";
import type { Snapshot, TikTokSignal, TikTokSound } from "./types";

/* ─── Hypothèses de la branche simulée ─── */
/** Vidéos TikTok par auditeur mensuel Spotify — fourchette HYPOTHÈSE [1,2 % ; 3 %]. */
const VIDEOS_PER_LISTENER_MIN = 0.012;
const VIDEOS_PER_LISTENER_MAX = 0.03;
/** Nouvelles vidéos par jour en fraction du cumul — fourchette HYPOTHÈSE [0,2 % ; 0,6 %]. */
const DAILY_SHARE_MIN = 0.002;
const DAILY_SHARE_SPAN = 0.004;
/** Au-dessus de ce seuil d'auditeurs, l'artiste « a » un rang dans les tendances France. */
const TRENDING_LISTENERS_MIN = 1_000_000;
/** Rang simulé tiré dans [8 ; 60] — jamais le top 7, réservé au vrai relevé. */
const TRENDING_RANK_MIN = 8;
const TRENDING_RANK_MAX = 60;

function sumVideos(sounds: TikTokSound[]): number {
  return sounds.reduce((s, x) => s + x.videoCount, 0);
}

/** Relevé TikTok exploitable : au moins un son. */
function measuredSounds(snap: Snapshot | undefined): TikTokSound[] | null {
  const sounds = snap?.tiktok?.sounds;
  return sounds && sounds.length > 0 ? sounds : null;
}

/* ─── Branche mesurée ─── */
function measuredSignal(last: Snapshot, sounds: TikTokSound[], before: Snapshot | undefined): TikTokSignal {
  const videos = sumVideos(sounds);
  const prevSounds = measuredSounds(before);
  const top = sounds.reduce((a, s) => (s.videoCount > a.videoCount ? s : a), sounds[0]);
  return {
    videos,
    deltaYesterday: prevSounds ? videos - sumVideos(prevSounds) : 0,
    topSound: top.name,
    trendingRankFr: last.tiktok?.trendingRankFr ?? null,
    provenance: "measured",
  };
}

/* ─── Branche simulée ─── */
function simulatedSignal(artistId: string, last: Snapshot, snapshots: Snaps, today: Date): TikTokSignal {
  const rand = rngFor(`tiktok:${artistId}`);
  const listeners = last.spotify.monthlyListeners ?? getArtist(artistId).monthlyListeners;

  // Ordre des tirages fixé : ratio, puis part quotidienne, puis rang.
  const ratio = VIDEOS_PER_LISTENER_MIN + rand() * (VIDEOS_PER_LISTENER_MAX - VIDEOS_PER_LISTENER_MIN);
  const videos = Math.round(listeners * ratio);
  const deltaYesterday = Math.round(videos * (DAILY_SHARE_MIN + rand() * DAILY_SHARE_SPAN));
  const rankDraw = rand();
  const trendingRankFr =
    listeners > TRENDING_LISTENERS_MIN
      ? TRENDING_RANK_MIN + Math.floor(rankDraw * (TRENDING_RANK_MAX - TRENDING_RANK_MIN + 1))
      : null;

  // Le son le plus repris = le titre Spotify le plus streamé sur 30 jours.
  const topSound = realTopTracks(artistId, 30, 1, today, snapshots)[0]?.title ?? null;

  return { videos, deltaYesterday, topSound, trendingRankFr, provenance: "simulated" };
}

/* ─── API publique ─── */
export function tiktokSignal(artistId: string, snapshots: Snaps = SNAPSHOTS, today: Date = DEMO_TODAY): TikTokSignal {
  const snaps = snapshots[artistId];
  if (!snaps || snaps.length === 0) throw new Error(`Aucun relevé réel pour « ${artistId} »`);
  const last = snaps[snaps.length - 1];
  const sounds = measuredSounds(last);
  return sounds
    ? measuredSignal(last, sounds, snaps[snaps.length - 2])
    : simulatedSignal(artistId, last, snapshots, today);
}

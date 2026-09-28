/**
 * Vidéos TikTok qui utilisent le son d'un artiste — COLLÉES par l'équipe, jamais
 * cherchées par un robot (les CGU TikTok, art. 4.5 EEE, interdisent l'extraction
 * automatisée). Day 1 lit seulement la fiche officielle de la vidéo (oEmbed),
 * que TikTok ouvre à tous les sites. Mesuré le 28/09/2026 : 200 sans clé, faux
 * identifiant → 400 ; créateur, titre, son et miniature ; PAS de vues (saisies à
 * la main) ; la miniature est une adresse signée qui expire (~2 jours).
 */
import { FetchError, fetchWithRetry, type RetryOptions } from "@/lib/collect/fetch";

export type TikTokRef = { handle: string; videoId: string; url: string };
/** Une vidéo collée, telle que lue en base (tiktok_videos). */
export type TikTokVideo = {
  id: string;
  created_at: string;
  artist_id: string;
  video_id: string;
  video_url: string;
  author_name: string | null;
  author_handle: string | null;
  title: string | null;
  sound_title: string | null;
  sound_url: string | null;
  thumbnail_url: string | null;
  thumbnail_expires_at: string | null;
  status: "ok" | "gone";
  checked_at: string;
  views: number | null;
  views_on: string | null;
  notes: string | null;
};
export type OembedInfo = {
  author_name: string | null;
  author_handle: string | null;
  title: string | null;
  sound_title: string | null;
  sound_url: string | null;
  thumbnail_url: string | null;
  thumbnail_expires_at: string | null;
};

const VIDEO = /^(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{1,100})\/video\/(\d{5,25})(?:[/?#].*)?$/;
const SHORT = /^(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\/|tiktok\.com\/t\//;

export function parseTikTokUrl(input: string): { ok: true; value: TikTokRef } | { ok: false; error: string } {
  const t = input.trim();
  if (SHORT.test(t)) return { ok: false, error: "Lien court : ouvre-le, puis copie l'adresse complète de la vidéo (tiktok.com/@pseudo/video/…)." };
  const m = VIDEO.exec(t);
  if (!m) return { ok: false, error: "Colle le lien d'une vidéo TikTok (tiktok.com/@pseudo/video/…)." };
  return { ok: true, value: { handle: m[1], videoId: m[2], url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}` } };
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', "#39": "'", apos: "'", lt: "<", gt: ">" };
const decode = (s: string) => s.replace(/&(amp|quot|#39|apos|lt|gt);/g, (_, e: string) => ENTITIES[e]);
const clip = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.normalize("NFC").trim().slice(0, max) : null);

export function parseOembed(json: unknown): OembedInfo {
  const o = json as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || typeof o.html !== "string" || (typeof o.author_unique_id !== "string" && typeof o.author_name !== "string")) {
    throw new Error("TikTok : format de fiche inattendu");
  }
  // Le son : le lien /music/… du bloc d'intégration, et son texte « ♬ nom du son ».
  const sound = /<a[^>]*href="(https:\/\/www\.tiktok\.com\/music\/[^"?#]+)[^"]*"[^>]*>([^<]*)<\/a>/.exec(o.html);
  const thumb = clip(o.thumbnail_url, 2000);
  const expires = thumb ? /[?&]x-expires=(\d{9,11})/.exec(thumb) : null;
  return {
    author_name: clip(o.author_name, 200),
    author_handle: clip(o.author_unique_id, 100),
    title: clip(o.title, 2500),
    sound_title: sound ? clip(decode(sound[2]).replace(/^♬\s*/, ""), 300) : null,
    sound_url: sound ? clip(sound[1], 500) : null,
    thumbnail_url: thumb,
    thumbnail_expires_at: expires ? new Date(Number(expires[1]) * 1000).toISOString() : null,
  };
}

/** La fiche officielle d'une vidéo, ou "gone" si TikTok ne la connaît pas (supprimée ou privée). */
export async function fetchOembed(url: string, opts: RetryOptions = {}): Promise<OembedInfo | "gone"> {
  try {
    const res = await fetchWithRetry(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { tries: 3, timeoutMs: 10_000, ...opts });
    return parseOembed(await res.json());
  } catch (e) {
    if (e instanceof FetchError && (e.status === 400 || e.status === 404)) return "gone";
    throw e;
  }
}

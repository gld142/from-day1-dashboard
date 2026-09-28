/**
 * Saisies TikTok de l'équipe :
 *  - une vidéo qui utilise le son de l'artiste, par son lien (Day 1 lit ensuite
 *    sa fiche officielle) ; ses vues, recopiées à la main et datées ;
 *  - les chiffres recopiés depuis TikTok for Artists (compte ou titre), qui ne
 *    servent QU'À l'espace du client (CGU TikTok for Artists §5.c).
 */
import { UUID, date, fail, guard, intOrNull, text } from "@/lib/registers/common";
import { normTitle } from "@/lib/splits/split";
import { parseTikTokUrl, type TikTokRef } from "./video";

const MAX = 1_000_000_000_000;

function views(raw: Record<string, string | undefined>, today: string) {
  const v = intOrNull(raw.views, MAX);
  if (v === null) return { views: null, views_on: null };
  const on = date(raw.views_on) ?? today;
  if (on > today) fail("La date des vues est dans le futur.");
  return { views: v, views_on: on };
}

export function parseVideoInput(raw: Record<string, string | undefined>, today: string) {
  return guard((): { artist_id: string; ref: TikTokRef; views: number | null; views_on: string | null; notes: string | null } => {
    if (!UUID.test(raw.artist_id ?? "")) fail("Choisis l'artiste dont c'est le son.");
    const ref = parseTikTokUrl(raw.video_url ?? "");
    if (!ref.ok) fail(ref.error);
    return { artist_id: raw.artist_id!, ref: (ref as { ok: true; value: TikTokRef }).value, ...views(raw, today), notes: text(raw.notes, 2000) };
  });
}

export const parseViews = (raw: Record<string, string | undefined>, today: string) => guard(() => views(raw, today));

export const TIKTOK_PERIODS = [7, 28, 60, 365] as const;
const ACCOUNT_KEYS = ["followers", "likes", "video_views", "profile_views"] as const;
const TRACK_KEYS = ["track_videos", "track_views"] as const;
/** Chiffres qui dépendent de la période choisie dans TikTok for Artists (les abonnés et likes sont des totaux). */
const PERIOD_KEYS = new Set(["video_views", "profile_views", "track_videos", "track_views"]);
export type StatKey = (typeof ACCOUNT_KEYS)[number] | (typeof TRACK_KEYS)[number];

export type TikTokStatsInput = {
  artist_id: string;
  as_of: string;
  scope: "account" | "track";
  track_title: string | null;
  period_days: number | null;
  followers: number | null;
  likes: number | null;
  video_views: number | null;
  profile_views: number | null;
  track_videos: number | null;
  track_views: number | null;
  notes: string | null;
};
export type TikTokStat = TikTokStatsInput & { id: string; updated_at: string };

export function parseTikTokStats(raw: Record<string, string | undefined>, today: string) {
  return guard((): TikTokStatsInput => {
    if (!UUID.test(raw.artist_id ?? "")) fail("Choisis l'artiste.");
    const as_of = date(raw.as_of, "Indique la date du relevé.")!;
    if (as_of > today) fail("La date du relevé est dans le futur.");
    const track_title = text(raw.track_title, 300);
    const scope = track_title ? "track" : "account";
    const keep = scope === "track" ? TRACK_KEYS : ACCOUNT_KEYS;
    const n = Object.fromEntries([...ACCOUNT_KEYS, ...TRACK_KEYS].map((k) => [k, (keep as readonly string[]).includes(k) ? intOrNull(raw[k], MAX) : null])) as Record<StatKey, number | null>;
    if (keep.every((k) => n[k] === null)) fail("Saisis au moins un chiffre relevé dans TikTok for Artists.");
    const p = (raw.period_days ?? "").trim();
    const period_days = p ? Number(p) : null;
    if (period_days !== null && !(TIKTOK_PERIODS as readonly number[]).includes(period_days)) fail("Période : 7, 28, 60 ou 365 jours.");
    if (period_days === null && keep.some((k) => PERIOD_KEYS.has(k) && n[k] !== null)) fail("Indique la période affichée dans TikTok for Artists (7, 28, 60 ou 365 jours).");
    return { artist_id: raw.artist_id!, as_of, scope, track_title, period_days, ...n, notes: text(raw.notes, 2000) };
  });
}

export type StatPair = { latest: TikTokStat; previous: TikTokStat | null };

/** Dernier relevé et précédent, pour le compte et pour chaque titre (titres rapprochés sans casse ni accents). */
export function statPairs(rows: TikTokStat[]): { account: StatPair | null; tracks: StatPair[] } {
  const groups = new Map<string, TikTokStat[]>();
  for (const r of rows) {
    const key = r.scope === "track" && r.track_title ? `t:${normTitle(r.track_title)}` : "account";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const pair = (list: TikTokStat[]): StatPair => {
    const s = [...list].sort((a, b) => b.as_of.localeCompare(a.as_of) || b.updated_at.localeCompare(a.updated_at));
    return { latest: s[0], previous: s[1] ?? null };
  };
  const account = groups.get("account");
  groups.delete("account");
  return {
    account: account ? pair(account) : null,
    tracks: [...groups.values()].map(pair).sort((a, b) => (b.latest.track_views ?? b.latest.track_videos ?? 0) - (a.latest.track_views ?? a.latest.track_videos ?? 0)),
  };
}

/** Évolution d'un chiffre entre deux relevés ; `null` si l'un manque ou si la période diffère. */
export function statDelta(latest: TikTokStat, previous: TikTokStat | null, key: StatKey): number | null {
  if (!previous || latest[key] === null || previous[key] === null) return null;
  if (PERIOD_KEYS.has(key) && latest.period_days !== previous.period_days) return null;
  return (latest[key] as number) - (previous[key] as number);
}

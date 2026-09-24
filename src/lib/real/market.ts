/**
 * Couche réelle « marché » : parts du Top 200 Spotify France (relevé Kworb
 * quotidien, src/lib/real/snapshots/market/<date>.json) par groupe, artiste
 * ou genre, et lecture du matin à base de règles — pas de LLM.
 *
 * Périmètre, à dire tel quel : ce sont les parts des streams Spotify France
 * du Top 200 quotidien (mesuré), pas le marché total (tous DSP, toute la
 * longue traîne). Le groupe vient des lignes ℗ / © de la page Spotify du titre
 * (mesuré, cf. market/groups.ts) ; le genre d'une table manuelle (renseigné).
 *
 * Tout est déterministe : mêmes chiffres serveur et client.
 */
import { INDIES, MAJORS, type MarketGroup } from "./market/groups";
import { MARKET, MARKET_DATES } from "./snapshots";
import type { MarketGenre, MarketSnapshot, MarketTrack, Provenance } from "./types";

export type MarketDimension = "group" | "artist" | "genre";
export type MarketMetric = "streams" | "streams7d";
export type MarketSnapshots = Record<string, MarketSnapshot>;

export type MarketShareRow = {
  /** Identifiant : groupe (`MarketGroup`), nom d'artiste, ou genre (`MarketGenre`). */
  key: string;
  /** Libellé brut : nom d'artiste ; pour groupe et genre, la clé (la page traduit). */
  label: string;
  streams: number;
  /** Part du Top 200 sur le métrique demandé, 0-1. */
  share: number;
  /** Nombre de titres de la ligne dans le Top 200. */
  tracks: number;
  topTrack: { rank: number; artist: string; title: string; streams: number } | null;
  /** Part du jour − part sur 7 jours, en points (positif = en progression). */
  delta7d: number;
  provenance: Provenance;
};

const ORDER: Provenance[] = ["measured", "declared", "reconstructed", "estimated", "simulated"];
const weakest = (ps: Provenance[]): Provenance =>
  ps.reduce((w, p) => (ORDER.indexOf(p) > ORDER.indexOf(w) ? p : w), "measured");

/** Le relevé d'une date (par défaut le plus récent), ou null s'il n'y en a aucun. */
export function marketSnapshot(date?: string, snapshots: MarketSnapshots = MARKET): MarketSnapshot | null {
  if (date) return snapshots[date] ?? null;
  const dates = Object.keys(snapshots).sort();
  const last = dates[dates.length - 1];
  return last ? snapshots[last] : null;
}

/** Dates disponibles, croissantes. */
export function marketDates(snapshots: MarketSnapshots = MARKET): string[] {
  return snapshots === MARKET ? MARKET_DATES : Object.keys(snapshots).sort();
}

function keyOf(t: MarketTrack, dim: MarketDimension): string {
  if (dim === "group") return t.label.group;
  if (dim === "genre") return t.genre;
  return t.artist;
}

function rowProvenance(dim: MarketDimension, tracks: MarketTrack[]): Provenance {
  if (dim === "group") return weakest(tracks.map((t) => t.label.provenance));
  if (dim === "genre") return tracks[0]?.genre === "unknown" ? "estimated" : "declared";
  return "measured";
}

/** Un filtre de ventilation imbriquée : ne garder que les titres dont `dim` vaut `key`. */
export type MarketWithin = { dim: MarketDimension; key: string };

/**
 * Parts par dimension : lignes triées par streams décroissants. `share` porte
 * sur le métrique demandé ; `delta7d` compare toujours la part du jour à la
 * part sur 7 jours (en points). `within` restreint les lignes aux titres d'une
 * ligne parente (Groupe ▸ Artiste…) — les parts restent celles du Top 200
 * entier, comparables d'un parent à l'autre.
 */
export function sharesBy(
  dim: MarketDimension,
  opts: { date?: string; metric?: MarketMetric; tracks?: MarketTrack[]; within?: MarketWithin[] } = {},
  snapshots: MarketSnapshots = MARKET,
): MarketShareRow[] {
  const all = opts.tracks ?? marketSnapshot(opts.date, snapshots)?.tracks ?? [];
  const metric = opts.metric ?? "streams";
  const totalDay = all.reduce((s, t) => s + t.streams, 0);
  const total7d = all.reduce((s, t) => s + t.streams7d, 0);
  const total = metric === "streams" ? totalDay : total7d;
  const tracks = (opts.within ?? []).reduce((ts, w) => ts.filter((t) => keyOf(t, w.dim) === w.key), all);

  const groups = new Map<string, MarketTrack[]>();
  for (const t of tracks) {
    const k = keyOf(t, dim);
    const arr = groups.get(k);
    if (arr) arr.push(t);
    else groups.set(k, [t]);
  }

  return Array.from(groups.entries())
    .map(([key, ts]) => {
      const streams = ts.reduce((s, t) => s + t[metric], 0);
      const day = ts.reduce((s, t) => s + t.streams, 0);
      const week = ts.reduce((s, t) => s + t.streams7d, 0);
      const shareDay = totalDay === 0 ? 0 : day / totalDay;
      const share7d = total7d === 0 ? 0 : week / total7d;
      const top = ts.reduce((best, t) => (t[metric] > best[metric] ? t : best), ts[0]);
      return {
        key,
        label: key,
        streams,
        share: total === 0 ? 0 : streams / total,
        tracks: ts.length,
        topTrack: { rank: top.rank, artist: top.artist, title: top.title, streams: top[metric] },
        delta7d: (shareDay - share7d) * 100,
        provenance: rowProvenance(dim, ts),
      };
    })
    .sort((a, b) => b.streams - a.streams || a.key.localeCompare(b.key));
}

/** Groupe d'un artiste (celui qui porte le plus de ses streams du jour), null s'il est absent du Top 200. */
export function groupOf(artist: string, date?: string, snapshots: MarketSnapshots = MARKET): MarketGroup | null {
  const name = artist.trim().toLowerCase();
  const tracks = (marketSnapshot(date, snapshots)?.tracks ?? []).filter((t) => t.artist.toLowerCase() === name);
  if (tracks.length === 0) return null;
  const by = new Map<MarketGroup, number>();
  for (const t of tracks) by.set(t.label.group, (by.get(t.label.group) ?? 0) + t.streams);
  return Array.from(by.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

/* ─── Méta ─── */

export type MarketMeta = {
  date: string;
  capturedAt: string;
  chartDate: string | null;
  source: string;
  tracks: number;
  artists: number;
  /** Titres dont la page Spotify n'a pas donné de ℗ / © (groupe « unknown », estimé). */
  unknownLabels: number;
  /** Titres dont l'artiste n'est pas dans la table des genres. */
  unknownGenres: number;
};

export function marketMeta(date?: string, snapshots: MarketSnapshots = MARKET): MarketMeta | null {
  const s = marketSnapshot(date, snapshots);
  if (!s) return null;
  return {
    date: s.date,
    capturedAt: s.capturedAt,
    chartDate: s.chartDate,
    source: s.source,
    tracks: s.tracks.length,
    artists: new Set(s.tracks.map((t) => t.artist)).size,
    unknownLabels: s.tracks.filter((t) => t.label.group === "unknown").length,
    unknownGenres: s.tracks.filter((t) => t.genre === "unknown").length,
  };
}

/* ─── Lecture du matin (règles, pas de LLM) ─── */

/** Un artiste du roster à repérer dans le Top 200 : par identifiant Spotify d'abord, sinon par nom. */
export type RosterRef = { id: string; name: string; spotifyId?: string };

export type RosterPresence = {
  id: string;
  name: string;
  /** Titres où l'artiste est principal ou invité. */
  tracks: number;
  /** Parmi eux, ceux où il est seulement invité — un featuring n'est pas sa sortie. */
  featured: number;
  bestRank: number | null;
  bestTitle: string | null;
};

/**
 * Faits structurés de la lecture ; la page les met en phrases (fr / en).
 * Les parts sont en pourcentage (0-100), les deltas en points.
 */
export type MorningReading = {
  /** Les trois majors, de la première à la troisième. */
  majors: Array<{ group: MarketGroup; share: number; delta7d: number }>;
  /** Grands indés (Believe, Because, Play Two, Wagram…) agrégés. */
  indies: { share: number; delta7d: number };
  /** Labels indépendants hors groupes identifiés (« other »). */
  other: { share: number };
  /** Titres sans label lu. */
  unknown: { share: number; tracks: number };
  /** Part du rap, et premier genre. */
  genres: { rap: number; top: MarketGenre; topShare: number };
  leader: { rank: number; artist: string; title: string; streams: number } | null;
  roster: RosterPresence[];
  provenance: Provenance;
};

const sameArtist = (t: MarketTrack, a: RosterRef): boolean => {
  if (a.spotifyId && t.artistId) {
    if (t.artistId === a.spotifyId) return true;
  }
  const n = a.name.trim().toLowerCase();
  return t.artist.toLowerCase() === n || t.featuring.some((f) => f.toLowerCase() === n);
};

export function rosterPresence(roster: RosterRef[], tracks: MarketTrack[]): RosterPresence[] {
  return roster.map((a) => {
    const mine = tracks.filter((t) => sameArtist(t, a)).sort((x, y) => x.rank - y.rank);
    const n = a.name.trim().toLowerCase();
    return {
      id: a.id,
      name: a.name,
      tracks: mine.length,
      featured: mine.filter((t) => t.artist.toLowerCase() !== n).length,
      bestRank: mine[0]?.rank ?? null,
      bestTitle: mine[0]?.title ?? null,
    };
  });
}

/**
 * Titres DISTINCTS du classement où un artiste du roster figure — principal
 * ou invité.
 *
 * Mesuré le 18/09 : `sharesBy("artist")` groupe par artiste PRINCIPAL, donc
 * « RnBoi feat. Nono La Grinta » (n° 129) tombait du décompte et la page
 * annonçait 3 titres pendant que sa propre lecture en détaillait 4. Un
 * featuring dans le Top 200 reste un titre de l'artiste : on le compte.
 * Le filtre porte sur les titres, donc un titre réunissant deux artistes du
 * roster ne compte qu'une fois.
 */
export function rosterTrackCount(roster: RosterRef[], tracks: MarketTrack[]): number {
  return tracks.filter((t) => roster.some((a) => sameArtist(t, a))).length;
}

export function morningReading(
  roster: RosterRef[],
  date?: string,
  snapshots: MarketSnapshots = MARKET,
): MorningReading | null {
  const s = marketSnapshot(date, snapshots);
  if (!s) return null;
  const tracks = s.tracks;
  const byGroup = sharesBy("group", { tracks });
  const row = (g: MarketGroup) => byGroup.find((r) => r.key === g);
  const pct = (x: number) => x * 100;
  const sum = (gs: readonly MarketGroup[]) =>
    gs.reduce(
      (acc, g) => {
        const r = row(g);
        return r ? { share: acc.share + pct(r.share), delta7d: acc.delta7d + r.delta7d } : acc;
      },
      { share: 0, delta7d: 0 },
    );

  const majors = MAJORS.map((g) => {
    const r = row(g);
    return { group: g, share: r ? pct(r.share) : 0, delta7d: r?.delta7d ?? 0 };
  }).sort((a, b) => b.share - a.share);
  const indies = sum(INDIES);
  const other = row("other");
  const unknown = row("unknown");

  const byGenre = sharesBy("genre", { tracks });
  const rap = byGenre.find((r) => r.key === "rap");
  const topGenre = byGenre[0];

  const leader = tracks.reduce<MarketTrack | null>((best, t) => (!best || t.streams > best.streams ? t : best), null);

  return {
    majors,
    indies,
    other: { share: other ? pct(other.share) : 0 },
    unknown: { share: unknown ? pct(unknown.share) : 0, tracks: unknown?.tracks ?? 0 },
    genres: {
      rap: rap ? pct(rap.share) : 0,
      top: (topGenre?.key ?? "unknown") as MarketGenre,
      topShare: topGenre ? pct(topGenre.share) : 0,
    },
    leader: leader ? { rank: leader.rank, artist: leader.artist, title: leader.title, streams: leader.streams } : null,
    roster: rosterPresence(roster, tracks),
    // Une lecture automatique reste une lecture : estimée, même sur des parts mesurées.
    provenance: "estimated",
  };
}

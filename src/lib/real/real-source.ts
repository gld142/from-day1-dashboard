/**
 * Adaptateur « données réelles » : transforme les relevés publics committés
 * (snapshots) en séries au format attendu par src/lib/demo/api.ts.
 *
 * - Spotify : Kworb donne total + débit quotidien par titre ; quand deux relevés
 *   consécutifs portent le play count Spotify d'un titre, leur delta est plus
 *   précis que le débit Kworb (qui retarde de ~2 jours) et prime. Sans Kworb
 *   (Kiko), on reconstitue à partir des play counts et des auditeurs mensuels.
 * - YouTube : delta de vues entre relevés consécutifs.
 * - Autres DSP : estimés à partir du mix artiste (dsp-mix.ts). TikTok n'est
 *   jamais émis (pas un stream rémunéré).
 *
 * Tout est déterministe (pas de Date.now, pas de Math.random) : mêmes chiffres
 * côté serveur et côté client. Chaque point porte sa provenance.
 */
import { TRACKS, getArtist } from "@/lib/demo/data";
import { DEMO_TODAY, isoDay } from "@/lib/demo/seed";
import type { CountryStreams, DSP, Provenance, StreamPoint, Track } from "@/lib/demo/types";
import { DSPS } from "@/lib/demo/types";
import { artistMix, isDeezerPro } from "./dsp-mix";
import { estimateDay, weakest, type DayInput } from "./estimator";
import { SPOTIFY_MIN_STREAMS_12M, TIER_FR } from "./params";
import { reconstructTrack, type ReconstructedDay } from "./reconstruct";
import { SNAPSHOTS } from "./snapshots";
import { countriesFromCities, territoryCoefficient, zoneDistribution } from "./territory";
import type { DailyEstimate, Snapshot } from "./types";

export type Snaps = Record<string, Snapshot[]>;

/** Pseudo-titre absorbant la longue queue du catalogue quand Kworb manque. */
export const CATALOGUE_KEY = "__catalogue__";

/* ─── Hypothèses de la branche sans Kworb et du repli YouTube ─── */
/** Écoutes mensuelles par auditeur mensuel Spotify — HYPOTHÈSE. */
const STREAMS_PER_LISTENER_MONTH = 2.6;
/** Part des écoutes portée par les titres publics (top tracks) — HYPOTHÈSE. */
const PUBLIC_SHARE = 0.8;
/** Le catalogue « pèse » 400 jours de son débit actuel — HYPOTHÈSE. */
const CATALOGUE_DAYS = 400;
/** Vues quotidiennes YouTube en fraction du cumul, sans relevé précédent — HYPOTHÈSE. */
const YOUTUBE_DAILY_SHARE = 0.0005;
/** DSP estimés depuis le mix (ni Spotify ni YouTube, mesurés ; jamais TikTok). */
const ESTIMATED_DSPS: DSP[] = DSPS.filter((d) => d !== "spotify" && d !== "youtube" && d !== "tiktok");

/* ─── Contexte d'un appel : relevés indexés une fois pour toutes ─── */
type Ctx = {
  artistId: string;
  snaps: Snapshot[];
  last: Snapshot;
  today: Date;
  /** Par relevé : titre → play count Spotify. */
  counts: Map<string, number>[];
  /** Par relevé : titre → débit Kworb (null si Kworb ne le donne pas). */
  kworbDaily: Map<string, number | null>[];
};

function makeCtx(artistId: string, today: Date, snapshots: Snaps): Ctx {
  const snaps = snapshots[artistId];
  if (!snaps || snaps.length === 0) throw new Error(`Aucun relevé réel pour « ${artistId} »`);
  return {
    artistId,
    snaps,
    last: snaps[snaps.length - 1],
    today,
    counts: snaps.map((s) => new Map(s.spotify.topTracks.map((t) => [t.name, t.playcount]))),
    kworbDaily: snaps.map((s) => new Map((s.kworb?.tracks ?? []).map((t) => [t.name, t.daily]))),
  };
}

/** Delta ≥ 0 d'un compteur cumulé ; null si absent d'un des deux relevés ou négatif. */
function positiveDelta(now: number | undefined, before: number | undefined): number | null {
  if (now === undefined || before === undefined) return null;
  return now - before >= 0 ? now - before : null;
}

/** Delta de play count Spotify d'un titre entre le relevé `i` et son prédécesseur. */
function playcountDelta(ctx: Ctx, name: string, i: number): number | null {
  return i >= 1 ? positiveDelta(ctx.counts[i].get(name), ctx.counts[i - 1].get(name)) : null;
}

/** Les `days` dates ISO de la fenêtre, croissantes, terminées à `today` (même calcul que reconstruct.ts). */
function dateWindow(today: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

function releaseDateOf(artistId: string, title: string): string | undefined {
  return TRACKS.find((t) => t.artistId === artistId && t.title === title)?.releaseDate;
}

/**
 * Rétrograde la provenance d'aujourd'hui à « reconstructed ».
 *
 * `reconstructTrack` marque toujours le dernier jour « measured », parce que
 * son `dailyNow` est normalement un débit relevé (delta de play count, daily
 * Kworb). Mais quand ce débit sort d'une hypothèse — « auditeurs × 2,6 / 30 »
 * faute de second relevé, pseudo-titre catalogue, repli YouTube « Σ vues ×
 * 0,05 % » — l'afficher comme mesuré tromperait l'utilisateur : la valeur est
 * ancrée sur un chiffre mesuré (auditeurs mensuels, cumul de vues) mais reste
 * une reconstruction. Sans effet dès qu'on a deux relevés consécutifs.
 */
function markTodayReconstructed(series: ReconstructedDay[]): ReconstructedDay[] {
  if (series.length > 0) series[series.length - 1].provenance = "reconstructed";
  return series;
}

/**
 * Répartit `residual` au prorata de `total` entre les titres, en entiers dont la
 * somme est exactement `residual` (l'écart d'arrondi va au plus gros titre).
 */
function allocateResidual(tracks: Array<{ name: string; total: number }>, residual: number): Map<string, number> {
  const out = new Map<string, number>();
  if (tracks.length === 0) return out;
  const sumTotal = tracks.reduce((s, t) => s + t.total, 0);
  let allocated = 0;
  for (const t of tracks) {
    const v = Math.round(residual * (sumTotal > 0 ? t.total / sumTotal : 1 / tracks.length));
    out.set(t.name, v);
    allocated += v;
  }
  const largest = tracks.reduce((a, t) => (t.total > a.total ? t : a), tracks[0]);
  out.set(largest.name, (out.get(largest.name) ?? 0) + (residual - allocated));
  return out;
}

/* ─── Spotify par titre ─── */

/**
 * Branche Kworb : débit d'aujourd'hui = delta Spotify > débit Kworb > résidu de
 * `dailyStreams` réparti au prorata du total entre les titres sans débit.
 * Jours antérieurs relevés : delta Spotify, sinon débit Kworb du relevé.
 */
function kworbDailyByTrack(ctx: Ctx, days: number, kworb: NonNullable<Snapshot["kworb"]>): Map<string, ReconstructedDay[]> {
  const n = ctx.snaps.length;
  const knownDaily = kworb.tracks.reduce((s, t) => s + (t.daily ?? 0), 0);
  const residual = allocateResidual(
    kworb.tracks.filter((t) => t.daily === null),
    Math.max(0, kworb.dailyStreams - knownDaily),
  );
  const out = new Map<string, ReconstructedDay[]>();
  for (const t of kworb.tracks) {
    const dailyNow = playcountDelta(ctx, t.name, n - 1) ?? t.daily ?? residual.get(t.name) ?? 0;
    const measured: Record<string, number> = {};
    for (let i = 0; i < n - 1; i++) {
      const v = playcountDelta(ctx, t.name, i) ?? ctx.kworbDaily[i].get(t.name) ?? null;
      if (v !== null) measured[ctx.snaps[i].date] = v;
    }
    out.set(
      t.name,
      reconstructTrack({
        key: `${ctx.artistId}:${t.name}`,
        total: t.total,
        dailyNow,
        days,
        today: ctx.today,
        releaseDate: releaseDateOf(ctx.artistId, t.name),
        measured,
      }),
    );
  }
  return out;
}

/**
 * Branche sans Kworb : les play counts des top tracks donnent le total ; le
 * débit vient du delta entre relevés, sinon de la cible « auditeurs × 2,6 / 30 »
 * répartie au prorata des play counts. Un pseudo-titre catalogue porte le reste.
 */
function playcountDailyByTrack(ctx: Ctx, days: number): Map<string, ReconstructedDay[]> {
  const n = ctx.snaps.length;
  const tops = ctx.last.spotify.topTracks;
  const sumPlay = tops.reduce((s, t) => s + t.playcount, 0);
  const listeners = ctx.last.spotify.monthlyListeners ?? getArtist(ctx.artistId).monthlyListeners;
  const dailyTarget = (listeners * STREAMS_PER_LISTENER_MONTH) / 30;
  const out = new Map<string, ReconstructedDay[]>();
  for (const t of tops) {
    const delta = playcountDelta(ctx, t.name, n - 1);
    const share = sumPlay > 0 ? t.playcount / sumPlay : 1 / tops.length;
    const dailyNow = delta ?? Math.round(dailyTarget * PUBLIC_SHARE * share);
    const measured: Record<string, number> = {};
    for (let i = 1; i < n - 1; i++) {
      const v = playcountDelta(ctx, t.name, i);
      if (v !== null) measured[ctx.snaps[i].date] = v;
    }
    const series = reconstructTrack({
      key: `${ctx.artistId}:${t.name}`,
      total: t.playcount,
      dailyNow,
      days,
      today: ctx.today,
      releaseDate: releaseDateOf(ctx.artistId, t.name),
      measured,
    });
    out.set(t.name, delta === null ? markTodayReconstructed(series) : series);
  }
  const catalogueDaily = Math.round(dailyTarget * (1 - PUBLIC_SHARE));
  out.set(
    CATALOGUE_KEY,
    markTodayReconstructed(
      reconstructTrack({
        key: `${ctx.artistId}:${CATALOGUE_KEY}`,
        total: catalogueDaily * CATALOGUE_DAYS,
        dailyNow: catalogueDaily,
        days,
        today: ctx.today,
      }),
    ),
  );
  return out;
}

function dailyByTrack(ctx: Ctx, days: number): Map<string, ReconstructedDay[]> {
  return ctx.last.kworb ? kworbDailyByTrack(ctx, days, ctx.last.kworb) : playcountDailyByTrack(ctx, days);
}

/* ─── YouTube ─── */

/** Σ des deltas de vues ≥ 0 sur les vidéos présentes dans les deux relevés ; null si aucune. */
function viewsDelta(now: Snapshot, before: Snapshot): number | null {
  const prev = new Map((before.youtube?.videos ?? []).map((v) => [v.videoId, v.views]));
  let sum = 0;
  let any = false;
  for (const v of now.youtube?.videos ?? []) {
    const d = positiveDelta(v.views, prev.get(v.videoId));
    if (d !== null) {
      sum += d;
      any = true;
    }
  }
  return any ? sum : null;
}

function youtubeSeries(ctx: Ctx, days: number): ReconstructedDay[] | null {
  const videos = ctx.last.youtube?.videos ?? [];
  if (videos.length === 0) return null;
  const n = ctx.snaps.length;
  const total = videos.reduce((s, v) => s + v.views, 0);
  const delta = n >= 2 ? viewsDelta(ctx.last, ctx.snaps[n - 2]) : null;
  const measured: Record<string, number> = {};
  for (let i = 1; i < n - 1; i++) {
    const v = viewsDelta(ctx.snaps[i], ctx.snaps[i - 1]);
    if (v !== null) measured[ctx.snaps[i].date] = v;
  }
  const series = reconstructTrack({
    key: `${ctx.artistId}:youtube`,
    total,
    dailyNow: delta ?? Math.round(total * YOUTUBE_DAILY_SHARE),
    days,
    today: ctx.today,
    measured,
  });
  return delta === null ? markTodayReconstructed(series) : series;
}

/** Part des vues portée par les art tracks « Topic » (0 si aucune vidéo). */
function youtubeTopicShare(last: Snapshot): number {
  const videos = last.youtube?.videos ?? [];
  const total = videos.reduce((s, v) => s + v.views, 0);
  return total > 0 ? videos.filter((v) => v.channel === "topic").reduce((s, v) => s + v.views, 0) / total : 0;
}

/* ─── Séries multi-DSP ─── */

/**
 * Spotify par jour = Σ des titres, mesuré si les titres mesurés ce jour portent
 * ≥ 50 % des streams ; YouTube = série de vues ; autres DSP = mix × Spotify.
 */
function streamSeriesFrom(ctx: Ctx, byTrack: Map<string, ReconstructedDay[]>, days: number): StreamPoint[] {
  const dates = dateWindow(ctx.today, days);
  const spotify = dates.map(() => ({ streams: 0, measured: 0 }));
  for (const series of byTrack.values()) {
    series.forEach((p, i) => {
      spotify[i].streams += p.streams;
      if (p.provenance === "measured") spotify[i].measured += p.streams;
    });
  }
  const youtube = youtubeSeries(ctx, days);
  const mix = artistMix({
    deezerFans: ctx.last.deezer?.fans ?? null,
    spotifyMonthlyListeners: ctx.last.spotify.monthlyListeners ?? getArtist(ctx.artistId).monthlyListeners,
  });

  const out: StreamPoint[] = [];
  dates.forEach((date, i) => {
    const sp = spotify[i];
    for (const dsp of DSPS) {
      if (dsp === "spotify") {
        const provenance: Provenance = sp.streams > 0 && sp.measured * 2 >= sp.streams ? "measured" : "reconstructed";
        out.push({ date, dsp, streams: sp.streams, provenance });
      } else if (dsp === "youtube") {
        if (youtube) out.push({ date, dsp, streams: youtube[i].streams, provenance: youtube[i].provenance });
      } else if (ESTIMATED_DSPS.includes(dsp)) {
        const streams = Math.round((sp.streams * mix[dsp]) / mix.spotify);
        if (streams > 0) out.push({ date, dsp, streams, provenance: "estimated" });
      }
    }
  });
  return out;
}

/* ─── API publique ─── */

export function hasRealData(artistId: string, snapshots: Snaps = SNAPSHOTS): boolean {
  return (snapshots[artistId]?.length ?? 0) > 0;
}

export function latestSnapshot(artistId: string, snapshots: Snaps = SNAPSHOTS): Snapshot {
  return makeCtx(artistId, DEMO_TODAY, snapshots).last;
}

/** Série quotidienne Spotify par titre (clé = nom du titre tel que relevé). */
export function spotifyDailyByTrack(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): Map<string, ReconstructedDay[]> {
  return dailyByTrack(makeCtx(artistId, today, snapshots), days);
}

export function realStreamSeries(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): StreamPoint[] {
  const ctx = makeCtx(artistId, today, snapshots);
  return streamSeriesFrom(ctx, dailyByTrack(ctx, days), days);
}

/** Identifiant stable pour un titre relevé absent du référentiel TRACKS. */
function slug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function realTopTracks(
  artistId: string,
  days: number,
  limit: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): Array<Track & { streams: number }> {
  const byTrack = spotifyDailyByTrack(artistId, days, today, snapshots);
  const sums = Array.from(byTrack.entries()).map(([title, s]) => ({ title, streams: s.reduce((a, p) => a + p.streams, 0) }));
  const total = sums.reduce((a, t) => a + t.streams, 0);
  return sums
    .filter((t) => t.title !== CATALOGUE_KEY)
    .map(({ title, streams }) => {
      const weight = total > 0 ? streams / total : 0;
      const known = TRACKS.find((t) => t.artistId === artistId && t.title === title);
      return known
        ? { ...known, weight, streams }
        : { id: `${artistId}-${slug(title)}`, artistId, projectId: "", title, isrc: "", releaseDate: "", durationSec: 0, weight, streams };
    })
    .sort((a, b) => b.streams - a.streams || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Pays d'écoute déduits des villes Spotify ; null si le relevé n'en a pas. */
export function realCountryBreakdown(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): CountryStreams[] | null {
  const cities = latestSnapshot(artistId, snapshots).topCities;
  if (!cities || cities.length === 0) return null;
  const total = realStreamSeries(artistId, days, today, snapshots).reduce((a, p) => a + p.streams, 0);
  return countriesFromCities(cities, total);
}

export function realMonthlyListeners(artistId: string, snapshots: Snaps = SNAPSHOTS): number | null {
  return hasRealData(artistId, snapshots) ? latestSnapshot(artistId, snapshots).spotify.monthlyListeners : null;
}

/** Σ Spotify des `lastN` derniers jours, tous titres. */
function spotifySum(byTrack: Map<string, ReconstructedDay[]>, lastN: number): number {
  let sum = 0;
  for (const s of byTrack.values()) for (const p of s.slice(-lastN)) sum += p.streams;
  return sum;
}

/** Part des streams Spotify portée par les titres au-dessus du seuil 12 mois (le catalogue est toujours rémunérable). */
function payableShareOf(byTrack365: Map<string, ReconstructedDay[]>): number {
  let total = 0;
  let payable = 0;
  for (const [name, s] of byTrack365) {
    const sum = s.reduce((a, p) => a + p.streams, 0);
    total += sum;
    if (name === CATALOGUE_KEY || sum >= SPOTIFY_MIN_STREAMS_12M) payable += sum;
  }
  return total > 0 ? payable / total : 1;
}

export function realDailyEstimates(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
  rateOverrides?: Partial<Record<DSP, number>>,
): DailyEstimate[] {
  const ctx = makeCtx(artistId, today, snapshots);
  const artist = getArtist(artistId);
  const byTrack = dailyByTrack(ctx, days);
  const byTrack365 = days === 365 ? byTrack : dailyByTrack(ctx, 365);
  const territoryCoef = territoryCoefficient(zoneDistribution(ctx.last.topCities, artist.country));
  const deezerPro = isDeezerPro({
    monthlyStreams: spotifySum(byTrack365, 30),
    monthlyListeners: ctx.last.spotify.monthlyListeners ?? artist.monthlyListeners,
  });
  const payableShare = payableShareOf(byTrack365);
  const topicShare = youtubeTopicShare(ctx.last);

  const byDate = new Map<string, DayInput["byDsp"]>();
  for (const p of streamSeriesFrom(ctx, byTrack, days)) {
    const byDsp = byDate.get(p.date) ?? {};
    byDsp[p.dsp] =
      p.dsp === "youtube"
        ? { streams: p.streams, provenance: p.provenance ?? "estimated", youtubeTopicShare: topicShare }
        : { streams: p.streams, provenance: p.provenance ?? "estimated" };
    byDate.set(p.date, byDsp);
  }
  return dateWindow(today, days).map((date) =>
    estimateDay({ date, byDsp: byDate.get(date) ?? {}, territoryCoef, tier: TIER_FR, deezerPro, payableShare, rateOverrides }),
  );
}

/** Pour chaque DSP présent sur la fenêtre, la plus faible provenance rencontrée. */
export function realProvenanceByDsp(
  artistId: string,
  days: number,
  today: Date = DEMO_TODAY,
  snapshots: Snaps = SNAPSHOTS,
): Partial<Record<DSP, Provenance>> {
  const seen = new Map<DSP, Provenance[]>();
  for (const p of realStreamSeries(artistId, days, today, snapshots)) {
    const list = seen.get(p.dsp) ?? [];
    list.push(p.provenance ?? "estimated");
    seen.set(p.dsp, list);
  }
  const out: Partial<Record<DSP, Provenance>> = {};
  for (const [dsp, ps] of seen) out[dsp] = weakest(ps);
  return out;
}

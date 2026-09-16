/**
 * API de lecture — LA façade que les pages consomment.
 *
 * Ordre de priorité des sources, pour chaque fonction :
 *   1. le store des données de l'utilisateur (src/lib/userdata) — si l'artistId
 *      est le profil utilisateur actif, ce sont SES chiffres (import CSV) ;
 *   2. la couche réelle (src/lib/real) — les artistes du roster dont on a des
 *      relevés publics committés : streams, revenus streaming estimés, pays,
 *      écarts d'audit, résumés d'estimation ;
 *   3. les générateurs démo déterministes, pour tout le reste.
 */
import {
  ARTISTS,
  CONTRACTS,
  EMERGING,
  LABEL,
  PROJECTS,
  SPLITS,
  TEAM,
  TRACKS,
  getArtist as getDemoArtist,
} from "./data";
import {
  auditFindings as genAuditFindings,
  countryBreakdown as genCountryBreakdown,
  expensesFor as genExpensesFor,
  fanSegments as genFanSegments,
  revenueForecast as genRevenueForecast,
  revenueSeries as genRevenueSeries,
  rightsStatements as genRightsStatements,
  streamSeries as genStreamSeries,
  tourDates as genTourDates,
  type ForecastPoint,
} from "./generators";
import { DEMO_TODAY, isoMonth } from "./seed";
import {
  auditGap,
  calibrationFromUserData,
  hasRealData,
  realCountryBreakdown,
  realDailyEstimates,
  realProvenanceByDsp,
  realStreamSeries,
  realTopTracks,
  simulatedStatement,
  summarize,
  tiktokSignal as realTiktokSignal,
  weakest,
  type Confidence,
  type DailyEstimate,
  type EstimatePeriod,
  type EstimateSummary,
  type Provenance,
  type Range,
  type TikTokSignal,
} from "@/lib/real";
import {
  getUserData,
  isUserArtist,
  userArtist,
  userCountryBreakdown,
  userRevenueSeries,
  userStreamSeries,
  userTopTracks,
} from "@/lib/userdata/store";
import type {
  Artist,
  AuditFinding,
  CountryStreams,
  DSP,
  Expense,
  ExpenseCategory,
  FanSegment,
  RevenuePoint,
  RevenueSource,
  RightsStatement,
  StreamPoint,
  TourDate,
  Track,
} from "./types";

export { ARTISTS, CONTRACTS, EMERGING, LABEL, PROJECTS, SPLITS, TEAM, TRACKS };
export type { ForecastPoint };
export type { DailyEstimate, EstimatePeriod, EstimateSummary, TikTokSignal };

/* ─────────────── Fiches artistes (démo + profil utilisateur) ─────────────── */

export function getArtist(id: string): Artist {
  if (isUserArtist(id)) {
    const ua = userArtist();
    if (ua) return ua;
  }
  return getDemoArtist(id);
}

/* ─────────────── Couche réelle : estimations € et calibration ─────────────── */

export function hasReal(artistId: string): boolean {
  return hasRealData(artistId);
}

/**
 * Calibration active pour un artiste. Elle vient du relevé importé (mode
 * « Mes données ») ; en démo elle s'applique au profil utilisateur et à Kiko
 * si Gaël importe son vrai relevé (spec §5.3).
 */
function activeCalibration(artistId: string) {
  const c = calibrationFromUserData(getUserData());
  return c && (isUserArtist(artistId) || artistId === "kiko") ? c : null;
}

/* Memo des estimations quotidiennes : plusieurs pages (Pulse, Revenus, Audit…)
 * redemandent la même fenêtre à chaque rendu ; 730 jours × 3 artistes ne doivent
 * être calculés qu'une fois. Le cache est vidé dès que les données utilisateur
 * changent (import, activation) — la calibration en dépend. */
const estimatesMemo = new Map<string, DailyEstimate[]>();
let estimatesMemoUserKey = "";

function userDataKey(): string {
  const ud = getUserData();
  return ud ? `${ud.importedAt}|${ud.active}` : "";
}

/** Estimations € quotidiennes (fourchettes) — vide pour un artiste sans relevé réel. */
export function dailyEstimates(artistId: string, days = 365): DailyEstimate[] {
  if (!hasRealData(artistId)) return [];
  const userKey = userDataKey();
  if (userKey !== estimatesMemoUserKey) {
    estimatesMemo.clear();
    estimatesMemoUserKey = userKey;
  }
  const key = `${artistId}:${days}`;
  const hit = estimatesMemo.get(key);
  if (hit) return hit;
  const cal = activeCalibration(artistId);
  const out = realDailyEstimates(artistId, days, DEMO_TODAY, undefined, cal?.ratePerStream);
  estimatesMemo.set(key, out);
  return out;
}

export function estimateSummary(artistId: string, period: EstimatePeriod): EstimateSummary {
  const a = getArtist(artistId);
  return summarize(dailyEstimates(artistId, 365), period, {
    calibrated: activeCalibration(artistId) !== null,
    dealType: a.dealType,
  });
}

const CONFIDENCE_ORDER: Confidence[] = ["indicative", "medium", "high"];
const ZERO_RANGE: Range = { low: 0, mid: 0, high: 0 };
const addRange = (a: Range, b: Range): Range => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });

/**
 * Résumé roster : somme des artistes réels. Confiance et provenance = les plus
 * faibles rencontrées ; calibré seulement si tous le sont ; fenêtre du premier.
 */
export function rosterEstimateSummary(period: EstimatePeriod): EstimateSummary {
  const parts = ARTISTS.filter((a) => hasRealData(a.id)).map((a) => estimateSummary(a.id, period));
  const first = parts[0];
  return {
    period,
    from: first?.from ?? "",
    to: first?.to ?? "",
    streams: parts.reduce((s, p) => s + p.streams, 0),
    payableStreams: parts.reduce((s, p) => s + p.payableStreams, 0),
    grossMaster: parts.reduce((acc, p) => addRange(acc, p.grossMaster), ZERO_RANGE),
    artistShare: parts.reduce((acc, p) => addRange(acc, p.artistShare), ZERO_RANGE),
    publishing: parts.reduce((acc, p) => addRange(acc, p.publishing), ZERO_RANGE),
    confidence: parts.reduce<Confidence>(
      (worst, p) => (CONFIDENCE_ORDER.indexOf(p.confidence) < CONFIDENCE_ORDER.indexOf(worst) ? p.confidence : worst),
      first?.confidence ?? "indicative",
    ),
    provenance: weakest(parts.map((p) => p.provenance)),
    calibrated: parts.length > 0 && parts.every((p) => p.calibrated),
  };
}

/** Par DSP, la plus faible provenance sur la fenêtre — vide hors couche réelle. */
export function provenanceByDsp(artistId: string, days = 30): Partial<Record<DSP, Provenance>> {
  return hasRealData(artistId) ? realProvenanceByDsp(artistId, days) : {};
}

/* ─────────────── Signal TikTok (viralité, pas revenu) ─────────────── */

/**
 * Vidéos utilisant les sons de l'artiste, delta hier, titre le plus repris,
 * rang tendances FR. Simulé (badge) tant qu'aucun relevé TikTok n'existe ;
 * null hors couche réelle.
 */
export function tiktokSignal(artistId: string): TikTokSignal | null {
  return hasRealData(artistId) ? realTiktokSignal(artistId) : null;
}

/**
 * Signal TikTok du roster : Σ vidéos et Σ delta des artistes réels ; le titre
 * le plus repris est celui de l'artiste qui cumule le plus de vidéos (les
 * relevés ne donnent pas le détail par son) ; meilleur rang FR non nul ;
 * provenance = la plus faible. null si aucun artiste réel.
 */
export function rosterTiktokSignal(): TikTokSignal | null {
  const parts = ARTISTS.flatMap((a) => {
    const s = tiktokSignal(a.id);
    return s ? [s] : [];
  });
  if (parts.length === 0) return null;
  const biggest = parts.reduce((a, p) => (p.videos > a.videos ? p : a), parts[0]);
  const ranks = parts.flatMap((p) => (p.trendingRankFr === null ? [] : [p.trendingRankFr]));
  return {
    videos: parts.reduce((s, p) => s + p.videos, 0),
    deltaYesterday: parts.reduce((s, p) => s + p.deltaYesterday, 0),
    topSound: biggest.topSound,
    trendingRankFr: ranks.length > 0 ? Math.min(...ranks) : null,
    provenance: weakest(parts.map((p) => p.provenance)),
  };
}

/* ─────────────── Séries — utilisateur > réel > démo ─────────────── */

export function streamSeries(artistId: string, days = 365): StreamPoint[] {
  if (isUserArtist(artistId)) return userStreamSeries(days, DEMO_TODAY);
  if (hasRealData(artistId)) return realStreamSeries(artistId, days);
  return genStreamSeries(artistId, days);
}

/** Agrégat quotidien tous DSP confondus — sur la source servie par `streamSeries`. */
export function dailyTotals(artistId: string, days = 365) {
  const byDay = new Map<string, number>();
  for (const p of streamSeries(artistId, days)) {
    byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.streams);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, streams]) => ({ date, streams }));
}

/**
 * Artiste réel : € streaming par mois = Σ mensuelle du brut master estimé (mid),
 * sur 730 jours pour couvrir les 24 mois d'historique. Les autres sources de
 * revenus restent synthétiques (générateur).
 */
function realStreamingByMonth(artistId: string): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const d of dailyEstimates(artistId, 730)) {
    const month = d.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + d.grossMaster.mid);
  }
  for (const [month, v] of byMonth) byMonth.set(month, Math.round(v));
  return byMonth;
}

export function revenueSeries(artistId: string, months = 24): RevenuePoint[] {
  if (isUserArtist(artistId)) return userRevenueSeries(months, DEMO_TODAY);
  if (hasRealData(artistId)) return genRevenueSeries(artistId, months, realStreamingByMonth(artistId));
  return genRevenueSeries(artistId, months);
}

export function expensesFor(artistId: string, months = 24): Expense[] {
  if (isUserArtist(artistId)) return [];
  return genExpensesFor(artistId, months);
}

export function countryBreakdown(artistId: string, days = 30): CountryStreams[] {
  if (isUserArtist(artistId)) return userCountryBreakdown();
  if (hasRealData(artistId)) return realCountryBreakdown(artistId, days) ?? genCountryBreakdown(artistId, days);
  return genCountryBreakdown(artistId, days);
}

export function rightsStatements(artistId: string): RightsStatement[] {
  if (isUserArtist(artistId)) return [];
  return genRightsStatements(artistId);
}

/** Trimestre ISO « YYYY-Tn » d'une date ISO. */
function quarterOf(date: string): string {
  return `${date.slice(0, 4)}-T${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
}

/** Premier jour d'un trimestre « YYYY-Tn ». */
function quarterStart(quarter: string): string {
  const month = (Number(quarter.slice(6)) - 1) * 3 + 1;
  return `${quarter.slice(0, 4)}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Écarts d'audit. Artistes réels : les écarts de droits générés sont conservés,
 * mais l'écart « label » synthétique laisse place aux écarts estimé / déclaré par
 * DSP et par trimestre clos — toujours attribués au DSP (audit-gap.ts).
 */
export function auditFindings(artistId: string): AuditFinding[] {
  if (isUserArtist(artistId)) return [];
  if (!hasRealData(artistId)) return genAuditFindings(artistId);

  const est = dailyEstimates(artistId, 365);
  const currentQuarter = quarterOf(est[est.length - 1]?.date ?? "");
  const firstDate = est[0]?.date ?? "";
  const lines = new Map<string, { period: string; dsp: DSP; mid: number }>();
  for (const d of est) {
    const period = quarterOf(d.date);
    // Trimestres clos seulement : ni le trimestre en cours, ni un trimestre entamé avant la fenêtre.
    if (period === currentQuarter || quarterStart(period) < firstDate) continue;
    for (const [dsp, v] of Object.entries(d.byDsp) as Array<[DSP, NonNullable<DailyEstimate["byDsp"][DSP]>]>) {
      const key = `${period}:${dsp}`;
      const line = lines.get(key) ?? { period, dsp, mid: 0 };
      line.mid += v.gross.mid;
      lines.set(key, line);
    }
  }
  const closed = Array.from(lines.values());
  const rights = genAuditFindings(artistId).filter((f) => !f.id.endsWith("-af-label"));
  return [...auditGap(artistId, closed, simulatedStatement(artistId, closed)), ...rights];
}

export function tourDates(artistId: string): TourDate[] {
  if (isUserArtist(artistId)) return [];
  return genTourDates(artistId);
}

export function fanSegments(artistId: string): FanSegment[] {
  if (isUserArtist(artistId)) {
    // Estimations dérivées des auditeurs réels (parts sectorielles types).
    const base = userArtist()?.monthlyListeners ?? 0;
    return [
      { id: "superfans", count: Math.round(base * 0.012), trend: 0 },
      { id: "engaged", count: Math.round(base * 0.07), trend: 0 },
      { id: "casual", count: Math.round(base * 0.55), trend: 0 },
      { id: "dormant", count: Math.round(base * 0.16), trend: 0 },
    ];
  }
  return genFanSegments(artistId);
}

export function revenueForecast(
  artistId: string,
  opts?: { growthDelta?: number; horizon?: number },
): ForecastPoint[] {
  if (!isUserArtist(artistId)) {
    // Même historique que `revenueSeries` : streaming estimé pour les artistes réels.
    return genRevenueForecast(artistId, opts, hasRealData(artistId) ? realStreamingByMonth(artistId) : undefined);
  }

  // Projection sur les données réelles : tendance composée simple.
  const horizon = opts?.horizon ?? 12;
  const growthDelta = opts?.growthDelta ?? 0;
  const history = userRevenueSeries(24, DEMO_TODAY);
  const byMonth = new Map<string, number>();
  for (const p of history) byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);
  const months = Array.from(byMonth.keys()).sort();
  const out: ForecastPoint[] = months.map((m) => ({
    month: m,
    actual: Math.round(byMonth.get(m) ?? 0),
    projected: null,
    low: null,
    high: null,
  }));
  if (months.length === 0) return out;
  const last3 = months.slice(-3).map((m) => byMonth.get(m) ?? 0);
  const baseLevel = last3.reduce((s, v) => s + v, 0) / last3.length;
  const g = (userArtist()?.growthRate ?? 0) + growthDelta;
  const lastDate = new Date(`${months[months.length - 1]}-01T00:00:00Z`);
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(lastDate);
    d.setUTCMonth(d.getUTCMonth() + i);
    const level = baseLevel * Math.pow(1 + g, i);
    const spread = 0.15 + i * 0.02; // plus prudent : historique court
    out.push({
      month: isoMonth(d),
      actual: null,
      projected: Math.round(level),
      low: Math.round(level * (1 - spread)),
      high: Math.round(level * (1 + spread)),
    });
  }
  return out;
}

/* ─────────────── Agrégats streams ─────────────── */

export function sumStreams(artistId: string, days: number): number {
  return dailyTotals(artistId, days).reduce((s, d) => s + d.streams, 0);
}

export function streamsDelta(artistId: string, days: number): number {
  const series = dailyTotals(artistId, days * 2);
  const prev = series.slice(0, days).reduce((s, d) => s + d.streams, 0);
  const cur = series.slice(days).reduce((s, d) => s + d.streams, 0);
  return prev === 0 ? 0 : ((cur - prev) / prev) * 100;
}

export function streamsByDsp(artistId: string, days: number) {
  const acc = new Map<string, number>();
  for (const p of streamSeries(artistId, days)) {
    acc.set(p.dsp, (acc.get(p.dsp) ?? 0) + p.streams);
  }
  return Array.from(acc.entries())
    .map(([dsp, streams]) => ({ dsp, streams }))
    .sort((a, b) => b.streams - a.streams);
}

export function topTracks(artistId: string, days: number, limit = 8) {
  if (isUserArtist(artistId)) {
    const totalPeriod = sumStreams(artistId, days);
    const tracks = userTopTracks(limit);
    const totalAll = tracks.reduce((s, t) => s + t.streams, 0) || 1;
    return tracks.map((t, i) => ({
      id: `user-track-${i}`,
      artistId,
      projectId: "",
      title: t.title,
      isrc: "—",
      releaseDate: "",
      durationSec: 0,
      weight: t.streams / totalAll,
      streams: Math.round((t.streams / totalAll) * totalPeriod),
    })) as Array<Track & { streams: number }>;
  }
  if (hasRealData(artistId)) return realTopTracks(artistId, days, limit);
  const total = sumStreams(artistId, days);
  return TRACKS.filter((t) => t.artistId === artistId)
    .map((t) => ({
      ...t,
      streams: Math.round(total * t.weight),
    }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, limit);
}

/* ─────────────── Agrégats revenus ─────────────── */

export function revenueBySource(
  artistId: string,
  months: number,
): Array<{ source: RevenueSource; amount: number }> {
  const cutoff = months;
  const series = revenueSeries(artistId, 24);
  const keep = new Set(
    Array.from(new Set(series.map((p) => p.month)))
      .sort()
      .slice(-cutoff),
  );
  const acc = new Map<RevenueSource, number>();
  for (const p of series) {
    if (!keep.has(p.month)) continue;
    acc.set(p.source, (acc.get(p.source) ?? 0) + p.amount);
  }
  return Array.from(acc.entries())
    .map(([source, amount]) => ({ source, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function totalRevenue(artistId: string, months: number): number {
  return revenueBySource(artistId, months).reduce((s, r) => s + r.amount, 0);
}

export function monthlyRevenueTotals(artistId: string, months = 24) {
  const acc = new Map<string, number>();
  for (const p of revenueSeries(artistId, months)) {
    acc.set(p.month, (acc.get(p.month) ?? 0) + p.amount);
  }
  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));
}

/* ─────────────── Dépenses & P&L ─────────────── */

export type ExpenseFilter = {
  artistId?: string;
  year?: number;
  projectId?: string;
  trackId?: string;
  category?: ExpenseCategory;
};

export function expenses(filter: ExpenseFilter = {}): Expense[] {
  const ids = filter.artistId ? [filter.artistId] : ARTISTS.map((a) => a.id);
  let all = ids.flatMap((id) => expensesFor(id));
  if (filter.year) all = all.filter((e) => e.date.startsWith(String(filter.year)));
  if (filter.projectId) all = all.filter((e) => e.projectId === filter.projectId);
  if (filter.trackId) all = all.filter((e) => e.trackId === filter.trackId);
  if (filter.category) all = all.filter((e) => e.category === filter.category);
  return all;
}

export function expensesByCategory(filter: ExpenseFilter = {}) {
  const acc = new Map<ExpenseCategory, number>();
  for (const e of expenses(filter)) {
    acc.set(e.category, (acc.get(e.category) ?? 0) + e.amount);
  }
  return Array.from(acc.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export type PnL = {
  artistId: string;
  revenue: number;
  expenses: number;
  net: number;
  margin: number; // %
};

/** P&L par artiste sur N mois (12 par défaut) — le cœur de la vue label. */
export function pnlByArtist(months = 12): PnL[] {
  const monthsSet = new Set(
    monthlyRevenueTotals(ARTISTS[0].id, 24)
      .map((m) => m.month)
      .slice(-months),
  );
  return ARTISTS.map((a) => {
    const rev = monthlyRevenueTotals(a.id, 24)
      .filter((m) => monthsSet.has(m.month))
      .reduce((s, m) => s + m.amount, 0);
    const exp = expensesFor(a.id)
      .filter((e) => monthsSet.has(e.date.slice(0, 7)))
      .reduce((s, e) => s + e.amount, 0);
    const net = rev - exp;
    return {
      artistId: a.id,
      revenue: rev,
      expenses: exp,
      net,
      margin: rev === 0 ? 0 : (net / rev) * 100,
    };
  }).sort((a, b) => b.net - a.net);
}

/** P&L annuel d'un artiste, ventilé par année (pour comparaisons). */
export function pnlByYear(artistId: string): Array<{
  year: number;
  revenue: number;
  expenses: number;
  net: number;
}> {
  const revByYear = new Map<number, number>();
  for (const m of monthlyRevenueTotals(artistId, 24)) {
    const y = Number(m.month.slice(0, 4));
    revByYear.set(y, (revByYear.get(y) ?? 0) + m.amount);
  }
  const expByYear = new Map<number, number>();
  for (const e of expensesFor(artistId)) {
    const y = Number(e.date.slice(0, 4));
    expByYear.set(y, (expByYear.get(y) ?? 0) + e.amount);
  }
  const years = Array.from(
    new Set([...revByYear.keys(), ...expByYear.keys()]),
  ).sort();
  return years.map((year) => {
    const revenue = revByYear.get(year) ?? 0;
    const exp = expByYear.get(year) ?? 0;
    return { year, revenue, expenses: exp, net: revenue - exp };
  });
}

/* ─────────────── Valorisation ─────────────── */

export type Valuation = {
  nps: number;
  multipleLow: number;
  multipleHigh: number;
  low: number;
  mid: number;
  high: number;
};

export function catalogValuation(artistId: string): Valuation {
  const a = getArtist(artistId);
  const nps = totalRevenue(artistId, 12) * 0.72;
  const [mLow, mHigh] =
    a.careerStage === "peak"
      ? [18, 24]
      : a.careerStage === "established"
        ? [14, 18]
        : a.careerStage === "developing"
          ? [10, 14]
          : [8, 11];
  const low = nps * mLow;
  const high = nps * mHigh;
  return {
    nps: Math.round(nps),
    multipleLow: mLow,
    multipleHigh: mHigh,
    low: Math.round(low),
    mid: Math.round((low + high) / 2),
    high: Math.round(high),
  };
}

/* ─────────────── Roster (vue label — démo uniquement) ─────────────── */

export type RosterRow = Artist & {
  streams30d: number;
  delta30d: number;
  revenue12m: number;
  net12m: number;
  margin: number;
  valuationMid: number;
};

export function rosterRows(): RosterRow[] {
  const pnl = pnlByArtist(12);
  return ARTISTS.map((a) => {
    const p = pnl.find((x) => x.artistId === a.id)!;
    return {
      ...a,
      streams30d: sumStreams(a.id, 30),
      delta30d: streamsDelta(a.id, 30),
      revenue12m: p.revenue,
      net12m: p.net,
      margin: p.margin,
      valuationMid: catalogValuation(a.id).mid,
    };
  }).sort((a, b) => b.revenue12m - a.revenue12m);
}

/** Agrégat label : tous artistes confondus. */
export function labelTotals() {
  const rows = rosterRows();
  return {
    artists: rows.length,
    streams30d: rows.reduce((s, r) => s + r.streams30d, 0),
    revenue12m: rows.reduce((s, r) => s + r.revenue12m, 0),
    net12m: rows.reduce((s, r) => s + r.net12m, 0),
    valuationMid: rows.reduce((s, r) => s + r.valuationMid, 0),
  };
}

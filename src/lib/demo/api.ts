/**
 * API de lecture — LA façade que les pages consomment.
 *
 * Depuis l'import CSV : chaque fonction consulte d'abord le store des
 * données réelles de l'utilisateur (src/lib/userdata) ; si l'artistId
 * est le profil utilisateur actif, ce sont SES chiffres qui alimentent
 * tout le dashboard. Sinon, générateurs démo déterministes.
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
  dailyTotals as genDailyTotals,
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

/* ─────────────── Fiches artistes (démo + profil utilisateur) ─────────────── */

export function getArtist(id: string): Artist {
  if (isUserArtist(id)) {
    const ua = userArtist();
    if (ua) return ua;
  }
  return getDemoArtist(id);
}

/* ─────────────── Séries — overlay utilisateur ─────────────── */

export function streamSeries(artistId: string, days = 365): StreamPoint[] {
  if (isUserArtist(artistId)) return userStreamSeries(days, DEMO_TODAY);
  return genStreamSeries(artistId, days);
}

export function dailyTotals(artistId: string, days = 365) {
  if (isUserArtist(artistId)) {
    const byDay = new Map<string, number>();
    for (const p of userStreamSeries(days, DEMO_TODAY)) {
      byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.streams);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, streams]) => ({ date, streams }));
  }
  return genDailyTotals(artistId, days);
}

export function revenueSeries(artistId: string, months = 24): RevenuePoint[] {
  if (isUserArtist(artistId)) return userRevenueSeries(months, DEMO_TODAY);
  return genRevenueSeries(artistId, months);
}

export function expensesFor(artistId: string, months = 24): Expense[] {
  if (isUserArtist(artistId)) return [];
  return genExpensesFor(artistId, months);
}

export function countryBreakdown(artistId: string, days = 30): CountryStreams[] {
  if (isUserArtist(artistId)) {
    const all = userCountryBreakdown();
    if (all.length > 0) return all;
  }
  if (isUserArtist(artistId)) return [];
  return genCountryBreakdown(artistId, days);
}

export function rightsStatements(artistId: string): RightsStatement[] {
  if (isUserArtist(artistId)) return [];
  return genRightsStatements(artistId);
}

export function auditFindings(artistId: string): AuditFinding[] {
  if (isUserArtist(artistId)) return [];
  return genAuditFindings(artistId);
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
  if (!isUserArtist(artistId)) return genRevenueForecast(artistId, opts);

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

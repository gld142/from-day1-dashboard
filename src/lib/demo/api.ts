/**
 * API de lecture — LA façade que les pages consomment.
 * En production ces fonctions deviendront des appels serveur ;
 * leurs signatures sont conçues pour ne pas bouger.
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
  getArtist,
} from "./data";
import {
  auditFindings,
  countryBreakdown,
  dailyTotals,
  expensesFor,
  fanSegments,
  revenueForecast,
  revenueSeries,
  rightsStatements,
  streamSeries,
  tourDates,
} from "./generators";
import type {
  Artist,
  Expense,
  ExpenseCategory,
  RevenuePoint,
  RevenueSource,
} from "./types";

export {
  ARTISTS,
  CONTRACTS,
  EMERGING,
  LABEL,
  PROJECTS,
  SPLITS,
  TEAM,
  TRACKS,
  getArtist,
  auditFindings,
  countryBreakdown,
  dailyTotals,
  expensesFor,
  fanSegments,
  revenueForecast,
  revenueSeries,
  rightsStatements,
  streamSeries,
  tourDates,
};

/* ─────────────────────────── Agrégats streams ─────────────────────────── */

export function sumStreams(artistId: string, days: number): number {
  return dailyTotals(artistId, days).reduce((s, d) => s + d.streams, 0);
}

/** Variation % entre la période [days] et la précédente de même durée. */
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
  const total = sumStreams(artistId, days);
  return TRACKS.filter((t) => t.artistId === artistId)
    .map((t) => ({
      ...t,
      streams: Math.round(total * t.weight),
    }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, limit);
}

/* ─────────────────────────── Agrégats revenus ─────────────────────────── */

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

/* ─────────────────────────── Dépenses & P&L ─────────────────────────── */

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

/* ─────────────────────────── Valorisation ─────────────────────────── */

export type Valuation = {
  nps: number; // revenu net annuel du catalogue
  multipleLow: number;
  multipleHigh: number;
  low: number;
  mid: number;
  high: number;
};

export function catalogValuation(artistId: string): Valuation {
  const a = getArtist(artistId);
  const nps = totalRevenue(artistId, 12) * 0.72; // part catalogue
  const [mLow, mHigh] =
    a.careerStage === "established"
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

/* ─────────────────────────── Roster (vue label) ─────────────────────────── */

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

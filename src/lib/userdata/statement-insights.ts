/**
 * Ce qu'un relevé distributeur MENSUEL permet de dire sur les revenus et les
 * streams d'un artiste — pour les pages Revenus et Streams du mode client.
 *
 * Règles : rien n'est inventé. Un mois absent du relevé est marqué `missing`
 * (pas un zéro silencieux) ; une tendance ou une comparaison annuelle sans
 * historique suffisant vaut `null` ; un découpage de revenus absent (relevé
 * importé avant le 28/09/2026) vaut `null`, jamais 0.
 */
import type { DSP } from "@/lib/demo/types";
import { addMonths, monthsEnding, threeMonthTrend } from "./roster";
import type { UserData } from "./store";

export type MonthPoint = {
  month: string;
  /** Mois sans aucune ligne dans le relevé (entre le premier et le dernier). */
  missing: boolean;
  revenue: number;
  streams: number;
  per1000: number | null;
  streamsByDsp: Partial<Record<DSP, number>>;
  /** null si le relevé ne porte pas le découpage des revenus par plateforme. */
  revenueByDsp: Partial<Record<DSP, number>> | null;
};

const sumValues = (o: Partial<Record<string, number>> | undefined) =>
  Object.values(o ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);
const per1000 = (revenue: number, streams: number) => (streams > 0 ? (revenue / streams) * 1000 : null);

/** Les mois couverts, du premier au dernier, trous compris. */
function span(d: UserData): string[] {
  const sorted = [...d.months].sort();
  if (!sorted.length) return [];
  const out: string[] = [];
  for (let m = sorted[0]; m <= sorted[sorted.length - 1]; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function monthSeries(d: UserData): MonthPoint[] {
  const present = new Set(d.months);
  return span(d).map((month) => {
    const streams = sumValues(d.streamsByMonth[month]);
    const revenue = d.revenueByMonth[month] ?? 0;
    return {
      month,
      missing: !present.has(month),
      revenue,
      streams,
      per1000: per1000(revenue, streams),
      streamsByDsp: d.streamsByMonth[month] ?? {},
      revenueByDsp: d.revenueByMonthDsp ? (d.revenueByMonthDsp[month] ?? {}) : null,
    };
  });
}

export type Summary = {
  total: number;
  /** Nombre de mois du premier au dernier (trous compris). */
  months: number;
  avgMonthly: number;
  best: { month: string; value: number } | null;
  last: { month: string; value: number } | null;
  /** 3 derniers mois contre les 3 d'avant ; null sans 6 mois d'historique. */
  trend3: number | null;
  /** Dernier mois contre le même mois un an plus tôt ; null si ce mois-là n'est pas dans le relevé. */
  yoy: { month: string; previous: string; change: number } | null;
};

function summarize(d: UserData, byMonth: Record<string, number>): Summary {
  const months = span(d);
  const present = new Set(d.months);
  const total = months.reduce((s, m) => s + (byMonth[m] ?? 0), 0);
  const first = months[0];
  const lastMonth = months.at(-1);
  let best: Summary["best"] = null;
  for (const m of months) if (present.has(m) && (!best || (byMonth[m] ?? 0) > best.value)) best = { month: m, value: byMonth[m] ?? 0 };
  let yoy: Summary["yoy"] = null;
  if (lastMonth) {
    const previous = addMonths(lastMonth, -12);
    const base = byMonth[previous] ?? 0;
    if (present.has(previous) && base > 0) yoy = { month: lastMonth, previous, change: (byMonth[lastMonth] ?? 0) / base - 1 };
  }
  return {
    total,
    months: months.length,
    avgMonthly: months.length ? total / months.length : 0,
    best,
    last: lastMonth ? { month: lastMonth, value: byMonth[lastMonth] ?? 0 } : null,
    trend3: first && lastMonth ? threeMonthTrend(byMonth, first, lastMonth) : null,
    yoy,
  };
}

export function revenueSummary(d: UserData): Summary & { per1000: number | null } {
  const s = summarize(d, d.revenueByMonth);
  const streams = span(d).reduce((sum, m) => sum + sumValues(d.streamsByMonth[m]), 0);
  return { ...s, per1000: per1000(s.total, streams) };
}

export function streamsSummary(d: UserData): Summary & { topPlatform: { dsp: DSP; share: number } | null } {
  const byMonth = Object.fromEntries(span(d).map((m) => [m, sumValues(d.streamsByMonth[m])]));
  const s = summarize(d, byMonth);
  const top = platformRows(d).sort((a, b) => b.streams - a.streams)[0];
  return { ...s, topPlatform: top && s.total > 0 ? { dsp: top.dsp, share: top.streams / s.total } : null };
}

export type PlatformRow = {
  dsp: DSP;
  streams: number;
  streamsShare: number;
  revenue: number | null;
  revenueShare: number | null;
  per1000: number | null;
};

/** Par plateforme, sur tout le relevé ; tri par revenus quand on les connaît, sinon par streams. */
export function platformRows(d: UserData): PlatformRow[] {
  const streams: Partial<Record<DSP, number>> = {};
  const revenue: Partial<Record<DSP, number>> = {};
  for (const perDsp of Object.values(d.streamsByMonth)) {
    for (const [dsp, n] of Object.entries(perDsp) as [DSP, number][]) streams[dsp] = (streams[dsp] ?? 0) + n;
  }
  const hasRevenue = Boolean(d.revenueByMonthDsp);
  for (const perDsp of Object.values(d.revenueByMonthDsp ?? {})) {
    for (const [dsp, n] of Object.entries(perDsp) as [DSP, number][]) revenue[dsp] = (revenue[dsp] ?? 0) + n;
  }
  const totalStreams = sumValues(streams);
  const totalRevenue = sumValues(revenue);
  const dsps = [...new Set([...Object.keys(streams), ...Object.keys(revenue)])] as DSP[];
  return dsps
    .map((dsp) => {
      const st = streams[dsp] ?? 0;
      const rev = hasRevenue ? (revenue[dsp] ?? 0) : null;
      return {
        dsp,
        streams: st,
        streamsShare: totalStreams > 0 ? st / totalStreams : 0,
        revenue: rev,
        revenueShare: rev === null || totalRevenue <= 0 ? null : rev / totalRevenue,
        per1000: rev === null ? null : per1000(rev, st),
      };
    })
    .filter((r) => r.streams > 0 || (r.revenue ?? 0) !== 0)
    .sort((a, b) => (hasRevenue ? (b.revenue ?? 0) - (a.revenue ?? 0) : 0) || b.streams - a.streams);
}

export type KeyedRow = { key: string; streams: number; revenue: number | null; per1000: number | null };

function keyedRows(streams: Record<string, number>, revenue: Record<string, number> | undefined, n: number): KeyedRow[] {
  const keys = [...new Set([...Object.keys(streams), ...Object.keys(revenue ?? {})])];
  return keys
    .map((key) => {
      const st = streams[key] ?? 0;
      const rev = revenue ? (revenue[key] ?? 0) : null;
      return { key, streams: st, revenue: rev, per1000: rev === null ? null : per1000(rev, st) };
    })
    .sort((a, b) => (revenue ? (b.revenue ?? 0) - (a.revenue ?? 0) : 0) || b.streams - a.streams)
    .slice(0, n);
}

/** Titres : tri par revenus quand le relevé les donne par titre, sinon par streams. */
export const trackRows = (d: UserData, n = 20) => keyedRows(d.trackStreams, d.trackRevenue, n);
/** Pays (ISO2) : même règle. */
export const countryRows = (d: UserData, n = 15) => keyedRows(d.countryStreams, d.countryRevenue, n);

/**
 * Part de chaque plateforme dans les streams : 3 premiers mois du relevé contre
 * 3 derniers. null sous 6 mois (les deux fenêtres se chevaucheraient).
 */
export function platformMixShift(d: UserData): { dsp: DSP; before: number; after: number }[] | null {
  const months = span(d);
  if (months.length < 6) return null;
  const share = (window: string[]) => {
    const totals: Partial<Record<DSP, number>> = {};
    for (const m of window) {
      for (const [dsp, n] of Object.entries(d.streamsByMonth[m] ?? {}) as [DSP, number][]) totals[dsp] = (totals[dsp] ?? 0) + n;
    }
    const all = sumValues(totals);
    return { totals, all };
  };
  const a = share(months.slice(0, 3));
  const b = share(monthsEnding(months[months.length - 1], 3));
  const dsps = [...new Set([...Object.keys(a.totals), ...Object.keys(b.totals)])] as DSP[];
  return dsps
    .map((dsp) => ({
      dsp,
      before: a.all > 0 ? (a.totals[dsp] ?? 0) / a.all : 0,
      after: b.all > 0 ? (b.totals[dsp] ?? 0) / b.all : 0,
    }))
    .sort((x, y) => y.after - x.after);
}

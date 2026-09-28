/**
 * Indicateurs calculés sur le relevé distributeur importé — sans aucune source
 * extérieure. Chaque fonction rend `null` quand le relevé ne permet pas le calcul
 * (trop court, importé avant le détail du 28-29/09) : la page le dit, rien n'est
 * deviné. Les formules sont affichées à côté des chiffres (voir les composants).
 */
import type { UserData } from "@/lib/userdata/store";

const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const sortedMonths = (o: Record<string, unknown>) => Object.keys(o).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/** Indice de Herfindahl (Σ parts²), nombre « équivalent » (1 / HHI), part du 1er et des 3 premiers. */
export function concentration(values: number[]): { hhi: number; equivalent: number; top1: number; top3: number } | null {
  const v = values.filter((x) => x > 0).sort((a, b) => b - a);
  const total = sum(v);
  if (!total) return null;
  const shares = v.map((x) => x / total);
  const hhi = sum(shares.map((s) => s * s));
  return { hhi, equivalent: 1 / hhi, top1: shares[0], top3: sum(shares.slice(0, 3)) };
}

/** Nombre minimal d'éléments (les plus gros d'abord) pour atteindre `share` du total. */
export function titlesToReach(values: number[], share: number): number {
  const v = values.filter((x) => x > 0).sort((a, b) => b - a);
  const target = sum(v) * share;
  let acc = 0;
  for (let i = 0; i < v.length; i++) {
    acc += v[i];
    if (acc >= target - 1e-9) return i + 1;
  }
  return v.length;
}

export type PlatformPay = { dsp: string; streams: number; revenue: number; per1000: number | null; trend: number | null; revenueShare: number; streamShare: number; gap: number };

/**
 * Par plateforme : taux pour 1 000 streams sur la période, son évolution (taux des 3
 * derniers mois ÷ taux des 3 premiers − 1, s'il y a 6 mois), et l'écart entre sa part
 * des revenus et sa part des écoutes (positif = elle paie plus que ce qu'elle pèse).
 */
export function platformPay(d: UserData): PlatformPay[] | null {
  if (!d.revenueByMonthDsp) return null;
  const months = sortedMonths(d.streamsByMonth).filter((m) => d.revenueByMonthDsp![m]);
  const dsps = new Set(months.flatMap((m) => [...Object.keys(d.streamsByMonth[m] ?? {}), ...Object.keys(d.revenueByMonthDsp![m] ?? {})]));
  const s = (m: string, k: string) => (d.streamsByMonth[m]?.[k as never] as number | undefined) ?? 0;
  const r = (m: string, k: string) => (d.revenueByMonthDsp![m]?.[k as never] as number | undefined) ?? 0;
  const totalS = sum(months.flatMap((m) => [...dsps].map((k) => s(m, k))));
  const totalR = sum(months.flatMap((m) => [...dsps].map((k) => r(m, k))));
  if (!totalS || !totalR) return null;
  return [...dsps]
    .map((k) => {
      const active = months.filter((m) => s(m, k) > 0);
      const streams = sum(months.map((m) => s(m, k)));
      const revenue = sum(months.map((m) => r(m, k)));
      const rate = (ms: string[]) => {
        const st = sum(ms.map((m) => s(m, k)));
        return st ? (sum(ms.map((m) => r(m, k))) / st) * 1000 : null;
      };
      const first = rate(active.slice(0, 3));
      const last = rate(active.slice(-3));
      return {
        dsp: k,
        streams,
        revenue,
        per1000: streams ? (revenue / streams) * 1000 : null,
        trend: active.length >= 6 && first && last !== null ? last / first - 1 : null,
        revenueShare: revenue / totalR,
        streamShare: streams / totalS,
        gap: revenue / totalR - streams / totalS,
      };
    })
    .filter((p) => p.streams > 0 || p.revenue !== 0)
    .sort((a, b) => b.revenue - a.revenue);
}

/** Revenu annualisé (3 derniers mois × 4), variabilité (écart-type ÷ moyenne), pire baisse d'un mois sur l'autre. */
export function revenueStability(d: UserData): { annualized: number; cv: number; worstDrop: { month: string; change: number } | null; months: number } | null {
  const months = sortedMonths(d.revenueByMonth);
  if (months.length < 2) return null;
  const v = months.map((m) => d.revenueByMonth[m]);
  const mean = sum(v) / v.length;
  const cv = mean ? Math.sqrt(sum(v.map((x) => (x - mean) ** 2)) / v.length) / mean : 0;
  let worstDrop: { month: string; change: number } | null = null;
  for (let i = 1; i < months.length; i++) {
    if (v[i - 1] <= 0) continue;
    const change = v[i] / v[i - 1] - 1;
    if (change < 0 && (!worstDrop || change < worstDrop.change)) worstDrop = { month: months[i], change };
  }
  return { annualized: (sum(v.slice(-3)) / Math.min(3, v.length)) * 12, cv, worstDrop, months: months.length };
}

/** Indice saisonnier par mois calendaire (« 01 »…« 12 ») : moyenne de ce mois ÷ moyenne générale. 24 mois minimum. */
export function seasonality(d: UserData): Record<string, number> | null {
  const months = sortedMonths(d.revenueByMonth);
  if (months.length < 24) return null;
  const mean = sum(months.map((m) => d.revenueByMonth[m])) / months.length;
  if (!mean) return null;
  const out: Record<string, number> = {};
  for (let c = 1; c <= 12; c++) {
    const key = String(c).padStart(2, "0");
    const same = months.filter((m) => m.endsWith(`-${key}`)).map((m) => d.revenueByMonth[m]);
    if (same.length) out[key] = sum(same) / same.length / mean;
  }
  return out;
}

/**
 * Santé du catalogue : dépendance au hit (part du 1er titre, indice de concentration,
 * titres pour faire 80 %), longue traîne (part hors top 10), titres sous 1 000 streams.
 * Sur les revenus par titre quand le relevé les donne, sinon sur les streams (dit).
 */
export function catalogHealth(d: UserData) {
  const byRevenue = d.trackRevenue && Object.keys(d.trackRevenue).length > 0;
  const source = (byRevenue ? d.trackRevenue! : d.trackStreams) as Record<string, number>;
  const values = Object.values(source).filter((x) => x > 0);
  const c = concentration(values);
  if (!c) return null;
  const sorted = [...values].sort((a, b) => b - a);
  const streams = Object.values(d.trackStreams);
  return {
    basis: byRevenue ? ("revenue" as const) : ("streams" as const),
    titles: values.length,
    top1Share: c.top1,
    top3Share: c.top3,
    hhi: c.hhi,
    equivalentTitles: c.equivalent,
    titlesFor80: titlesToReach(values, 0.8),
    outsideTop10Share: sum(sorted.slice(10)) / sum(sorted),
    smallTitles: streams.filter((x) => x < 1000).length,
  };
}

/**
 * Géographie des écoutes : 1er pays, part hors de lui, nombre équivalent de pays ; taux
 * pour 1 000 streams par pays et son évolution (dernier mois ÷ premier mois du détail).
 */
export function geography(d: UserData) {
  const entries = Object.entries(d.countryStreams).filter(([, v]) => v > 0);
  const c = concentration(entries.map(([, v]) => v));
  if (!c) return null;
  const top = entries.sort((a, b) => b[1] - a[1])[0][0];
  const rateOf = (cc: string, m: string) => {
    const st = d.countryMonthStreams?.[cc]?.[m] ?? 0;
    return st ? ((d.countryMonthRevenue?.[cc]?.[m] ?? 0) / st) * 1000 : null;
  };
  const rates = entries.slice(0, 10).map(([cc, st]) => {
    const rev = d.countryRevenue?.[cc];
    const ms = sortedMonths(d.countryMonthStreams?.[cc] ?? {}).filter((m) => rateOf(cc, m) !== null);
    const first = ms.length >= 2 ? rateOf(cc, ms[0]) : null;
    const last = ms.length >= 2 ? rateOf(cc, ms[ms.length - 1]) : null;
    return { country: cc, streams: st, per1000: rev !== undefined ? (rev / st) * 1000 : null, trend: first && last !== null ? last / first - 1 : null };
  });
  return { top, outsideTopShare: 1 - c.top1, equivalent: c.equivalent, hhi: c.hhi, rates };
}

/** Délai entre le mois de vente et le mois du relevé, médiane pondérée par les revenus. */
export function paymentLag(d: UserData): { median: number; shareByLag: Record<number, number> } | null {
  const rows = Object.entries(d.saleReportRevenue ?? {})
    .map(([k, v]) => {
      const [sale, report] = k.split(">");
      return { lag: monthIndex(report) - monthIndex(sale), v: Math.abs(v) };
    })
    .filter((x) => x.lag >= 0 && x.v > 0);
  const total = sum(rows.map((x) => x.v));
  if (!total) return null;
  const byLag: Record<number, number> = {};
  for (const x of rows) byLag[x.lag] = (byLag[x.lag] ?? 0) + x.v;
  const lags = Object.keys(byLag).map(Number).sort((a, b) => a - b);
  let acc = 0;
  let median = lags[lags.length - 1];
  for (const l of lags) {
    acc += byLag[l];
    if (acc >= total / 2) {
      median = l;
      break;
    }
  }
  return { median, shareByLag: Object.fromEntries(lags.map((l) => [l, byLag[l] / total])) };
}

/**
 * Demi-vie d'un titre : mois entre son pic de streams et le premier mois sous la moitié
 * du pic (un mois du relevé sans ligne pour le titre compte 0). Gardé si la moitié est
 * atteinte, ou s'il y a au moins 3 mois de recul après le pic (sinon on ne sait pas).
 */
export function halfLives(d: UserData) {
  const months = [...d.months].sort();
  const titles: { title: string; peakMonth: string; peak: number; halfLife: number | null; monthsAfterPeak: number }[] = [];
  for (const [title, byMonth] of Object.entries(d.trackMonthStreams ?? {})) {
    const series = months.map((m) => byMonth[m] ?? 0);
    const firstSeen = series.findIndex((x) => x > 0);
    if (firstSeen < 0) continue;
    let peakAt = firstSeen;
    for (let i = firstSeen; i < series.length; i++) if (series[i] > series[peakAt]) peakAt = i;
    const below = series.findIndex((x, i) => i > peakAt && x < series[peakAt] / 2);
    const after = series.length - 1 - peakAt;
    if (below < 0 && after < 3) continue;
    titles.push({ title, peakMonth: months[peakAt], peak: series[peakAt], halfLife: below < 0 ? null : below - peakAt, monthsAfterPeak: after });
  }
  const halved = titles.filter((t) => t.halfLife !== null).map((t) => t.halfLife as number).sort((a, b) => a - b);
  return {
    titles: titles.sort((a, b) => b.peak - a.peak),
    median: halved.length ? halved[Math.floor((halved.length - 1) / 2)] : null,
    stillAbove: titles.length - halved.length,
  };
}

/**
 * Seuil Spotify : depuis avril 2024, un titre sous 1 000 streams sur 12 mois glissants
 * n'est plus rémunéré par Spotify (support.spotify.com, « track monetization eligibility » ;
 * un minimum d'auditeurs, non publié, s'y ajoute). Calculé sur les 12 derniers mois du
 * relevé : si le relevé couvre moins de 12 mois, c'est dit (`fullYear` = false).
 */
export function spotifyThreshold(d: UserData) {
  if (!d.trackSpotify12 || !Object.keys(d.trackSpotify12).length) return null;
  const all = Object.entries(d.trackSpotify12);
  const below = all.filter(([, n]) => n < 1000).map(([title, streams]) => ({ title, streams, revenue: d.trackRevenue?.[title] ?? null })).sort((a, b) => b.streams - a.streams);
  return {
    titles: all.length,
    below,
    belowRevenue: below.reduce((t, x) => t + (x.revenue ?? 0), 0),
    window: d.spotifyWindow ?? null,
    fullYear: (d.spotifyWindow?.months ?? 0) >= 12,
  };
}

/**
 * Roster d'une structure cliente, calculé sur les relevés distributeur importés
 * (mensuels). Ne dit que ce qu'un relevé permet de savoir : pas de genre, de
 * stade de carrière, de net ni de valorisation — ceux-là restent à la démo.
 *
 * Tout se compare sur une FENÊTRE COMMUNE : les 12 mois qui finissent au mois
 * le plus récent présent dans les relevés du roster. Un artiste dont le relevé
 * s'arrête avant est signalé « en retard » plutôt que comparé sur une autre
 * période en silence.
 */

/** Ce que le roster lit d'un relevé (sous-ensemble de UserData). */
export type RosterStatement = {
  months: string[];
  revenueByMonth: Record<string, number>;
  streamsByMonth: Record<string, Partial<Record<string, number>>>;
  importedAt: string;
  format: string;
};

export type RosterArtist = { id: string; name: string; statement: RosterStatement | null };

export type RosterLine = {
  id: string;
  name: string;
  hasStatement: boolean;
  firstMonth: string | null;
  lastMonth: string | null;
  importedAt: string | null;
  format: string | null;
  /** Le relevé s'arrête avant le dernier mois connu du roster. */
  behind: boolean;
  /** Sur la fenêtre commune. */
  revenue: number;
  streams: number;
  /** Part des revenus du roster, 0 → 1. */
  share: number;
  per1000: number | null;
  /** Revenus des 3 derniers mois du relevé contre les 3 d'avant (−0,3 = −30 %) ; null sans 6 mois d'historique. */
  trend: number | null;
};

export type RosterAlert =
  | { kind: "missing"; id: string; name: string }
  | { kind: "behind"; id: string; name: string; lastMonth: string }
  | { kind: "decline"; id: string; name: string; change: number };

export type RosterSummary = {
  window: { from: string; to: string; months: number } | null;
  lines: RosterLine[];
  totals: { artists: number; withStatement: number; revenue: number; streams: number; per1000: number | null };
  top: { id: string; name: string; share: number } | null;
  topThreeShare: number;
  alerts: RosterAlert[];
};

export const WINDOW_MONTHS = 12;
/** Seuil d'alerte « en baisse » (avis produit, pas une mesure) : −20 % sur 3 mois. */
export const DECLINE_ALERT = -0.2;

/** « 2026-01 » + (−1) = « 2025-12 ». */
export function addMonths(month: string, k: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Les `n` mois qui finissent à `end` inclus, du plus ancien au plus récent. */
function monthsEnding(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - n + 1));
}

const streamsOf = (s: RosterStatement, m: string) =>
  Object.values(s.streamsByMonth[m] ?? {}).reduce<number>((sum, v) => sum + (v ?? 0), 0);
const revenueOf = (s: RosterStatement, m: string) => s.revenueByMonth[m] ?? 0;
const sumOver = (months: string[], f: (m: string) => number) => months.reduce((sum, m) => sum + f(m), 0);

function trendOf(s: RosterStatement, first: string, last: string): number | null {
  const recent = monthsEnding(last, 3);
  const before = monthsEnding(addMonths(last, -3), 3);
  if (before[0] < first) return null; // pas 6 mois d'historique : on ne devine pas
  const base = sumOver(before, (m) => revenueOf(s, m));
  if (base <= 0) return null;
  return sumOver(recent, (m) => revenueOf(s, m)) / base - 1;
}

export function summarizeRoster(artists: RosterArtist[]): RosterSummary {
  const spans = artists.map((a) => {
    const months = a.statement ? [...a.statement.months].sort() : [];
    return { first: months[0] ?? null, last: months.at(-1) ?? null };
  });
  const end = spans.reduce<string | null>((max, s) => (s.last && (!max || s.last > max) ? s.last : max), null);
  const window = end ? monthsEnding(end, WINDOW_MONTHS) : [];

  const raw = artists.map((a, i) => {
    const { first, last } = spans[i];
    const s = a.statement;
    const revenue = s ? sumOver(window, (m) => revenueOf(s, m)) : 0;
    const streams = s ? sumOver(window, (m) => streamsOf(s, m)) : 0;
    return {
      id: a.id,
      name: a.name,
      hasStatement: Boolean(s && last),
      firstMonth: first,
      lastMonth: last,
      importedAt: s?.importedAt ?? null,
      format: s?.format ?? null,
      behind: Boolean(end && last && last < end),
      revenue,
      streams,
      per1000: streams > 0 ? (revenue / streams) * 1000 : null,
      trend: s && first && last ? trendOf(s, first, last) : null,
    };
  });

  const revenue = raw.reduce((sum, l) => sum + l.revenue, 0);
  const streams = raw.reduce((sum, l) => sum + l.streams, 0);
  const lines: RosterLine[] = raw
    .map((l) => ({ ...l, share: revenue > 0 ? l.revenue / revenue : 0 }))
    .sort((a, b) => Number(b.hasStatement) - Number(a.hasStatement) || b.revenue - a.revenue || a.name.localeCompare(b.name));

  const ranked = lines.filter((l) => l.hasStatement);
  const alerts: RosterAlert[] = [
    ...lines.filter((l) => !l.hasStatement).map((l) => ({ kind: "missing" as const, id: l.id, name: l.name })),
    ...ranked.filter((l) => l.behind).map((l) => ({ kind: "behind" as const, id: l.id, name: l.name, lastMonth: l.lastMonth! })),
    ...ranked
      .filter((l) => l.trend !== null && l.trend <= DECLINE_ALERT)
      .map((l) => ({ kind: "decline" as const, id: l.id, name: l.name, change: l.trend! })),
  ];

  return {
    window: end ? { from: window[0], to: end, months: WINDOW_MONTHS } : null,
    lines,
    totals: {
      artists: artists.length,
      withStatement: ranked.length,
      revenue,
      streams,
      per1000: streams > 0 ? (revenue / streams) * 1000 : null,
    },
    top: revenue > 0 && ranked[0] ? { id: ranked[0].id, name: ranked[0].name, share: ranked[0].share } : null,
    topThreeShare: ranked.slice(0, 3).reduce((sum, l) => sum + l.share, 0),
    alerts,
  };
}

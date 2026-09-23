/**
 * Le bilan des 12 derniers mois — calculé **une seule fois, ici**.
 *
 * Pulse (bande « Ton année ») et Revenus affichent les mêmes quatre chiffres.
 * Tant qu'ils les calculaient chacun de leur côté, ils divergeaient : fenêtres
 * décalées d'un mois, numérateur et dénominateur pris sur des périodes
 * différentes, meilleur mois cherché sur 24 mois ici et sur 12 là. Deux pages
 * annonçaient deux valeurs pour la même chose.
 *
 * La fenêtre exclut toujours le mois en cours : il est partiel, et le compter
 * ferait mentir aussi bien le total que la comparaison d'année.
 */
import {
  dailyTotals,
  monthlyRevenueTotals,
  revenueSeries,
} from "@/lib/demo/api";

export type YearWindow = {
  /** Les 12 mois retenus, du plus ancien au plus récent ("YYYY-MM"). */
  months: string[];
  revenue: number;
  streams: number;
  /** Le mois le plus fort de la fenêtre, et ce qu'il a rapporté. */
  best: { month: string; amount: number } | null;
  /** Part du streaming dans les revenus de la fenêtre, en points. */
  streamingShare: number;
  /** Variation vs les 12 mois complets précédents, en points. */
  delta: number;
};

export function yearWindow(artistIds: readonly string[]): YearWindow {
  const byMonth = new Map<string, number>();
  for (const id of artistIds) {
    for (const m of monthlyRevenueTotals(id, 25)) {
      byMonth.set(m.month, (byMonth.get(m.month) ?? 0) + m.amount);
    }
  }
  const complete = [...byMonth.keys()].sort().slice(0, -1);
  const months = complete.slice(-12);
  const previous = complete.slice(-24, -12);
  const keep = new Set(months);

  const revenue = months.reduce((s, m) => s + (byMonth.get(m) ?? 0), 0);
  const prevRevenue = previous.reduce((s, m) => s + (byMonth.get(m) ?? 0), 0);

  let streams = 0;
  let streamingAmount = 0;
  for (const id of artistIds) {
    for (const d of dailyTotals(id, 420)) {
      if (keep.has(d.date.slice(0, 7))) streams += d.streams;
    }
    for (const p of revenueSeries(id, 25)) {
      if (keep.has(p.month) && p.source === "streaming") streamingAmount += p.amount;
    }
  }

  const best = months.reduce<YearWindow["best"]>((b, month) => {
    const amount = byMonth.get(month) ?? 0;
    return !b || amount > b.amount ? { month, amount } : b;
  }, null);

  return {
    months,
    revenue,
    streams,
    best,
    streamingShare: revenue === 0 ? 0 : (streamingAmount / revenue) * 100,
    delta: prevRevenue === 0 ? 0 : ((revenue - prevRevenue) / prevRevenue) * 100,
  };
}

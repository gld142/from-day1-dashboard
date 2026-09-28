/**
 * Indicateurs qui croisent les registres saisis (contrats, splits, sync, concerts,
 * dépenses) avec le relevé importé. Tout vient de ce que le client déclare et de ses
 * relevés : ce sont des CALCULS sur ses données, affichés comme tels, jamais des
 * estimations de marché.
 */
import type { Contract } from "@/lib/contracts/contract";
import type { Show } from "@/lib/registers/shows";
import type { SyncLicense } from "@/lib/registers/sync";
import { feeOf } from "@/lib/registers/sync";
import { normTitle, type Split } from "@/lib/splits/split";

const round2 = (n: number) => Math.round(n * 100) / 100;
const days = (a: string, b: string) => (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000;
const yearBefore = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;

/**
 * Recoupement de l'avance, CALCULÉ : revenus du relevé depuis le mois de début du
 * contrat (ou de signature) × taux de royalties saisi. Mois restants au rythme de la
 * moyenne des 3 derniers mois. Écart avec le montant recoupé saisi à la main.
 * Limite (dite à l'écran) : seul le relevé importé compte — pas les autres sources.
 */
export function recoupment(c: Pick<Contract, "advance_eur" | "royalty_rate" | "starts_on" | "signed_on" | "recouped_eur">, revenueByMonth: Record<string, number>) {
  if (!c.advance_eur || !c.royalty_rate) return null;
  const start = (c.starts_on ?? c.signed_on)?.slice(0, 7) ?? null;
  const months = Object.keys(revenueByMonth)
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && (!start || m >= start))
    .sort();
  const rate = c.royalty_rate / 100;
  const revenue = round2(months.reduce((t, m) => t + revenueByMonth[m], 0));
  const royalties = round2(revenue * rate);
  const recouped = Math.min(c.advance_eur, royalties);
  const remaining = round2(c.advance_eur - recouped);
  const last = months.slice(-3);
  const monthly = last.length ? round2((last.reduce((t, m) => t + revenueByMonth[m], 0) / last.length) * rate) : null;
  return {
    since: start,
    revenue,
    royalties,
    recouped,
    remaining,
    monthly,
    monthsLeft: remaining === 0 ? 0 : monthly && monthly > 0 ? Math.ceil(remaining / monthly) : null,
    gapWithDeclared: c.recouped_eur !== null ? round2(recouped - c.recouped_eur) : null,
  };
}

/** Ce que touche chaque personne sur les revenus master du relevé (splits validés ; brouillons à part). */
export function payoutsByPerson(splits: Split[], revenueByTitle: Record<string, number>) {
  const people = new Map<string, { name: string; agreed: number; draft: number; titles: number }>();
  for (const s of splits) {
    const revenue = revenueByTitle[normTitle(s.title)];
    if (revenue === undefined) continue;
    for (const share of s.shares) {
      if (!share.master) continue;
      const key = share.name.trim().toLowerCase();
      const p = people.get(key) ?? { name: share.name.trim(), agreed: 0, draft: 0, titles: 0 };
      const amount = round2((revenue * share.master) / 100);
      if (s.status === "agreed") p.agreed = round2(p.agreed + amount);
      else p.draft = round2(p.draft + amount);
      p.titles++;
      people.set(key, p);
    }
  }
  return [...people.values()].sort((a, b) => b.agreed + b.draft - (a.agreed + a.draft));
}

/** Part des revenus du relevé couverte par un split validé, en brouillon, ou sans split. */
export function splitCoverage(splits: Split[], revenueByTitle: Record<string, number>) {
  const total = Object.values(revenueByTitle).reduce((t, v) => t + Math.max(0, v), 0);
  if (!total) return null;
  const status = new Map<string, Split["status"]>();
  for (const s of splits) {
    const k = normTitle(s.title);
    if (status.get(k) !== "agreed") status.set(k, s.status);
  }
  let agreed = 0;
  let draft = 0;
  for (const [t, v] of Object.entries(revenueByTitle)) {
    if (v <= 0) continue;
    if (status.get(t) === "agreed") agreed += v;
    else if (status.get(t) === "draft") draft += v;
  }
  return { agreed: agreed / total, draft: draft / total, none: (total - agreed - draft) / total };
}

/** Sync : taux de réussite (signées ou payées ÷ conclues, perdues comprises), délai signature → paiement, montant moyen par média. */
export function syncStats(list: SyncLicense[]) {
  const won = list.filter((l) => l.status === "signed" || l.status === "paid");
  const closed = won.length + list.filter((l) => l.status === "lost").length;
  const delays = list.filter((l) => l.status === "paid" && l.signed_on && l.paid_on).map((l) => days(l.signed_on!, l.paid_on!));
  const byMedia: Record<string, number[]> = {};
  for (const l of won) if (feeOf(l) > 0) (byMedia[l.media] ??= []).push(feeOf(l));
  return {
    winRate: closed ? won.length / closed : null,
    avgDaysToPay: delays.length ? Math.round(delays.reduce((t, x) => t + x, 0) / delays.length) : null,
    avgFeeByMedia: Object.fromEntries(Object.entries(byMedia).map(([m, v]) => [m, round2(v.reduce((t, x) => t + x, 0) / v.length)])),
  };
}

/** Concerts : recette par billet et part du cachet dans la billetterie (dates où les deux sont connus), marge de tournée sur 12 mois. */
export function showEconomics(shows: Show[], expenses: { category: string; spent_on: string; amount_eur: number }[], today: string) {
  const since = yearBefore(today);
  const withTickets = shows.filter((s) => s.gross_eur !== null && s.tickets_sold);
  const withFee = shows.filter((s) => s.gross_eur && s.fee_eur !== null);
  const gross = (xs: Show[]) => xs.reduce((t, s) => t + (s.gross_eur ?? 0), 0);
  const fees12 = shows.filter((s) => s.show_date > since && s.show_date <= today).reduce((t, s) => t + (s.fee_eur ?? 0), 0);
  const tour12 = expenses.filter((e) => e.category === "tour" && e.spent_on > since && e.spent_on <= today).reduce((t, e) => t + e.amount_eur, 0);
  return {
    perTicket: withTickets.length ? round2(gross(withTickets) / withTickets.reduce((t, s) => t + (s.tickets_sold ?? 0), 0)) : null,
    feeToGross: withFee.length ? round2(withFee.reduce((t, s) => t + (s.fee_eur ?? 0), 0) / gross(withFee)) : null,
    tourMargin12: round2(fees12 - tour12),
  };
}

/** Contrats d'artiste, de licence ou de distribution qui finissent dans les 180 jours sans reconduction, et le poids de ces artistes dans les revenus. */
export function contractEndRisk(contracts: Pick<Contract, "artist_id" | "kind" | "ends_on" | "auto_renew">[], revenue12ByArtist: Record<string, number>, today: string) {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 180);
  const horizon = limit.toISOString().slice(0, 10);
  const ending = contracts
    .filter((c) => ["artiste", "licence", "distribution"].includes(c.kind) && !c.auto_renew && c.ends_on && c.ends_on >= today && c.ends_on <= horizon)
    .map((c) => ({ artistId: c.artist_id, endsOn: c.ends_on! }));
  const total = Object.values(revenue12ByArtist).reduce((t, v) => t + v, 0);
  const at = new Set(ending.map((e) => e.artistId));
  return { artists: ending, share: total ? [...at].reduce((t, a) => t + (revenue12ByArtist[a] ?? 0), 0) / total : null };
}

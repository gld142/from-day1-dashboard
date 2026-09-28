/**
 * Résultat d'un client, mois par mois, sur 12 mois : ce qui rentre (revenus
 * des relevés distributeur + droits + cachets de concerts + licences sync
 * encaissées) moins ce qui sort (dépenses saisies). Pour la structure entière,
 * ou pour un artiste.
 *
 * À dire sur la page : les revenus distributeur sont rangés au mois de VENTE
 * (tel que le relevé les déclare), les droits au mois de VERSEMENT, les
 * dépenses au mois de PAIEMENT — ce n'est pas une comptabilité.
 */
import { addMonths, monthsEnding } from "@/lib/userdata/roster";

export const EXPENSE_CATEGORIES = ["studio", "clip", "marketing", "distribution", "promo", "tour", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  studio: "Studio, enregistrement",
  clip: "Clip, vidéo",
  marketing: "Marketing, publicité",
  distribution: "Distribution",
  promo: "Promo, presse",
  tour: "Tournée",
  other: "Autre",
};

export type ExpenseInput = {
  /** null : frais de la structure (pas rattachés à un artiste). */
  artist_id: string | null;
  category: ExpenseCategory;
  spent_on: string;
  amount_eur: number;
  label: string;
  notes: string | null;
};
export type Expense = ExpenseInput & { id: string; updated_at: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseExpense(raw: Record<string, string | undefined>, today: string): { ok: true; value: ExpenseInput } | { ok: false; error: string } {
  const err = (error: string) => ({ ok: false as const, error });
  const artist = (raw.artist_id ?? "").trim();
  if (artist && !UUID.test(artist)) return err("Choisis l'artiste concerné, ou la structure.");
  if (!EXPENSE_CATEGORIES.includes(raw.category as ExpenseCategory)) return err("Choisis la catégorie.");
  const spent_on = (raw.spent_on ?? "").trim();
  const d = new Date(`${spent_on}T00:00:00Z`);
  if (!DATE.test(spent_on) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== spent_on) return err("Indique une date valide.");
  if (spent_on > today) return err("Enregistre la dépense à la date où elle est payée (pas dans le futur).");
  const t = (raw.amount_eur ?? "").replace(/[\s  €]/g, "").replace(",", ".");
  const amount = Number(t);
  if (!t || !Number.isFinite(amount) || amount <= 0) return err("Le montant doit être positif.");
  if (amount > 100_000_000) return err("Le montant est trop élevé.");
  const label = (raw.label ?? "").trim();
  if (!label) return err("Décris la dépense.");
  const notes = (raw.notes ?? "").trim();
  if (label.length > 160 || notes.length > 2000) return err("Un texte est trop long.");
  return {
    ok: true,
    value: { artist_id: artist || null, category: raw.category as ExpenseCategory, spent_on, amount_eur: round2(amount), label, notes: notes || null },
  };
}

export type PnlInput = {
  today: string;
  statements: { artistId: string; revenueByMonth: Record<string, number> }[];
  rights: { artistId: string; paid_on: string; amount_eur: number }[];
  /** Cachets des concerts passés (au mois du concert). */
  shows?: { artistId: string; show_date: string; fee_eur: number }[];
  /** Licences sync encaissées (au mois d'encaissement). */
  sync?: { artistId: string; paid_on: string; amount_eur: number }[];
  expenses: Expense[];
  /** "all" : toute la structure (frais généraux compris) ; sinon l'id d'un artiste. */
  scope: "all" | string;
};

export function pnl({ today, statements, rights, shows = [], sync = [], expenses, scope }: PnlInput) {
  const months = monthsEnding(today.slice(0, 7), 12);
  const inScope = (artistId: string | null) => (scope === "all" ? true : artistId === scope);
  const st = statements.filter((s) => inScope(s.artistId));
  const rg = rights.filter((r) => inScope(r.artistId));
  const ex = expenses.filter((e) => inScope(e.artist_id));
  const sh = shows.filter((x) => inScope(x.artistId) && x.show_date <= today);
  const sy = sync.filter((x) => inScope(x.artistId));

  const rows = months.map((month) => {
    const statementsRev = round2(st.reduce((s, x) => s + (x.revenueByMonth[month] ?? 0), 0));
    const rightsRev = round2(rg.filter((r) => r.paid_on.slice(0, 7) === month).reduce((s, r) => s + r.amount_eur, 0));
    const spent = round2(ex.filter((e) => e.spent_on.slice(0, 7) === month).reduce((s, e) => s + e.amount_eur, 0));
    const concerts = round2(sh.filter((x) => x.show_date.slice(0, 7) === month).reduce((s, x) => s + x.fee_eur, 0));
    const syncRev = round2(sy.filter((x) => x.paid_on.slice(0, 7) === month).reduce((s, x) => s + x.amount_eur, 0));
    const revenue = round2(statementsRev + rightsRev + concerts + syncRev);
    return { month, statements: statementsRev, rights: rightsRev, concerts, sync: syncRev, revenue, expenses: spent, net: round2(revenue - spent) };
  });

  const sum = (k: "statements" | "rights" | "concerts" | "sync" | "revenue" | "expenses" | "net") => round2(rows.reduce((s, r) => s + r[k], 0));
  const revenue = sum("revenue");
  const net = sum("net");

  const inWindow = (d: string) => d.slice(0, 7) >= months[0] && d.slice(0, 7) <= months[months.length - 1];
  const cat = new Map<ExpenseCategory, number>();
  for (const e of ex) if (inWindow(e.spent_on)) cat.set(e.category, round2((cat.get(e.category) ?? 0) + e.amount_eur));

  const lastStatement = st.flatMap((s) => Object.keys(s.revenueByMonth)).sort().at(-1) ?? null;
  return {
    months,
    rows,
    totals: {
      statements: sum("statements"),
      rights: sum("rights"),
      concerts: sum("concerts"),
      sync: sum("sync"),
      revenue,
      expenses: sum("expenses"),
      net,
      margin: revenue > 0 ? net / revenue : null,
    },
    byCategory: [...cat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    /** Dernier mois couvert par les relevés du périmètre : après, les revenus distributeur manquent encore. */
    statementsUntil: lastStatement,
    /** Le mois suivant : premier mois sans relevé (pour la note de la page). */
    firstMissing: lastStatement ? addMonths(lastStatement, 1) : null,
  };
}

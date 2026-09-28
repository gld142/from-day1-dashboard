/**
 * Versements de droits saisis par le client (SACEM, ADAMI, SPEDIDAM…) :
 * validation du formulaire, totaux, et organismes « silencieux ».
 *
 * Les rythmes ci-dessous servent seulement à signaler un organisme dont on n'a
 * rien saisi depuis longtemps : ce sont des choix produit indicatifs, PAS le
 * calendrier officiel de répartition des organismes.
 */

export const ORGANISMS = ["sacem", "adami", "spedidam", "spre", "scpp", "scpa", "autre"] as const;
export type Organism = (typeof ORGANISMS)[number];
export const ORGANISM_LABEL: Record<Organism, string> = {
  sacem: "SACEM",
  adami: "ADAMI",
  spedidam: "SPEDIDAM",
  spre: "SPRE",
  scpp: "SCPP",
  scpa: "SCPA",
  autre: "Autre",
};
/** Au-delà de ce nombre de mois sans versement saisi, l'organisme est signalé (null : jamais). */
export const USUAL_GAP_MONTHS: Record<Organism, number | null> = {
  sacem: 4,
  adami: 13,
  spedidam: 13,
  spre: 13,
  scpp: 13,
  scpa: 13,
  autre: null,
};

export type RightsPaymentInput = {
  artist_id: string;
  organism: Organism;
  paid_on: string;
  amount_eur: number;
  period_label: string | null;
  notes: string | null;
};
export type RightsPayment = RightsPaymentInput & { id: string; updated_at: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePayment(
  raw: Record<string, string | undefined>,
  today: string,
): { ok: true; value: RightsPaymentInput } | { ok: false; error: string } {
  const err = (error: string) => ({ ok: false as const, error });
  if (!UUID.test(raw.artist_id ?? "")) return err("Choisis l'artiste concerné.");
  if (!ORGANISMS.includes(raw.organism as Organism)) return err("Choisis l'organisme.");
  const paid_on = (raw.paid_on ?? "").trim();
  if (!paid_on) return err("Indique la date du versement.");
  const d = new Date(`${paid_on}T00:00:00Z`);
  if (!DATE.test(paid_on) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== paid_on) return err("Une date n'est pas valide.");
  if (paid_on > today) return err("La date du versement est dans le futur.");
  const t = (raw.amount_eur ?? "").replace(/[\s  €]/g, "").replace(",", ".");
  if (!t) return err("Indique le montant reçu.");
  const amount = Number(t);
  if (!Number.isFinite(amount) || amount < -1_000_000 || amount > 100_000_000) return err("Le montant n'est pas un nombre valide.");
  const period_label = (raw.period_label ?? "").trim();
  const notes = (raw.notes ?? "").trim();
  if (period_label.length > 120 || notes.length > 2000) return err("Un texte est trop long.");
  return {
    ok: true,
    value: {
      artist_id: raw.artist_id!,
      organism: raw.organism as Organism,
      paid_on,
      amount_eur: Math.round(amount * 100) / 100,
      period_label: period_label || null,
      notes: notes || null,
    },
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Mois pleins écoulés entre deux dates « YYYY-MM-DD ». */
function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

export function summarizePayments(payments: RightsPayment[], today: string) {
  const [ty, tm, td] = today.split("-");
  const yearAgo = `${Number(ty) - 1}-${tm}-${td}`;
  const in12m = (p: RightsPayment) => p.paid_on > yearAgo && p.paid_on <= today;

  const byOrganism = ORGANISMS.map((organism) => {
    const list = payments.filter((p) => p.organism === organism).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
    if (!list.length) return null;
    const last = list[0];
    const since = monthsBetween(last.paid_on, today);
    const gap = USUAL_GAP_MONTHS[organism];
    return {
      organism,
      count: list.length,
      total12m: round2(list.filter(in12m).reduce((s, p) => s + p.amount_eur, 0)),
      totalAll: round2(list.reduce((s, p) => s + p.amount_eur, 0)),
      last: { paid_on: last.paid_on, amount_eur: last.amount_eur },
      stale: gap !== null && since > gap ? { monthsSince: since } : null,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const years = new Map<number, { total: number; byOrganism: Partial<Record<Organism, number>> }>();
  for (const p of payments) {
    const y = Number(p.paid_on.slice(0, 4));
    const e = years.get(y) ?? { total: 0, byOrganism: {} };
    e.total = round2(e.total + p.amount_eur);
    e.byOrganism[p.organism] = round2((e.byOrganism[p.organism] ?? 0) + p.amount_eur);
    years.set(y, e);
  }

  return {
    total12m: round2(payments.filter(in12m).reduce((s, p) => s + p.amount_eur, 0)),
    totalAll: round2(payments.reduce((s, p) => s + p.amount_eur, 0)),
    byOrganism,
    byYear: [...years.entries()].sort(([a], [b]) => b - a).map(([year, e]) => ({ year, ...e })),
  };
}

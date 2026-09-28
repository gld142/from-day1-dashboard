/**
 * Contrats saisis par le client : validation du formulaire et échéances.
 *
 * Day 1 ne lit pas le contrat : il reprend ce que le client DÉCLARE (dates,
 * préavis, avance…) et en tire les dates qui comptent. Les fenêtres d'alerte
 * (120 jours avant un préavis, 180 avant une fin) sont des choix produit.
 */

export const CONTRACT_KINDS = ["artiste", "licence", "distribution", "edition", "management", "booking", "sync", "autre"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];
export const KIND_LABEL: Record<ContractKind, string> = {
  artiste: "Contrat d'artiste",
  licence: "Licence",
  distribution: "Distribution",
  edition: "Édition",
  management: "Management",
  booking: "Booking",
  sync: "Synchro",
  autre: "Autre",
};

export type ContractInput = {
  artist_id: string;
  kind: ContractKind;
  counterparty: string;
  signed_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notice_days: number | null;
  auto_renew: boolean;
  royalty_rate: number | null;
  advance_eur: number | null;
  recouped_eur: number | null;
  recouped_at: string | null;
  territory: string | null;
  exclusive: boolean;
  notes: string | null;
};
export type Contract = ContractInput & { id: string; updated_at: string };

export const NOTICE_WINDOW_DAYS = 120;
export const ENDING_WINDOW_DAYS = 180;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

class FormError extends Error {}
const fail = (message: string): never => {
  throw new FormError(message);
};

const text = (v: string | undefined, max: number) => {
  const t = (v ?? "").trim();
  if (t.length > max) fail("Un texte est trop long.");
  return t || null;
};
/** « 10 000 », « 2500,50 » → nombre ; vide → null. */
const amount = (v: string | undefined) => {
  const t = (v ?? "").replace(/[\s  €%]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) fail("Un montant n'est pas un nombre.");
  return Math.round(n * 100) / 100;
};
const date = (v: string | undefined) => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const d = new Date(`${t}T00:00:00Z`);
  if (!DATE.test(t) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) fail("Une date n'est pas valide.");
  return t;
};
const checked = (v: string | undefined) => v === "on" || v === "1" || v === "true";

/** Valide un formulaire de contrat (valeurs texte, comme un FormData). */
export function parseContract(raw: Record<string, string | undefined>): { ok: true; value: ContractInput } | { ok: false; error: string } {
  try {
    if (!UUID.test(raw.artist_id ?? "")) fail("Choisis l'artiste concerné.");
    if (!CONTRACT_KINDS.includes(raw.kind as ContractKind)) fail("Choisis le type de contrat.");
    const counterparty = text(raw.counterparty, 160);
    if (!counterparty) fail("Indique avec qui le contrat est signé.");
    const starts_on = date(raw.starts_on);
    const ends_on = date(raw.ends_on);
    if (starts_on && ends_on && ends_on < starts_on) fail("La fin du contrat est avant son début.");
    const notice = amount(raw.notice_days);
    if (notice !== null && (!Number.isInteger(notice) || notice < 0 || notice > 3650)) fail("Le préavis se compte en jours (0 à 3650).");
    const royalty_rate = amount(raw.royalty_rate);
    if (royalty_rate !== null && (royalty_rate < 0 || royalty_rate > 100)) fail("Le taux doit être entre 0 et 100 %.");
    const advance_eur = amount(raw.advance_eur);
    const recouped_eur = amount(raw.recouped_eur);
    if ((advance_eur ?? 0) < 0 || (recouped_eur ?? 0) < 0) fail("Un montant ne peut pas être négatif.");
    if (recouped_eur !== null && recouped_eur > (advance_eur ?? 0)) fail("Le montant recoupé dépasse l'avance.");
    return {
      ok: true,
      value: {
        artist_id: raw.artist_id!,
        kind: raw.kind as ContractKind,
        counterparty: counterparty!,
        signed_on: date(raw.signed_on),
        starts_on,
        ends_on,
        notice_days: notice,
        auto_renew: checked(raw.auto_renew),
        royalty_rate,
        advance_eur,
        recouped_eur,
        recouped_at: date(raw.recouped_at),
        territory: text(raw.territory, 120),
        exclusive: checked(raw.exclusive),
        notes: text(raw.notes, 2000),
      },
    };
  } catch (e) {
    if (e instanceof FormError) return { ok: false, error: e.message };
    throw e;
  }
}

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
const addDays = (d: string, n: number) => new Date(toTime(d) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);

export type ContractAlert = { kind: "notice" | "notice-passed" | "ending"; date: string; daysLeft: number };

export function contractTimeline(c: Contract, today: string) {
  const noticeDeadline = c.ends_on && c.notice_days !== null ? addDays(c.ends_on, -c.notice_days) : null;
  const status: "upcoming" | "active" | "ended" =
    c.ends_on && c.ends_on < today ? "ended" : c.starts_on && c.starts_on > today ? "upcoming" : "active";
  const alerts: ContractAlert[] = [];
  if (status !== "ended") {
    if (noticeDeadline) {
      const left = daysBetween(today, noticeDeadline);
      if (left >= 0 && left <= NOTICE_WINDOW_DAYS) alerts.push({ kind: "notice", date: noticeDeadline, daysLeft: left });
      if (left < 0) alerts.push({ kind: "notice-passed", date: noticeDeadline, daysLeft: left });
    }
    if (c.ends_on) {
      const left = daysBetween(today, c.ends_on);
      if (left <= ENDING_WINDOW_DAYS) alerts.push({ kind: "ending", date: c.ends_on, daysLeft: left });
    }
  }
  const recoupRemaining = c.advance_eur !== null && c.advance_eur > 0 ? Math.round((c.advance_eur - (c.recouped_eur ?? 0)) * 100) / 100 : null;
  return { status, noticeDeadline, alerts, recoupRemaining };
}

/**
 * Lecture des contrats pour /contracts : la prochaine date qui engage, le reste à recouper, le
 * tri, la recherche et l'horizon des échéances. Pur (aucun React) : le tableau et la liste
 * « Ce qui arrive » s'en servent, les tests aussi.
 *
 * Pensé pour un roster de 150 artistes comme pour 9 : un seul tableau trié, pas une carte par
 * artiste (Gaël, 28/10/2026 : « tout est proportionnel à la taille du truc, ça fatigue l'œil »).
 */
import type { Contract, ContractAlert } from "./types";

/** Ce qu'il reste à rembourser sur l'avance de CE contrat (jamais négatif). */
export function remainingOf(c: Contract): number {
  return Math.max(0, c.advance - (c.advance * c.recoupedPct) / 100);
}

/** La prochaine date qui engage : l'échéance d'une alerte à venir, sinon la fin du contrat en cours. */
export function nextDueOf(c: Contract, todayIso: string): string | null {
  const dates = c.alerts.map((a) => a.dueDate).filter((d): d is string => !!d && d >= todayIso);
  if (c.endDate >= todayIso) dates.push(c.endDate);
  return dates.sort()[0] ?? null;
}

/** Les années couvertes par au moins un contrat, de la plus ancienne à la plus récente. */
export function contractYears(contracts: readonly Contract[]): number[] {
  if (contracts.length === 0) return [];
  const lo = Math.min(...contracts.map((c) => Number(c.startDate.slice(0, 4))));
  const hi = Math.max(...contracts.map((c) => Number(c.endDate.slice(0, 4))));
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Un contrat est « en cours en {année} » s'il en couvre au moins un jour. */
export function activeInYear(c: Contract, year: number): boolean {
  return c.startDate.slice(0, 4) <= String(year) && c.endDate.slice(0, 4) >= String(year);
}

/** Minuscules, sans accents : « Édition » se trouve en tapant « edition ». */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export type ContractRow = {
  contract: Contract;
  artistName: string;
  /** Libellé traduit du type (« Licence », « Édition »…), pour la recherche et le tri. */
  typeLabel: string;
  remaining: number;
  nextDue: string | null;
};

export function toRows(
  contracts: readonly Contract[],
  todayIso: string,
  nameOf: (artistId: string) => string,
  typeLabelOf: (c: Contract) => string,
): ContractRow[] {
  return contracts.map((contract) => ({
    contract,
    artistName: nameOf(contract.artistId),
    typeLabel: typeLabelOf(contract),
    remaining: remainingOf(contract),
    nextDue: nextDueOf(contract, todayIso),
  }));
}

/** Recherche (artiste, contrepartie, type, territoire) et année « en cours ». */
export function filterRows(rows: readonly ContractRow[], query: string, year: number | null): ContractRow[] {
  const q = fold(query);
  return rows.filter((r) => {
    if (year !== null && !activeInYear(r.contract, year)) return false;
    if (!q) return true;
    return [r.artistName, r.contract.counterparty, r.typeLabel, r.contract.territory].some((f) => fold(f).includes(q));
  });
}

export type SortKey = "artist" | "type" | "end" | "next" | "rate" | "advance" | "remaining" | "recouped";
export type SortDir = "asc" | "desc";

/** Le sens qu'on attend au premier clic : A → Z et « le plus proche » montent, les montants descendent. */
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  artist: "asc",
  type: "asc",
  end: "asc",
  next: "asc",
  rate: "desc",
  advance: "desc",
  remaining: "desc",
  recouped: "asc",
};

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

function compare(a: ContractRow, b: ContractRow, key: SortKey): number {
  switch (key) {
    case "artist":
      return collator.compare(a.artistName, b.artistName);
    case "type":
      return collator.compare(a.typeLabel, b.typeLabel);
    case "end":
      return a.contract.endDate.localeCompare(b.contract.endDate);
    case "next":
      // Sans prochaine date (contrat terminé) : toujours en bas, quel que soit le sens.
      return (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999");
    case "rate":
      return a.contract.royaltyRate - b.contract.royaltyRate;
    case "advance":
      return a.contract.advance - b.contract.advance;
    case "remaining":
      return a.remaining - b.remaining;
    case "recouped":
      return a.contract.recoupedPct - b.contract.recoupedPct;
  }
}

/** Tri stable ; à égalité, l'artiste puis la fin du contrat départagent (ordre lisible, jamais aléatoire). */
export function sortRows(rows: readonly ContractRow[], key: SortKey, dir: SortDir): ContractRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "next" && (a.nextDue === null) !== (b.nextDue === null)) return a.nextDue === null ? 1 : -1;
    return (
      sign * compare(a, b, key) ||
      collator.compare(a.artistName, b.artistName) ||
      a.contract.endDate.localeCompare(b.contract.endDate)
    );
  });
}

/* ─── Ce qui arrive ─── */

export type Horizon = "undated" | "overdue" | "soon" | "quarter" | "later";
export const HORIZONS: readonly Horizon[] = ["undated", "overdue", "soon", "quarter", "later"];

const DAY_MS = 86_400_000;

/** Jours entre aujourd'hui et l'échéance (négatif : dépassée). */
export function daysUntil(dueIso: string, todayIso: string): number {
  return Math.round((Date.parse(dueIso) - Date.parse(todayIso)) / DAY_MS);
}

/** Sans date : à traiter (une clause à renégocier n'attend pas) ; sinon dépassée, ≤ 30 j, ≤ 90 j, plus tard. */
export function horizonOf(alert: ContractAlert, todayIso: string): Horizon {
  if (!alert.dueDate) return "undated";
  const d = daysUntil(alert.dueDate, todayIso);
  if (d < 0) return "overdue";
  if (d <= 30) return "soon";
  if (d <= 90) return "quarter";
  return "later";
}

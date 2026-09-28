import { DSPS as DSP_LIST } from "@/lib/demo/types";
import { ISRC } from "./parse-csv";
import { DETAIL_TITLES, type UserData } from "./store";

const DSPS: ReadonlySet<string> = new Set(DSP_LIST);
const MONTH = /^\d{4}-\d{2}$/;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e12;
/** Montant signé : un découpage de revenus peut être négatif (remboursement, régularisation). */
const signedNum = (v: unknown) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e12;
const shortText = (v: unknown, max = 200) => typeof v === "string" && v.length <= max;

function numberMap(
  v: unknown,
  maxKeys: number,
  key: (k: string) => boolean,
  value: (n: unknown) => boolean = num,
): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > maxKeys) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of entries) {
    if (!key(k) || !value(n)) return null;
    out[k] = n as number;
  }
  return out;
}

/**
 * Découpages de revenus (ajoutés le 28/09/2026) : ABSENTS des relevés enregistrés
 * avant — `undefined` alors, pas une erreur. Présents : même rigueur qu'ailleurs.
 */
type Breakdowns = Pick<UserData, "revenueByMonthDsp" | "trackRevenue" | "countryRevenue">;
function revenueBreakdowns(d: Record<string, unknown>): Breakdowns | null {
  const out: Breakdowns = {};
  if (d.revenueByMonthDsp !== undefined) {
    const raw = d.revenueByMonthDsp;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length > 360) return null;
    const byMonth: NonNullable<UserData["revenueByMonthDsp"]> = {};
    for (const [m, perDsp] of entries) {
      const clean = numberMap(perDsp, DSPS.size, (k) => DSPS.has(k), signedNum);
      if (!MONTH.test(m) || !clean) return null;
      byMonth[m] = clean;
    }
    out.revenueByMonthDsp = byMonth;
  }
  if (d.trackRevenue !== undefined) {
    const clean = numberMap(d.trackRevenue, 5000, (k) => k.length <= 300, signedNum);
    if (!clean) return null;
    out.trackRevenue = clean;
  }
  if (d.countryRevenue !== undefined) {
    const clean = numberMap(d.countryRevenue, 300, (k) => /^[A-Z]{2}$/.test(k), signedNum);
    if (!clean) return null;
    out.countryRevenue = clean;
  }
  return out;
}

/** Carte à deux niveaux (titre ou pays → mois → nombre), bornée. */
function nestedMap(v: unknown, maxOuter: number, outerKey: (k: string) => boolean, value: (n: unknown) => boolean): Record<string, Record<string, number>> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > maxOuter) return null;
  const out: Record<string, Record<string, number>> = {};
  for (const [k, inner] of entries) {
    const clean = numberMap(inner, 360, (m) => MONTH.test(m), value);
    if (!outerKey(k) || !clean) return null;
    out[k] = clean;
  }
  return out;
}

/** Détail gardé depuis le 29/09/2026 : chaque champ absent = relevé plus ancien, pas une erreur. */
type Detail = Pick<UserData, "trackMonthStreams" | "trackMonthRevenue" | "countryMonthStreams" | "countryMonthRevenue" | "trackIsrc" | "saleReportRevenue" | "withheldEur" | "artistRevenue">;
function detail(d: Record<string, unknown>): Detail | null {
  const out: Detail = {};
  const title = (k: string) => k.length <= 300;
  const iso2 = (k: string) => /^[A-Z]{2}$/.test(k);
  const nested = [
    ["trackMonthStreams", DETAIL_TITLES, title, num],
    ["trackMonthRevenue", DETAIL_TITLES, title, signedNum],
    ["countryMonthStreams", 300, iso2, num],
    ["countryMonthRevenue", 300, iso2, signedNum],
  ] as const;
  for (const [key, max, k, v] of nested) {
    if (d[key] === undefined) continue;
    const clean = nestedMap(d[key], max, k, v);
    if (!clean) return null;
    out[key] = clean;
  }
  if (d.trackIsrc !== undefined) {
    const raw = d.trackIsrc;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length > 5000 || !entries.every(([t, i]) => title(t) && typeof i === "string" && ISRC.test(i))) return null;
    out.trackIsrc = Object.fromEntries(entries) as Record<string, string>;
  }
  if (d.saleReportRevenue !== undefined) {
    const clean = numberMap(d.saleReportRevenue, 2000, (k) => /^\d{4}-\d{2}>\d{4}-\d{2}$/.test(k), signedNum);
    if (!clean) return null;
    out.saleReportRevenue = clean;
  }
  if (d.withheldEur !== undefined) {
    if (!signedNum(d.withheldEur)) return null;
    out.withheldEur = d.withheldEur as number;
  }
  if (d.artistRevenue !== undefined) {
    const clean = numberMap(d.artistRevenue, 500, (k) => k.length <= 200, signedNum);
    if (!clean) return null;
    out.artistRevenue = clean;
  }
  return out;
}

/**
 * Vérifie un relevé envoyé par le navigateur avant de l'enregistrer : bonne forme,
 * nombres finis et positifs, tailles bornées. Renvoie une copie propre, ou null.
 * (Les chiffres sont ceux du client, pour SON dashboard : on protège l'affichage
 * et la base, pas la « vérité » du relevé.)
 */
export function validateUserData(input: unknown): UserData | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, unknown>;
  if (d.version !== 1 || !shortText(d.artistName) || !shortText(d.importedAt, 40)) return null;
  if (!["distrokid", "tunecore", "believe", "generic"].includes(String(d.format))) return null;
  // Devise connue obligatoire (jamais « unknown » : on ne convertit pas au hasard),
  // et un relevé en euros n'est pas converti.
  if (!num(d.eurRate) || !["EUR", "USD", "GBP"].includes(String(d.sourceCurrency))) return null;
  if (d.sourceCurrency === "EUR" ? d.eurRate !== 1 : !((d.eurRate as number) > 0)) return null;
  if (!Array.isArray(d.months) || d.months.length > 360 || !d.months.every((m) => typeof m === "string" && MONTH.test(m))) return null;

  const rawStreams = d.streamsByMonth;
  if (!rawStreams || typeof rawStreams !== "object" || Array.isArray(rawStreams)) return null;
  const streamsByMonth: UserData["streamsByMonth"] = {};
  const monthEntries = Object.entries(rawStreams as Record<string, unknown>);
  if (monthEntries.length > 360) return null;
  for (const [m, perDsp] of monthEntries) {
    const clean = numberMap(perDsp, DSPS.size, (k) => DSPS.has(k));
    if (!MONTH.test(m) || !clean) return null;
    streamsByMonth[m] = clean;
  }
  const revenueByMonth = numberMap(d.revenueByMonth, 360, (k) => MONTH.test(k));
  const trackStreams = numberMap(d.trackStreams, 5000, (k) => k.length <= 300);
  const countryStreams = numberMap(d.countryStreams, 300, (k) => /^[A-Z]{2}$/.test(k));
  if (!revenueByMonth || !trackStreams || !countryStreams || !num(d.totalStreams) || !num(d.totalRevenueEur)) return null;
  const breakdowns = revenueBreakdowns(d);
  if (!breakdowns) return null;
  const extra = detail(d);
  if (!extra) return null;

  return {
    version: 1,
    artistName: d.artistName as string,
    importedAt: d.importedAt as string,
    format: d.format as UserData["format"],
    eurRate: d.eurRate as number,
    sourceCurrency: d.sourceCurrency as UserData["sourceCurrency"],
    months: d.months as string[],
    streamsByMonth,
    revenueByMonth,
    trackStreams,
    countryStreams,
    totalStreams: d.totalStreams as number,
    totalRevenueEur: d.totalRevenueEur as number,
    active: true,
    ...breakdowns,
    ...extra,
  };
}

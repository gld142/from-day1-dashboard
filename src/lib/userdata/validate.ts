import { DSPS as DSP_LIST } from "@/lib/demo/types";
import type { UserData } from "./store";

const DSPS: ReadonlySet<string> = new Set(DSP_LIST);
const MONTH = /^\d{4}-\d{2}$/;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e12;
const shortText = (v: unknown, max = 200) => typeof v === "string" && v.length <= max;

function numberMap(v: unknown, maxKeys: number, key: (k: string) => boolean): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > maxKeys) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of entries) {
    if (!key(k) || !num(n)) return null;
    out[k] = n as number;
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
  };
}

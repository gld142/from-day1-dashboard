/**
 * Parseur de relevés distributeurs (DistroKid, TuneCore, Believe, générique).
 * 100 % côté client : le fichier de l'utilisateur ne quitte jamais son navigateur.
 */

import type { DSP } from "@/lib/demo/types";

export type ParsedStatement = {
  format: "distrokid" | "tunecore" | "believe" | "generic";
  currency: "USD" | "EUR" | "GBP" | "unknown";
  /** mois "2025-03" → streams par DSP */
  streamsByMonth: Record<string, Partial<Record<DSP, number>>>;
  /** mois → revenu (devise source) */
  revenueByMonth: Record<string, number>;
  /** mois → { DSP → revenu } (devise source) : ce que chaque plateforme paie vraiment */
  revenueByMonthDsp: Record<string, Partial<Record<DSP, number>>>;
  /** titre → streams cumulés */
  trackStreams: Record<string, number>;
  /** titre → revenu cumulé (devise source) */
  trackRevenue: Record<string, number>;
  /** ISO2 pays → streams cumulés */
  countryStreams: Record<string, number>;
  /** ISO2 pays → revenu cumulé (devise source) */
  countryRevenue: Record<string, number>;
  /**
   * Détail gardé depuis le 29/09/2026 (avant : jeté à l'import) — titre × mois et
   * pays × mois (demi-vie d'un titre, taux par pays dans le temps), ISRC par titre
   * (rapprochement exact avec les splits), mois de vente → mois du relevé (délai de
   * paiement), retenues, revenus par artiste crédité (relevés de label).
   */
  trackMonthStreams: Record<string, Record<string, number>>;
  trackMonthRevenue: Record<string, Record<string, number>>;
  countryMonthStreams: Record<string, Record<string, number>>;
  countryMonthRevenue: Record<string, Record<string, number>>;
  trackIsrc: Record<string, string>;
  /** « AAAA-MM>AAAA-MM » (mois de vente > mois du relevé) → revenu (devise source) */
  saleReportRevenue: Record<string, number>;
  /** Retenues à la source (DistroKid « Songwriter Royalties Withheld »), devise source */
  withheld: number;
  artistRevenue: Record<string, number>;
  /**
   * Conversion au taux BCE du mois de vente (si `eurPerUnit` est passé) : tous les
   * montants ci-dessus sont alors DÉJÀ en euros. `used` = taux appliqué par mois ;
   * `fallback` = mois sans taux publié (dernier taux connu appliqué) ; `sourceTotal`
   * = total dans la devise du fichier.
   */
  fx?: { used: Record<string, number>; fallback: string[]; sourceTotal: number };
  totalStreams: number;
  totalRevenue: number;
  months: string[]; // triés
  artistNames: string[];
  rowCount: number;
  warnings: string[];
};

/* ─────────── CSV bas niveau ─────────── */

function detectDelimiter(header: string): string {
  const counts: Array<[string, number]> = [",", ";", "\t"].map((d) => [
    d,
    header.split(d).length,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

/** Parse une ligne CSV en respectant les guillemets. */
function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/* ─────────── Normalisations ─────────── */

/** ISRC : 2 lettres (pays), 3 caractères (déclarant), 2 chiffres (année), 5 chiffres. */
export const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

const STORE_TO_DSP: Array<[RegExp, DSP]> = [
  [/spotify/i, "spotify"],
  [/apple|itunes/i, "apple"],
  [/youtube|google play/i, "youtube"],
  [/deezer/i, "deezer"],
  [/tiktok|resso|bytedance|douyin/i, "tiktok"],
  [/amazon/i, "amazon"],
];

export function storeToDsp(store: string): DSP {
  for (const [re, dsp] of STORE_TO_DSP) if (re.test(store)) return dsp;
  return "other";
}

/** "2025-03", "Mar 2025", "03/2025", "2025-03-15" → "2025-03" */
function normalizeMonth(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  const MONTHS: Record<string, string> = {
    jan: "01", feb: "02", fev: "02", fév: "02", mar: "03", apr: "04", avr: "04",
    may: "05", mai: "05", jun: "06", jui: "06", jul: "07", aug: "08", aou: "08",
    aoû: "08", sep: "09", oct: "10", nov: "11", dec: "12", déc: "12",
  };
  m = s.toLowerCase().match(/^([a-zéû]{3})[a-zéû]*[ .-]*(\d{4})$/);
  if (m && MONTHS[m[1]]) return `${m[2]}-${MONTHS[m[1]]}`;
  return null;
}

function parseNumber(raw: string): number {
  const s = raw.replace(/[€$£\s"]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/* ─────────── Détection de format ─────────── */

type ColumnMap = {
  month: number;
  report: number;
  isrc: number;
  withheld: number;
  store: number;
  artist: number;
  title: number;
  quantity: number;
  earnings: number;
  country: number;
};

function findCol(headers: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

function detectFormat(headers: string[]): {
  format: ParsedStatement["format"];
  cols: ColumnMap;
  currency: ParsedStatement["currency"];
} {
  const h = headers.map((x) => x.toLowerCase());
  const cols: ColumnMap = {
    // « Sale Month » (DistroKid) comme « Sales Month » : le mois de VENTE. Le mois du
    // relevé n'est qu'un dernier recours (mesuré le 29/09 : « Sales Month » tombait sur
    // « Reporting Month », revenus datés deux mois trop tard).
    month: findCol(h, [/sales? month/, /sales? period/, /période|periode/, /^month$/, /reporting/, /^date$/]),
    report: findCol(h, [/reporting (date|month|period)/, /^reporting/, /statement (date|month|period)/, /date (de|du) (rapport|relevé)/, /accounting (period|date)/]),
    isrc: findCol(h, [/^isrc$/, /isrc/]),
    withheld: findCol(h, [/withheld/, /retenue/]),
    store: findCol(h, [/^store$/, /store name/, /platform|plateforme/, /^dsp$/, /retailer/]),
    artist: findCol(h, [/^artist/, /artiste/]),
    title: findCol(h, [/song title/, /^title$/, /^song/, /titre/, /track/]),
    quantity: findCol(h, [/^quantity$/, /units sold/, /^units$/, /streams?$/, /quantité|quantite/, /nb.*(stream|écoute)/]),
    earnings: findCol(h, [/earnings/, /total earned/, /royalt/, /revenu/, /net income/, /amount/, /montant/]),
    country: findCol(h, [/country/, /pays/, /territory|territoire/]),
  };

  const joined = h.join("|");
  let format: ParsedStatement["format"] = "generic";
  if (/team percentage|songwriter royalties/i.test(joined)) format = "distrokid";
  else if (/sales period|total earned/i.test(joined)) format = "tunecore";
  else if (/believe|nb of (units|streams)|net income/i.test(joined)) format = "believe";

  let currency: ParsedStatement["currency"] = "unknown";
  if (/usd|\$/.test(joined)) currency = "USD";
  else if (/eur|€/.test(joined)) currency = "EUR";
  else if (/gbp|£/.test(joined)) currency = "GBP";
  if (format === "distrokid" && currency === "unknown") currency = "USD";
  if (format === "believe" && currency === "unknown") currency = "EUR";

  return { format, cols, currency };
}

/* ─────────── Parse principal ─────────── */

export type ParseOptions = {
  /** Euros pour 1 unité de la devise du fichier, par mois « AAAA-MM » (taux BCE mensuels). */
  eurPerUnit?: Record<string, number>;
};

export function parseStatement(text: string, opts: ParseOptions = {}): ParsedStatement {
  const fxTable = opts.eurPerUnit && Object.keys(opts.eurPerUnit).length ? opts.eurPerUnit : null;
  const fxMonths = fxTable ? Object.keys(fxTable).sort() : [];
  const fxUsed: Record<string, number> = {};
  const fxFallback = new Set<string>();
  let sourceTotal = 0;
  /** Taux du mois de vente ; sinon le dernier publié avant (ou le premier, à défaut). */
  const rateFor = (month: string | null): number => {
    if (!fxTable) return 1;
    if (month && fxTable[month]) return (fxUsed[month] = fxTable[month]);
    const key = month ? (fxMonths.filter((m) => m <= month).pop() ?? fxMonths[0]) : fxMonths[fxMonths.length - 1];
    if (month) {
      fxFallback.add(month);
      fxUsed[month] = fxTable[key];
    }
    return fxTable[key];
  };
  const warnings: string[] = [];
  // Retire un éventuel BOM et normalise les fins de ligne.
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("EMPTY_FILE");
  }
  const delim = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delim);
  const { format, cols, currency } = detectFormat(headers);

  if (cols.earnings < 0 && cols.quantity < 0) {
    throw new Error("UNKNOWN_FORMAT");
  }
  if (cols.month < 0) warnings.push("NO_MONTH_COLUMN");

  const streamsByMonth: ParsedStatement["streamsByMonth"] = {};
  const revenueByMonth: ParsedStatement["revenueByMonth"] = {};
  const revenueByMonthDsp: ParsedStatement["revenueByMonthDsp"] = {};
  const trackStreams: Record<string, number> = {};
  const trackRevenue: Record<string, number> = {};
  const countryStreams: Record<string, number> = {};
  const countryRevenue: Record<string, number> = {};
  const artists = new Set<string>();
  const trackMonthStreams: ParsedStatement["trackMonthStreams"] = {};
  const trackMonthRevenue: ParsedStatement["trackMonthRevenue"] = {};
  const countryMonthStreams: ParsedStatement["countryMonthStreams"] = {};
  const countryMonthRevenue: ParsedStatement["countryMonthRevenue"] = {};
  const trackIsrc: Record<string, string> = {};
  const saleReportRevenue: Record<string, number> = {};
  const artistRevenue: Record<string, number> = {};
  let withheld = 0;
  // Le mois du relevé ne dit quelque chose que s'il vient d'une autre colonne que le mois de vente.
  const reportCol = cols.report >= 0 && cols.report !== cols.month ? cols.report : -1;
  const add = (o: Record<string, Record<string, number>>, k: string, m: string, v: number) => {
    const inner = (o[k] ??= {});
    inner[m] = (inner[m] ?? 0) + v;
  };
  let totalStreams = 0;
  let totalRevenue = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i], delim);
    if (row.length < 2) continue;

    const month =
      cols.month >= 0 ? normalizeMonth(row[cols.month] ?? "") : null;
    if (cols.month >= 0 && !month) {
      skipped++;
      continue;
    }
    const mk = month ?? "unknown";

    const qty = cols.quantity >= 0 ? Math.round(parseNumber(row[cols.quantity])) : 0;
    const rawEarn = cols.earnings >= 0 ? parseNumber(row[cols.earnings]) : 0;
    sourceTotal += rawEarn;
    const rate = rawEarn !== 0 || cols.withheld >= 0 ? rateFor(month) : 1;
    const earn = rawEarn * rate;
    const store = cols.store >= 0 ? (row[cols.store] ?? "") : "";
    const dsp = storeToDsp(store);

    if (qty > 0) {
      const bucket = (streamsByMonth[mk] ??= {});
      bucket[dsp] = (bucket[dsp] ?? 0) + qty;
      totalStreams += qty;
    }
    if (earn !== 0) {
      revenueByMonth[mk] = (revenueByMonth[mk] ?? 0) + earn;
      const byDsp = (revenueByMonthDsp[mk] ??= {});
      byDsp[dsp] = (byDsp[dsp] ?? 0) + earn;
      totalRevenue += earn;
    }
    if (cols.title >= 0 && row[cols.title]) {
      const title = row[cols.title];
      trackStreams[title] = (trackStreams[title] ?? 0) + qty;
      if (earn !== 0) trackRevenue[title] = (trackRevenue[title] ?? 0) + earn;
      if (month) {
        if (qty > 0) add(trackMonthStreams, title, month, qty);
        if (earn !== 0) add(trackMonthRevenue, title, month, earn);
      }
      const isrc = cols.isrc >= 0 ? (row[cols.isrc] ?? "").replace(/[-\s]/g, "").toUpperCase() : "";
      if (ISRC.test(isrc) && !trackIsrc[title]) trackIsrc[title] = isrc;
    }
    if (cols.country >= 0 && row[cols.country]) {
      const cc = row[cols.country].trim().toUpperCase().slice(0, 2);
      if (/^[A-Z]{2}$/.test(cc)) {
        countryStreams[cc] = (countryStreams[cc] ?? 0) + qty;
        if (earn !== 0) countryRevenue[cc] = (countryRevenue[cc] ?? 0) + earn;
        if (month) {
          if (qty > 0) add(countryMonthStreams, cc, month, qty);
          if (earn !== 0) add(countryMonthRevenue, cc, month, earn);
        }
      }
    }
    if (reportCol >= 0 && month && earn !== 0) {
      const report = normalizeMonth(row[reportCol] ?? "");
      if (report) saleReportRevenue[`${month}>${report}`] = (saleReportRevenue[`${month}>${report}`] ?? 0) + earn;
    }
    if (cols.withheld >= 0) withheld += parseNumber(row[cols.withheld] ?? "") * rate;
    if (cols.artist >= 0 && row[cols.artist]) {
      artists.add(row[cols.artist]);
      if (earn !== 0) artistRevenue[row[cols.artist]] = (artistRevenue[row[cols.artist]] ?? 0) + earn;
    }
  }

  if (skipped > 0) warnings.push(`SKIPPED_ROWS:${skipped}`);
  const months = Object.keys(revenueByMonth)
    .concat(Object.keys(streamsByMonth))
    .filter((m, i, a) => m !== "unknown" && a.indexOf(m) === i)
    .sort();

  if (months.length === 0) throw new Error("NO_DATA_ROWS");

  return {
    format,
    currency,
    streamsByMonth,
    revenueByMonth,
    revenueByMonthDsp,
    trackStreams,
    trackRevenue,
    countryStreams,
    countryRevenue,
    trackMonthStreams,
    trackMonthRevenue,
    countryMonthStreams,
    countryMonthRevenue,
    trackIsrc,
    saleReportRevenue: Object.fromEntries(Object.entries(saleReportRevenue).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    withheld: Math.round(withheld * 100) / 100,
    artistRevenue,
    ...(fxTable ? { fx: { used: fxUsed, fallback: [...fxFallback].sort(), sourceTotal: Math.round(sourceTotal * 100) / 100 } } : {}),
    totalStreams,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    months,
    artistNames: Array.from(artists),
    rowCount: lines.length - 1,
    warnings,
  };
}

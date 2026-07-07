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
  /** titre → streams cumulés */
  trackStreams: Record<string, number>;
  /** ISO2 pays → streams cumulés */
  countryStreams: Record<string, number>;
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
    month: findCol(h, [/sale month/, /sales period/, /période|periode/, /^month$/, /reporting/, /^date$/]),
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

export function parseStatement(text: string): ParsedStatement {
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
  const trackStreams: Record<string, number> = {};
  const countryStreams: Record<string, number> = {};
  const artists = new Set<string>();
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
    const earn = cols.earnings >= 0 ? parseNumber(row[cols.earnings]) : 0;
    const store = cols.store >= 0 ? (row[cols.store] ?? "") : "";
    const dsp = storeToDsp(store);

    if (qty > 0) {
      const bucket = (streamsByMonth[mk] ??= {});
      bucket[dsp] = (bucket[dsp] ?? 0) + qty;
      totalStreams += qty;
    }
    if (earn !== 0) {
      revenueByMonth[mk] = (revenueByMonth[mk] ?? 0) + earn;
      totalRevenue += earn;
    }
    if (cols.title >= 0 && row[cols.title]) {
      trackStreams[row[cols.title]] = (trackStreams[row[cols.title]] ?? 0) + qty;
    }
    if (cols.country >= 0 && row[cols.country]) {
      const cc = row[cols.country].trim().toUpperCase().slice(0, 2);
      if (/^[A-Z]{2}$/.test(cc)) {
        countryStreams[cc] = (countryStreams[cc] ?? 0) + qty;
      }
    }
    if (cols.artist >= 0 && row[cols.artist]) artists.add(row[cols.artist]);
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
    trackStreams,
    countryStreams,
    totalStreams,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    months,
    artistNames: Array.from(artists),
    rowCount: lines.length - 1,
    warnings,
  };
}

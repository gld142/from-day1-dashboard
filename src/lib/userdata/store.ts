/**
 * Store des données réelles de l'utilisateur (import CSV distributeur).
 * Persisté en localStorage, consulté par la façade api.ts AVANT les
 * générateurs démo : toutes les pages affichent les vraies données
 * sans modification.
 */

import type { Artist, DSP, StreamPoint, RevenuePoint } from "@/lib/demo/types";
import type { ParsedStatement } from "./parse-csv";

export const USER_ARTIST_ID = "my-project";
const STORAGE_KEY = "day1-user-data";

export type UserData = {
  version: 1;
  artistName: string;
  importedAt: string;
  format: ParsedStatement["format"];
  /** Taux appliqué à l'import pour convertir en EUR. */
  eurRate: number;
  sourceCurrency: ParsedStatement["currency"];
  months: string[];
  /** mois → { dsp → streams } */
  streamsByMonth: Record<string, Partial<Record<DSP, number>>>;
  /** mois → revenu EUR */
  revenueByMonth: Record<string, number>;
  trackStreams: Record<string, number>;
  countryStreams: Record<string, number>; // ISO2
  totalStreams: number;
  totalRevenueEur: number;
  active: boolean;
};

/* Cache module — hydraté côté client, lu de façon synchrone par api.ts. */
let cache: UserData | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function subscribeUserData(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hydrateUserData(): UserData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as UserData) : null;
  } catch {
    cache = null;
  }
  hydrated = true;
  notify();
  return cache;
}

export function getUserData(): UserData | null {
  if (!hydrated && typeof window !== "undefined") hydrateUserData();
  return cache;
}

/** True si l'artistId correspond au profil utilisateur actif. */
export function isUserArtist(artistId: string): boolean {
  return artistId === USER_ARTIST_ID && !!getUserData()?.active;
}

export function saveUserData(data: UserData) {
  cache = data;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota — les données restent en mémoire pour la session */
  }
  notify();
}

export function clearUserData() {
  cache = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  notify();
}

export function buildUserData(
  parsed: ParsedStatement,
  opts: { artistName: string; eurRate: number },
): UserData {
  const rate = parsed.currency === "EUR" ? 1 : opts.eurRate;
  const revenueByMonth: Record<string, number> = {};
  for (const [m, v] of Object.entries(parsed.revenueByMonth)) {
    if (m !== "unknown") revenueByMonth[m] = Math.round(v * rate * 100) / 100;
  }
  return {
    version: 1,
    artistName: opts.artistName,
    importedAt: new Date().toISOString().slice(0, 10),
    format: parsed.format,
    eurRate: rate,
    sourceCurrency: parsed.currency,
    months: parsed.months,
    streamsByMonth: parsed.streamsByMonth,
    revenueByMonth,
    trackStreams: parsed.trackStreams,
    countryStreams: parsed.countryStreams,
    totalStreams: parsed.totalStreams,
    totalRevenueEur: Math.round(parsed.totalRevenue * rate),
    active: true,
  };
}

/* ─────────── Projections vers le modèle du dashboard ─────────── */

/** Fiche artiste dérivée des données importées. */
export function userArtist(): Artist | null {
  const d = getUserData();
  if (!d) return null;
  const last = d.months[d.months.length - 1];
  const lastStreams = Object.values(d.streamsByMonth[last] ?? {}).reduce(
    (s, v) => s + (v ?? 0),
    0,
  );
  // Croissance : moyenne des 3 derniers mois vs 3 précédents.
  const totals = d.months.map((m) =>
    Object.values(d.streamsByMonth[m] ?? {}).reduce((s, v) => s + (v ?? 0), 0),
  );
  const l3 = totals.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, totals.length));
  const p3raw = totals.slice(-6, -3);
  const p3 = p3raw.length ? p3raw.reduce((a, b) => a + b, 0) / p3raw.length : l3;
  const growth = p3 === 0 ? 0 : Math.max(-0.3, Math.min(0.5, (l3 - p3) / p3 / 3));
  const monthlyListeners = Math.round(lastStreams / 2.6) || 1000;
  const index = Math.max(
    5,
    Math.min(95, Math.round(22 + Math.log10(Math.max(10, monthlyListeners)) * 9 + growth * 60)),
  );
  return {
    id: USER_ARTIST_ID,
    name: d.artistName,
    genre: "—",
    hue: 45, // or du lever de soleil : l'identité "mes données"
    initials: d.artistName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MP",
    monthlyListeners,
    growthRate: growth,
    careerStage:
      monthlyListeners > 3_000_000
        ? "established"
        : monthlyListeners > 500_000
          ? "developing"
          : "emerging",
    day1Index: index,
    signedSince: d.months[0] ? `${d.months[0]}-01` : "2024-01-01",
    dealType: "indé",
    country: "FR",
  };
}

/** Série quotidienne par DSP : le total mensuel réel réparti sur les jours. */
export function userStreamSeries(days: number, today: Date): StreamPoint[] {
  const d = getUserData();
  if (!d) return [];
  const out: StreamPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const mk = iso.slice(0, 7);
    const bucket = d.streamsByMonth[mk];
    if (!bucket) continue;
    const daysInMonth = new Date(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      0,
    ).getDate();
    // Ondulation hebdo légère et déterministe pour un rendu naturel.
    const dow = date.getUTCDay();
    const weekly = dow === 5 || dow === 6 ? 1.12 : dow === 0 ? 1.05 : 0.965;
    for (const [dsp, total] of Object.entries(bucket)) {
      out.push({
        date: iso,
        dsp: dsp as DSP,
        streams: Math.round(((total ?? 0) / daysInMonth) * weekly),
      });
    }
  }
  return out;
}

/** Revenus mensuels réels (source unique : streaming/distribution). */
export function userRevenueSeries(months: number, today: Date): RevenuePoint[] {
  const d = getUserData();
  if (!d) return [];
  const out: RevenuePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(today);
    m.setUTCMonth(m.getUTCMonth() - i);
    const mk = m.toISOString().slice(0, 7);
    const amount = d.revenueByMonth[mk];
    if (amount !== undefined) {
      out.push({ month: mk, source: "streaming", amount, artistId: USER_ARTIST_ID });
    }
  }
  return out;
}

export function userTopTracks(limit: number) {
  const d = getUserData();
  if (!d) return [];
  return Object.entries(d.trackStreams)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([title, streams], i) => ({ title, streams, rank: i + 1 }));
}

/** ISO2 → ISO3 pour la carte monde (pays courants des relevés). */
const ISO2_TO_3: Record<string, [string, string, string]> = {
  FR: ["FRA", "France", "France"],
  BE: ["BEL", "Belgique", "Belgium"],
  CH: ["CHE", "Suisse", "Switzerland"],
  CA: ["CAN", "Canada", "Canada"],
  US: ["USA", "États-Unis", "United States"],
  DE: ["DEU", "Allemagne", "Germany"],
  GB: ["GBR", "Royaume-Uni", "United Kingdom"],
  MA: ["MAR", "Maroc", "Morocco"],
  SN: ["SEN", "Sénégal", "Senegal"],
  CI: ["CIV", "Côte d'Ivoire", "Ivory Coast"],
  ES: ["ESP", "Espagne", "Spain"],
  IT: ["ITA", "Italie", "Italy"],
  NL: ["NLD", "Pays-Bas", "Netherlands"],
  BR: ["BRA", "Brésil", "Brazil"],
  JP: ["JPN", "Japon", "Japan"],
  MX: ["MEX", "Mexique", "Mexico"],
  PT: ["PRT", "Portugal", "Portugal"],
  DZ: ["DZA", "Algérie", "Algeria"],
  TN: ["TUN", "Tunisie", "Tunisia"],
  CM: ["CMR", "Cameroun", "Cameroon"],
  CD: ["COD", "RD Congo", "DR Congo"],
  HT: ["HTI", "Haïti", "Haiti"],
  RE: ["REU", "La Réunion", "Réunion"],
  GP: ["GLP", "Guadeloupe", "Guadeloupe"],
  MQ: ["MTQ", "Martinique", "Martinique"],
  AU: ["AUS", "Australie", "Australia"],
  SE: ["SWE", "Suède", "Sweden"],
  NO: ["NOR", "Norvège", "Norway"],
  PL: ["POL", "Pologne", "Poland"],
  TR: ["TUR", "Turquie", "Turkey"],
};

export function userCountryBreakdown() {
  const d = getUserData();
  if (!d) return [];
  return Object.entries(d.countryStreams)
    .map(([iso2, streams]) => {
      const meta = ISO2_TO_3[iso2];
      return meta
        ? { iso3: meta[0], nameFr: meta[1], nameEn: meta[2], streams }
        : { iso3: iso2, nameFr: iso2, nameEn: iso2, streams };
    })
    .sort((a, b) => b.streams - a.streams);
}

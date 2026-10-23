/**
 * Relevé virtuel d'une structure : les derniers relevés de ses artistes,
 * additionnés en un seul `UserData` que les pages Revenus / Streams affichent
 * tel quel (vue label, `?perimetre=label`).
 *
 * Règles (spec du 22/10/2026) :
 *  - mois = union ; sommes partout où le champ existe chez tous ;
 *  - titres renommés « Titre · Artiste » (deux « Intro » restent distincts) ;
 *  - un détail optionnel absent chez UN artiste est omis, et l'artiste nommé
 *    dans `missingDetail` — on n'affiche pas un « total » qui n'en est pas un ;
 *  - tout est déjà en euros à l'import : devise EUR, taux 1, pas de `fx`.
 */
import type { UserData } from "./store";

export type MergeEntry = { id: string; name: string; data: UserData };
export type MissingDetail = "platforms" | "titles" | "countries" | "detail";
export type LabelStatement = {
  /** Le relevé virtuel ; null sans aucun relevé. */
  data: UserData | null;
  artists: number;
  withStatement: number;
  /** mois → nombre d'artistes dont le relevé couvre ce mois */
  coverage: Record<string, number>;
  /** Période couverte par chaque relevé (pour expliquer les mois partiels). */
  spans: { id: string; name: string; from: string; to: string }[];
  missingDetail: { id: string; name: string; what: MissingDetail[] }[];
};

const cents = (n: number) => Math.round(n * 100) / 100;

function addInto(target: Record<string, number>, source: Record<string, number | undefined> | undefined) {
  for (const [k, v] of Object.entries(source ?? {})) if (v !== undefined) target[k] = cents((target[k] ?? 0) + v);
}
function addNested(
  target: Record<string, Record<string, number>>,
  source: Record<string, Record<string, number | undefined>> | undefined,
  key: (k: string) => string = (k) => k,
) {
  for (const [k, inner] of Object.entries(source ?? {})) addInto((target[key(k)] ??= {}), inner);
}

const DETAIL_FIELDS: Record<MissingDetail, (keyof UserData)[]> = {
  platforms: ["revenueByMonthDsp"],
  titles: ["trackRevenue"],
  countries: ["countryRevenue"],
  detail: ["trackMonthStreams"],
};

export function mergeStatements(entries: MergeEntry[], opts: { artistName: string; artists: number }): LabelStatement {
  const coverage: Record<string, number> = {};
  const spans: LabelStatement["spans"] = [];
  for (const e of entries) {
    const months = [...e.data.months].sort();
    for (const m of months) coverage[m] = (coverage[m] ?? 0) + 1;
    if (months.length) spans.push({ id: e.id, name: e.name, from: months[0], to: months[months.length - 1] });
  }
  const missingDetail: LabelStatement["missingDetail"] = entries
    .map((e) => ({ id: e.id, name: e.name, what: (Object.keys(DETAIL_FIELDS) as MissingDetail[]).filter((w) => DETAIL_FIELDS[w].some((f) => e.data[f] === undefined)) }))
    .filter((m) => m.what.length > 0);
  if (!entries.length) return { data: null, artists: opts.artists, withStatement: 0, coverage, spans, missingDetail };

  const all = (what: MissingDetail) => !missingDetail.some((m) => m.what.includes(what));
  const titled = (e: MergeEntry) => (t: string) => `${t} · ${e.name}`;

  const streamsByMonth: Record<string, Record<string, number>> = {};
  const revenueByMonth: Record<string, number> = {};
  const trackStreams: Record<string, number> = {};
  const countryStreams: Record<string, number> = {};
  const revenueByMonthDsp: Record<string, Record<string, number>> = {};
  const trackRevenue: Record<string, number> = {};
  const countryRevenue: Record<string, number> = {};
  const trackMonthStreams: Record<string, Record<string, number>> = {};
  const trackMonthRevenue: Record<string, Record<string, number>> = {};
  const countryMonthStreams: Record<string, Record<string, number>> = {};
  const countryMonthRevenue: Record<string, Record<string, number>> = {};
  const trackIsrc: Record<string, string> = {};
  const saleReportRevenue: Record<string, number> = {};
  const trackSpotify12: Record<string, number> = {};
  let withheld: number | undefined;
  let importedAt = "";
  let totalStreams = 0;
  let totalRevenueEur = 0;

  for (const e of entries) {
    const d = e.data;
    const key = titled(e);
    addNested(streamsByMonth, d.streamsByMonth as Record<string, Record<string, number | undefined>>);
    addInto(revenueByMonth, d.revenueByMonth);
    addInto(trackStreams, Object.fromEntries(Object.entries(d.trackStreams).map(([t, v]) => [key(t), v])));
    addInto(countryStreams, d.countryStreams);
    if (all("platforms")) addNested(revenueByMonthDsp, d.revenueByMonthDsp as Record<string, Record<string, number | undefined>>);
    if (all("titles")) addInto(trackRevenue, Object.fromEntries(Object.entries(d.trackRevenue ?? {}).map(([t, v]) => [key(t), v])));
    if (all("countries")) addInto(countryRevenue, d.countryRevenue);
    if (all("detail")) {
      addNested(trackMonthStreams, d.trackMonthStreams, key);
      addNested(trackMonthRevenue, d.trackMonthRevenue, key);
      addNested(countryMonthStreams, d.countryMonthStreams);
      addNested(countryMonthRevenue, d.countryMonthRevenue);
      addInto(saleReportRevenue, d.saleReportRevenue);
    }
    // L'ISRC est une correspondance titre → code, pas une somme : un artiste sans ISRC ne fausse pas les autres,
    // donc indépendante du détail mois par mois.
    for (const [t, isrc] of Object.entries(d.trackIsrc ?? {})) trackIsrc[key(t)] = isrc;
    // Indépendant du détail mois par mois : gardé si la fenêtre est la même chez tous (voir sameWindow).
    for (const [t, v] of Object.entries(d.trackSpotify12 ?? {})) trackSpotify12[key(t)] = v;
    if (d.withheldEur !== undefined) withheld = cents((withheld ?? 0) + d.withheldEur);
    if (d.importedAt > importedAt) importedAt = d.importedAt;
    totalStreams += d.totalStreams;
    totalRevenueEur += d.totalRevenueEur;
  }

  const windows = entries.map((e) => JSON.stringify(e.data.spotifyWindow ?? null));
  const sameWindow = windows[0] !== "null" && windows.every((w) => w === windows[0]);

  const data: UserData = {
    version: 1,
    artistName: opts.artistName,
    importedAt,
    format: "generic",
    eurRate: 1,
    sourceCurrency: "EUR",
    months: Object.keys(coverage).sort(),
    streamsByMonth: streamsByMonth as UserData["streamsByMonth"],
    revenueByMonth,
    trackStreams,
    countryStreams,
    ...(all("platforms") ? { revenueByMonthDsp: revenueByMonthDsp as UserData["revenueByMonthDsp"] } : {}),
    ...(all("titles") ? { trackRevenue } : {}),
    ...(all("countries") ? { countryRevenue } : {}),
    ...(all("detail") ? { trackMonthStreams, trackMonthRevenue, countryMonthStreams, countryMonthRevenue, saleReportRevenue } : {}),
    ...(Object.keys(trackIsrc).length ? { trackIsrc } : {}),
    ...(sameWindow ? { trackSpotify12, spotifyWindow: entries[0].data.spotifyWindow } : {}),
    ...(withheld !== undefined ? { withheldEur: withheld } : {}),
    totalStreams,
    totalRevenueEur: cents(totalRevenueEur),
    active: true,
    scope: { kind: "label", artists: opts.artists, withStatement: entries.length, coverage },
  };
  return { data, artists: opts.artists, withStatement: entries.length, coverage, spans, missingDetail };
}

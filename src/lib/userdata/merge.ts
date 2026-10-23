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

function addInto(
  target: Record<string, number>,
  source: Record<string, number | undefined> | undefined,
  key: (k: string) => string = (k) => k,
) {
  for (const [k, v] of Object.entries(source ?? {})) if (v !== undefined) target[key(k)] = cents((target[key(k)] ?? 0) + v);
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
  // Ces cinq champs sont toujours écrits ensemble par l'import, mais le validateur les accepte un par un.
  detail: ["trackMonthStreams", "trackMonthRevenue", "countryMonthStreams", "countryMonthRevenue", "saleReportRevenue"],
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
  const has = { platforms: all("platforms"), titles: all("titles"), countries: all("countries"), detail: all("detail") };
  // Deux artistes peuvent porter le même nom (aucune contrainte d'unicité en base) : on suffixe par leur rang parmi les homonymes
  // (#1, #2, …), qui ne peut pas entrer en collision, contrairement à un préfixe d'id.
  const dupes = new Set(entries.map((e) => e.name).filter((n, i, a) => a.indexOf(n) !== i));
  const seen = new Map<string, number>();
  const rank = new Map<MergeEntry, number>();
  for (const e of entries) {
    const n = (seen.get(e.name) ?? 0) + 1;
    seen.set(e.name, n);
    rank.set(e, n);
  }
  const titled = (e: MergeEntry) => {
    const who = dupes.has(e.name) ? `${e.name} #${rank.get(e)}` : e.name;
    return (t: string) => `${t} · ${who}`;
  };

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

  for (const e of entries) {
    const d = e.data;
    const key = titled(e);
    addNested(streamsByMonth, d.streamsByMonth as Record<string, Record<string, number | undefined>>);
    addInto(revenueByMonth, d.revenueByMonth);
    addInto(trackStreams, d.trackStreams, key);
    addInto(countryStreams, d.countryStreams);
    if (has.platforms) addNested(revenueByMonthDsp, d.revenueByMonthDsp as Record<string, Record<string, number | undefined>>);
    if (has.titles) addInto(trackRevenue, d.trackRevenue, key);
    if (has.countries) addInto(countryRevenue, d.countryRevenue);
    if (has.detail) {
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
  }

  // Somme des mois fusionnés, pas des `totalRevenueEur` : l'import arrondit son propre total, on ne reprend pas cet écart
  // (le relevé virtuel doit rester cohérent avec ses `revenueByMonth`).
  const totalRevenueEur = cents(Object.values(revenueByMonth).reduce((s, v) => s + v, 0));
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
    ...(has.platforms ? { revenueByMonthDsp: revenueByMonthDsp as UserData["revenueByMonthDsp"] } : {}),
    ...(has.titles ? { trackRevenue } : {}),
    ...(has.countries ? { countryRevenue } : {}),
    ...(has.detail ? { trackMonthStreams, trackMonthRevenue, countryMonthStreams, countryMonthRevenue, saleReportRevenue } : {}),
    ...(Object.keys(trackIsrc).length ? { trackIsrc } : {}),
    ...(sameWindow ? { trackSpotify12, spotifyWindow: entries[0].data.spotifyWindow } : {}),
    ...(withheld !== undefined ? { withheldEur: withheld } : {}),
    totalStreams,
    totalRevenueEur,
    active: true,
    scope: { kind: "label", artists: opts.artists, withStatement: entries.length, coverage },
  };
  return { data, artists: opts.artists, withStatement: entries.length, coverage, spans, missingDetail };
}

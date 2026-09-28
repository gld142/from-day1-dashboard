/**
 * Classements Apple Music « les plus écoutés » (100 titres), 10 pays, relevés
 * chaque nuit depuis le flux officiel qu'Apple propose d'ajouter à son site
 * (performance-partners.apple.com/tools). Mesuré le 28/09/2026 : 100 titres
 * pour chacun des 10 pays, flux instable (réessais dans fetchWithRetry).
 *
 * Le flux ne dit pas la date du classement (`feed.updated` = heure de
 * génération de la réponse) : la date retenue est celle du passage, à Paris.
 */
import { fetchWithRetry } from "./fetch";
import { parisDate } from "./dates";
import type { Collector } from "./run";

export const APPLE_COUNTRIES = ["fr", "be", "ch", "ca", "ma", "ci", "sn", "us", "gb", "de"] as const;
export type AppleCountry = (typeof APPLE_COUNTRIES)[number];
export const APPLE_COUNTRY_LABEL: Record<AppleCountry, string> = {
  fr: "France",
  be: "Belgique",
  ch: "Suisse",
  ca: "Canada",
  ma: "Maroc",
  ci: "Côte d'Ivoire",
  sn: "Sénégal",
  us: "États-Unis",
  gb: "Royaume-Uni",
  de: "Allemagne",
};

export type ChartEntry = {
  source: "apple_music";
  chart: "most-played-songs";
  country: string;
  chart_date: string;
  position: number;
  item_id: string;
  title: string;
  artist_name: string;
  artist_ext_id: string | null;
  url: string | null;
  genres: string[];
  release_date: string | null;
};

/** Genre 34 = « Musique » / « Music » : présent sur tous les titres, il n'apprend rien. */
const GENERIC_GENRE = "34";
/**
 * Texte en forme Unicode composée (NFC). Mesuré sur le flux FR du 28/09 : « Fille à Papa »
 * arrive décomposé (a + accent combinant), « Mélo Décalé » composé — sans NFC, le même
 * titre saisi par un client ne serait jamais reconnu.
 */
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.normalize("NFC").trim().slice(0, max) : null);

export function parseAppleChart(json: unknown, country: string, chartDate: string): ChartEntry[] {
  const feed = (json as { feed?: { country?: unknown; results?: unknown } } | null)?.feed;
  if (!feed || !Array.isArray(feed.results)) throw new Error("Apple Music : format de réponse inattendu");
  if (feed.country !== country) throw new Error(`Apple Music : pays « ${String(feed.country)} » reçu au lieu de « ${country} »`);
  const rows: ChartEntry[] = [];
  feed.results.forEach((raw: Record<string, unknown>, i: number) => {
    const item_id = str(raw?.id, 40);
    const title = str(raw?.name, 400);
    const artist_name = str(raw?.artistName, 400);
    if (!item_id || !title || !artist_name) return; // ligne incomplète : sautée, sans décaler les suivantes
    const release = str(raw.releaseDate, 10);
    rows.push({
      source: "apple_music",
      chart: "most-played-songs",
      country,
      chart_date: chartDate,
      position: i + 1,
      item_id,
      title,
      artist_name,
      artist_ext_id: str(raw.artistId, 40),
      url: str(raw.url, 500),
      genres: (Array.isArray(raw.genres) ? raw.genres : [])
        .filter((g: { genreId?: unknown; name?: unknown }) => g && g.genreId !== GENERIC_GENRE && typeof g.name === "string")
        .map((g: { name: string }) => g.name),
      release_date: release && /^\d{4}-\d{2}-\d{2}$/.test(release) ? release : null,
    });
  });
  return rows;
}

export const appleChartUrl = (country: string) => `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/songs.json`;

export function appleMusicCollector(deps: {
  fetchJson?: (country: AppleCountry) => Promise<unknown>;
  save: (country: AppleCountry, chartDate: string, rows: ChartEntry[]) => Promise<void>;
  now?: () => Date;
}): Collector {
  const fetchJson = deps.fetchJson ?? (async (country: AppleCountry) => (await fetchWithRetry(appleChartUrl(country))).json());
  return {
    source: "apple_music",
    run: async () => {
      const chartDate = parisDate((deps.now ?? (() => new Date()))());
      // Les pays en parallèle : un pays lent ne fait pas attendre les autres.
      const results: PromiseSettledResult<number>[] = await Promise.allSettled(
        APPLE_COUNTRIES.map(async (country) => {
          const rows = parseAppleChart(await fetchJson(country), country, chartDate);
          await deps.save(country, chartDate, rows);
          return rows.length;
        }),
      );
      // Seconde chance, une fois les autres pays finis : mesuré le 28/09, la Suisse a expiré
      // 4 fois de suite pendant que les 9 autres pays répondaient.
      for (let i = 0; i < results.length; i++) {
        if (results[i].status !== "rejected") continue;
        const country = APPLE_COUNTRIES[i];
        try {
          const rows = parseAppleChart(await fetchJson(country), country, chartDate);
          await deps.save(country, chartDate, rows);
          results[i] = { status: "fulfilled", value: rows.length };
        } catch (e) {
          results[i] = { status: "rejected", reason: e };
        }
      }
      const failed = results.flatMap((r, i) => (r.status === "rejected" ? [`${APPLE_COUNTRIES[i]} : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`] : []));
      const rows = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0);
      if (failed.length === APPLE_COUNTRIES.length) throw new Error(`Apple Music : aucun pays relevé — ${failed.join(" ; ")}`);
      return failed.length ? { rows, partial: true, detail: failed.join(" ; ") } : { rows };
    },
  };
}

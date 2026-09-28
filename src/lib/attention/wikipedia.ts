/**
 * Attention Wikipédia : vues quotidiennes de la page d'un artiste (API Pageviews de
 * Wikimedia — données CC0, gratuites, sans clé ; User-Agent descriptif OBLIGATOIRE,
 * mesuré : 403 sans). La page est trouvée par Wikidata (CC0) : on garde un candidat
 * seulement si c'est une personne avec un métier musical, ou un groupe — mesuré le
 * 28/09 : « Tiakola » renvoie aussi un village indien. Le client peut corriger.
 *
 * Indicateur d'ATTENTION, hors Day 1 Index : son pouvoir prédictif pour la musique
 * n'est pas démontré (recherche du 29/09 : prouvé pour le cinéma seulement).
 */
import { COLLECT_UA } from "@/lib/collect/fetch";

export type WikiRef = { project: "fr.wikipedia" | "en.wikipedia"; article: string };
export type DayViews = { day: string; views: number };

const WIKI_URL = /^(?:https?:\/\/)?(fr|en)(?:\.m)?\.wikipedia\.org\/wiki\/([^?#]+)/i;

export function parseWikipediaUrl(input: string): WikiRef | null {
  const m = WIKI_URL.exec(input.trim());
  if (!m) return null;
  let article: string;
  try {
    article = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  article = article.replace(/ /g, "_").normalize("NFC");
  if (!article || article.length > 250) return null;
  return { project: `${m[1].toLowerCase()}.wikipedia` as WikiRef["project"], article };
}

/** Métiers musicaux (Wikidata P106) et natures de groupe (P31) acceptés. */
const MUSIC_JOBS = new Set(["Q639669", "Q177220", "Q2252262", "Q753110", "Q36834", "Q183945", "Q130857", "Q488205", "Q855091", "Q2643890", "Q806349", "Q1259917", "Q12800682"]);
const GROUPS = new Set(["Q215380", "Q5741069", "Q2088357", "Q9212979", "Q281643"]);
const HUMAN = "Q5";

type Claims = Record<string, { mainsnak: { datavalue?: { value?: { id?: string } } | null } }[]>;
type Entity = { claims?: Claims; sitelinks?: Record<string, { title: string }> };
const ids = (e: Entity, p: string) => (e.claims?.[p] ?? []).map((c) => c.mainsnak.datavalue?.value?.id).filter(Boolean) as string[];

/** Premier résultat de recherche Wikidata qui est un musicien ou un groupe, avec son article (fr d'abord). */
export function pickMusician(searchJson: unknown, entitiesJson: unknown): ({ qid: string } & WikiRef) | null {
  const results = ((searchJson as { search?: { id: string }[] })?.search ?? []).map((r) => r.id);
  const entities = ((entitiesJson as { entities?: Record<string, Entity> })?.entities ?? {}) as Record<string, Entity>;
  for (const qid of results) {
    const e = entities[qid];
    if (!e) continue;
    const natures = ids(e, "P31");
    const musical = (natures.includes(HUMAN) && ids(e, "P106").some((j) => MUSIC_JOBS.has(j))) || natures.some((n) => GROUPS.has(n));
    if (!musical) continue;
    const fr = e.sitelinks?.frwiki?.title;
    const en = e.sitelinks?.enwiki?.title;
    if (fr) return { qid, project: "fr.wikipedia", article: fr.replace(/ /g, "_") };
    if (en) return { qid, project: "en.wikipedia", article: en.replace(/ /g, "_") };
  }
  return null;
}

export function parsePageviews(json: unknown): DayViews[] {
  const items = (json as { items?: { timestamp?: string; views?: number }[] })?.items;
  if (!Array.isArray(items)) throw new Error("Wikimedia : format de réponse inattendu");
  return items
    .filter((i) => typeof i.timestamp === "string" && Number.isFinite(i.views))
    .map((i) => ({ day: `${i.timestamp!.slice(0, 4)}-${i.timestamp!.slice(4, 6)}-${i.timestamp!.slice(6, 8)}`, views: i.views as number }));
}

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Vues des 30 jours jusqu'à la veille, les 30 d'avant, leur rapport, et le jour de pic sur ces 30 jours. */
export function attention(series: DayViews[], today: string) {
  if (!series.length) return null;
  const end = addDays(today, -1);
  const start = addDays(end, -29);
  const prevStart = addDays(start, -30);
  const sum = (from: string, to: string) => series.filter((s) => s.day >= from && s.day <= to).reduce((t, s) => t + s.views, 0);
  const recent = series.filter((s) => s.day >= start && s.day <= end);
  const last30 = sum(start, end);
  const prev30 = sum(prevStart, addDays(start, -1));
  const peak = recent.reduce<DayViews | null>((p, s) => (!p || s.views > p.views ? s : p), null);
  return { last30, prev30, change: prev30 ? last30 / prev30 : null, peak, from: start, to: end };
}

export const pageviewsUrl = (ref: WikiRef, from: string, to: string) =>
  `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${ref.project}/all-access/user/${encodeURIComponent(ref.article)}/daily/${from.replace(/-/g, "")}/${to.replace(/-/g, "")}`;
export const wikidataSearchUrl = (name: string) =>
  `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&uselang=fr&type=item&limit=7&format=json`;
export const wikidataEntitiesUrl = (qids: string[]) =>
  `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join("|")}&props=claims|sitelinks&sitefilter=frwiki|enwiki&format=json`;
export const WIKI_UA = COLLECT_UA;

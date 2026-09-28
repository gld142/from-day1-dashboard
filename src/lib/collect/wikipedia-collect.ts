/**
 * Collecte de nuit « wikipedia » : 1) trouve par Wikidata l'article des artistes (roster
 * et liste A&R) qui n'en ont pas encore ; 2) relève les vues quotidiennes de chaque
 * article lié, depuis le dernier jour connu (120 jours au premier passage) jusqu'à la
 * veille. Données CC0 ; User-Agent descriptif envoyé (obligatoire chez Wikimedia).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parisDate } from "./dates";
import { FetchError, fetchWithRetry } from "./fetch";
import type { Collector } from "./run";
import { pageviewsUrl, parsePageviews, pickMusician, wikidataEntitiesUrl, wikidataSearchUrl, type DayViews, type WikiRef } from "@/lib/attention/wikipedia";

type Subject = { kind: "artist" | "watch"; id: string; workspace_id: string; name: string };
type LinkRow = Omit<Subject, "name"> & { qid: string | null; project: string | null; article: string | null; method: "auto" | "none" };
export type WikiStore = {
  unresolved(): Promise<Subject[]>;
  saveLink(link: LinkRow): Promise<void>;
  articles(): Promise<WikiRef[]>;
  lastDay(ref: WikiRef): Promise<string | null>;
  saveViews(ref: WikiRef, series: DayViews[]): Promise<void>;
};

const HISTORY_DAYS = 120;
const RESOLVE_PER_NIGHT = 40;
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export function wikipediaCollector(store: WikiStore, deps: { fetchJson?: (url: string) => Promise<unknown>; now?: () => Date } = {}): Collector {
  const fetchJson = deps.fetchJson ?? (async (url: string) => (await fetchWithRetry(url, { tries: 3 })).json());
  return {
    source: "wikipedia",
    run: async () => {
      const failures: string[] = [];
      let found = 0;
      let none = 0;
      for (const s of (await store.unresolved()).slice(0, RESOLVE_PER_NIGHT)) {
        try {
          const search = (await fetchJson(wikidataSearchUrl(s.name))) as { search?: { id: string }[] };
          const qids = (search.search ?? []).map((r) => r.id).slice(0, 7);
          const pick = qids.length ? pickMusician(search, await fetchJson(wikidataEntitiesUrl(qids))) : null;
          await store.saveLink({ kind: s.kind, id: s.id, workspace_id: s.workspace_id, qid: pick?.qid ?? null, project: pick?.project ?? null, article: pick?.article ?? null, method: pick ? "auto" : "none" });
          if (pick) found++;
          else none++;
        } catch (e) {
          failures.push(`${s.name} : ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const yesterday = addDays(parisDate((deps.now ?? (() => new Date()))()), -1);
      let rows = 0;
      let articles = 0;
      for (const ref of await store.articles()) {
        const last = await store.lastDay(ref);
        const from = last ? addDays(last, 1) : addDays(yesterday, -(HISTORY_DAYS - 1));
        if (from > yesterday) continue;
        try {
          let series: DayViews[] = [];
          try {
            series = parsePageviews(await fetchJson(pageviewsUrl(ref, from, yesterday)));
          } catch (e) {
            if (!(e instanceof FetchError && e.status === 404)) throw e; // 404 = pas de vues sur la période
          }
          if (series.length) await store.saveViews(ref, series);
          rows += series.length;
          articles++;
        } catch (e) {
          failures.push(`${ref.project}/${ref.article} : ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const detail = `${articles} article(s) relevé(s) ; ${found} lien(s) trouvé(s), ${none} sans page`;
      if (failures.length && !articles && !found && !none) throw new Error(`Wikipédia : rien relevé — ${failures[0]}`);
      return failures.length ? { rows, partial: true, detail: `${detail} ; ${failures.length} échec(s) : ${failures[0]}` } : { rows, detail };
    },
  };
}

export function supabaseWikiStore(db: SupabaseClient): WikiStore {
  const must = <T,>(r: { data: T | null; error: { message: string } | null }) => {
    if (r.error) throw new Error(`Supabase : ${r.error.message}`);
    return r.data as T;
  };
  return {
    unresolved: async () => {
      const [artists, watches, links] = await Promise.all([
        db.from("artists").select("id, name, workspace_id"),
        db.from("ar_watchlist").select("id, artist_name, workspace_id"),
        db.from("wiki_links").select("artist_id, watch_id"),
      ]);
      const done = new Set(must<{ artist_id: string | null; watch_id: string | null }[]>(links).flatMap((l) => [l.artist_id, l.watch_id]).filter(Boolean));
      return [
        ...must<{ id: string; name: string; workspace_id: string }[]>(artists).filter((a) => !done.has(a.id)).map((a) => ({ kind: "artist" as const, id: a.id, workspace_id: a.workspace_id, name: a.name })),
        ...must<{ id: string; artist_name: string; workspace_id: string }[]>(watches).filter((w) => !done.has(w.id)).map((w) => ({ kind: "watch" as const, id: w.id, workspace_id: w.workspace_id, name: w.artist_name })),
      ];
    },
    saveLink: async (l) => {
      must(
        await db.from("wiki_links").insert({
          workspace_id: l.workspace_id,
          artist_id: l.kind === "artist" ? l.id : null,
          watch_id: l.kind === "watch" ? l.id : null,
          qid: l.qid,
          project: l.project,
          article: l.article,
          method: l.method,
        }),
      );
    },
    articles: async () => {
      const rows = must<{ project: WikiRef["project"]; article: string }[]>(await db.from("wiki_links").select("project, article").not("article", "is", null));
      return [...new Map(rows.map((r) => [`${r.project}|${r.article}`, r])).values()];
    },
    lastDay: async (ref) => {
      const rows = must<{ day: string }[]>(await db.from("wiki_pageviews").select("day").eq("project", ref.project).eq("article", ref.article).order("day", { ascending: false }).limit(1));
      return rows[0]?.day ?? null;
    },
    saveViews: async (ref, series) => {
      must(await db.from("wiki_pageviews").upsert(series.map((s) => ({ project: ref.project, article: ref.article, day: s.day, views: s.views })), { onConflict: "project,article,day" }));
    },
  };
}

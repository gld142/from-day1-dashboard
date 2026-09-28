import { describe, expect, it } from "vitest";
import search from "@/lib/attention/__tests__/fixtures/wikidata-search-tiakola.json";
import entities from "@/lib/attention/__tests__/fixtures/wikidata-entities-tiakola.json";
import pageviews from "@/lib/attention/__tests__/fixtures/pageviews-tiakola.json";
import { FetchError } from "../fetch";
import { wikipediaCollector, type WikiStore } from "../wikipedia-collect";

function memory(subjects: { kind: "artist" | "watch"; id: string; workspace_id: string; name: string }[], last: string | null = null) {
  const links: Record<string, unknown>[] = [];
  const views: { article: string; days: number }[] = [];
  const store: WikiStore = {
    unresolved: async () => subjects,
    saveLink: async (l) => {
      links.push(l);
    },
    articles: async () => links.filter((l) => l.article).map((l) => ({ project: l.project as "fr.wikipedia", article: l.article as string })),
    lastDay: async () => last,
    saveViews: async (ref, series) => {
      views.push({ article: ref.article, days: series.length });
    },
  };
  return { store, links, views };
}

describe("collecteur Wikipédia", () => {
  it("trouve l'article par Wikidata, puis relève les vues depuis 120 jours (premier passage)", async () => {
    const { store, links, views } = memory([{ kind: "artist", id: "a1", workspace_id: "w1", name: "Tiakola" }]);
    const asked: string[] = [];
    const r = await wikipediaCollector(store, {
      fetchJson: async (url) => {
        asked.push(url);
        if (url.includes("wbsearchentities")) return search;
        if (url.includes("wbgetentities")) return entities;
        return pageviews;
      },
      now: () => new Date("2026-09-28T04:00:00Z"),
    }).run();
    expect(links).toEqual([{ kind: "artist", id: "a1", workspace_id: "w1", qid: "Q110409381", project: "fr.wikipedia", article: "Tiakola", method: "auto" }]);
    expect(views).toEqual([{ article: "Tiakola", days: 8 }]);
    // De J−120 à la veille (27/09) : 31/05 → 27/09
    expect(asked.find((u) => u.includes("pageviews"))).toMatch(/\/Tiakola\/daily\/20260531\/20260927$/);
    expect(r).toEqual({ rows: 8, detail: "1 article(s) relevé(s) ; 1 lien(s) trouvé(s), 0 sans page" });
  });

  it("aucun musicien trouvé → lien « none » ; article sans vues (404) → rien, pas une erreur", async () => {
    const { store, links } = memory([{ kind: "watch", id: "x", workspace_id: "w1", name: "Nom inconnu" }]);
    const r = await wikipediaCollector(store, {
      fetchJson: async (url) => {
        if (url.includes("wbsearchentities")) return { search: [] };
        throw new FetchError("404", 404);
      },
    }).run();
    expect(links[0]).toMatchObject({ method: "none", article: null, project: null, qid: null });
    expect(r.rows).toBe(0);
  });

  it("déjà à jour jusqu'à la veille → aucun appel de vues", async () => {
    const { store } = memory([], "2026-09-27");
    let calls = 0;
    store.articles = async () => [{ project: "fr.wikipedia", article: "Tiakola" }];
    await wikipediaCollector(store, { fetchJson: async () => { calls++; return pageviews; }, now: () => new Date("2026-09-28T04:00:00Z") }).run();
    expect(calls).toBe(0);
  });
});

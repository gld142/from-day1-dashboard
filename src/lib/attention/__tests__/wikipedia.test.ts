import { describe, expect, it } from "vitest";
import search from "./fixtures/wikidata-search-tiakola.json";
import entities from "./fixtures/wikidata-entities-tiakola.json";
import pageviews from "./fixtures/pageviews-tiakola.json";
import { attention, parsePageviews, parseWikipediaUrl, pickMusician } from "../wikipedia";

describe("lien Wikipédia collé", () => {
  it("fr/en, titre décodé, ancre et paramètres retirés", () => {
    expect(parseWikipediaUrl("https://fr.wikipedia.org/wiki/Tiakola")).toEqual({ project: "fr.wikipedia", article: "Tiakola" });
    expect(parseWikipediaUrl("https://en.m.wikipedia.org/wiki/Aya_Nakamura#Career")).toEqual({ project: "en.wikipedia", article: "Aya_Nakamura" });
    expect(parseWikipediaUrl("fr.wikipedia.org/wiki/Ang%C3%A8le_(chanteuse)?oldid=1")).toEqual({ project: "fr.wikipedia", article: "Angèle_(chanteuse)" });
    expect(parseWikipediaUrl("https://de.wikipedia.org/wiki/X")).toBeNull();
    expect(parseWikipediaUrl("https://www.youtube.com/x")).toBeNull();
  });
});

describe("résolution par Wikidata — vraies réponses (« Tiakola », 28/09/2026)", () => {
  it("garde le rappeur (humain + métier musical), écarte le village indien homonyme", () => {
    expect(pickMusician(search, entities)).toEqual({ qid: "Q110409381", project: "fr.wikipedia", article: "Tiakola" });
  });
  it("aucun candidat musical → null", () => {
    const onlyVillage = { search: search.search.filter((s: { id: string }) => s.id === "Q60654897") };
    expect(pickMusician(onlyVillage, entities)).toBeNull();
  });
});

describe("vues Wikipédia — vraie réponse (fr, 20→27/09/2026)", () => {
  it("jour et vues", () => {
    const s = parsePageviews(pageviews);
    expect(s[0]).toEqual({ day: "2026-09-20", views: 292 });
    expect(s.find((x) => x.day === "2026-09-25")?.views).toBe(2205);
    expect(s).toHaveLength(8);
  });
  it("30 jours contre les 30 précédents, pic ; jours manquants = 0", () => {
    const series = [
      ...Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 6, 30 + i)).toISOString().slice(0, 10), views: 100 })),
      ...Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 7, 29 + i)).toISOString().slice(0, 10), views: i === 27 ? 2000 : 150 })),
    ];
    const a = attention(series, "2026-09-28")!;
    // Fenêtre : 29/08 → 27/09 (30 jours jusqu'à la veille) ; précédente : 30/07 → 28/08
    expect(a.last30).toBe(29 * 150 + 2000);
    expect(a.prev30).toBe(30 * 100);
    expect(a.change).toBeCloseTo((29 * 150 + 2000) / 3000);
    expect(a.peak).toEqual({ day: "2026-09-25", views: 2000 });
    expect(attention([], "2026-09-28")).toBeNull();
  });
});

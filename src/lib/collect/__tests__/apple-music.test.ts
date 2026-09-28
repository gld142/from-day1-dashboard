import { describe, expect, it } from "vitest";
import fr from "./fixtures/apple-fr-2026-09-28.json";
import { APPLE_COUNTRIES, appleMusicCollector, parseAppleChart, type ChartEntry } from "../apple-music";
import { parisDate } from "../dates";

describe("parisDate", () => {
  it("date du jour à Paris, pas en UTC", () => {
    expect(parisDate(new Date("2026-09-28T23:30:00Z"))).toBe("2026-09-29"); // 01:30 à Paris (été)
    expect(parisDate(new Date("2026-09-28T04:00:00Z"))).toBe("2026-09-28");
    expect(parisDate(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01"); // 00:30 à Paris (hiver)
  });
});

describe("parseAppleChart — vrai flux France du 28/09/2026 (3 premières lignes)", () => {
  it("garde l'ordre d'Apple comme position et lit chaque champ", () => {
    const rows = parseAppleChart(fr, "fr", "2026-09-28");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      source: "apple_music",
      chart: "most-played-songs",
      country: "fr",
      chart_date: "2026-09-28",
      position: 1,
      item_id: "6809781929",
      title: "Fille à Papa",
      artist_name: "Vacra & La Rvfleuze",
      artist_ext_id: "1029135290",
      url: "https://music.apple.com/fr/album/fille-a-papa/6809781922?i=6809781929",
      genres: ["Hip-hop/Rap"], // « Musique » (genre 34) est générique : écarté
      release_date: "2026-09-18",
    } satisfies ChartEntry);
    expect(rows.map((r) => [r.position, r.title])).toEqual([
      [1, "Fille à Papa"],
      [2, "La Nocturne"],
      [3, "Mélo Décalé"],
    ]);
  });

  it("refuse un flux d'un autre pays que celui demandé", () => {
    expect(() => parseAppleChart(fr, "be", "2026-09-28")).toThrow(/pays/);
  });

  it("refuse une réponse qui n'est pas un classement", () => {
    expect(() => parseAppleChart({ error: "x" }, "fr", "2026-09-28")).toThrow(/format/);
    expect(() => parseAppleChart("<html>502</html>", "fr", "2026-09-28")).toThrow(/format/);
  });

  it("une ligne incomplète est sautée sans décaler les positions suivantes", () => {
    const broken = structuredClone(fr);
    (broken.feed.results[1] as Record<string, unknown>).name = "";
    const rows = parseAppleChart(broken, "fr", "2026-09-28");
    expect(rows.map((r) => r.position)).toEqual([1, 3]);
  });
});

describe("collecteur Apple Music", () => {
  const feedFor = (country: string) => ({ ...fr, feed: { ...fr.feed, country } });

  it("les 10 pays mesurés le 28/09", () => {
    expect([...APPLE_COUNTRIES]).toEqual(["fr", "be", "ch", "ca", "ma", "ci", "sn", "us", "gb", "de"]);
  });

  it("un pays en panne → passage « partiel », les autres enregistrés", async () => {
    const saved: Record<string, number> = {};
    const collector = appleMusicCollector({
      fetchJson: async (country) => {
        if (country === "ma") throw new Error("échec après 4 essais (HTTP 502)");
        return feedFor(country);
      },
      save: async (country, _date, rows) => {
        saved[country] = rows.length;
      },
      now: () => new Date("2026-09-29T04:00:00Z"),
    });
    const r = await collector.run();
    expect(r).toEqual({ rows: 27, partial: true, detail: "ma : échec après 4 essais (HTTP 502)" });
    expect(Object.keys(saved).sort()).toEqual(["be", "ca", "ch", "ci", "de", "fr", "gb", "sn", "us"]);
  });

  it("un pays qui échoue puis répond à la seconde chance → passage complet", async () => {
    let chTries = 0;
    const collector = appleMusicCollector({
      fetchJson: async (country) => {
        if (country === "ch" && chTries++ === 0) throw new Error("délai dépassé");
        return feedFor(country);
      },
      save: async () => {},
      now: () => new Date("2026-09-29T04:00:00Z"),
    });
    expect(await collector.run()).toEqual({ rows: 30 });
    expect(chTries).toBe(2);
  });

  it("tous les pays en panne → erreur (pas un « ok » à 0 ligne)", async () => {
    const collector = appleMusicCollector({
      fetchJson: async () => {
        throw new Error("HTTP 504");
      },
      save: async () => {},
    });
    await expect(collector.run()).rejects.toThrow(/aucun pays/);
  });
});

import { describe, expect, it } from "vitest";
import { buildSpendTree } from "@/lib/demo/spend-tree";
import { expenses } from "@/lib/demo/api";
import type { Expense } from "@/lib/demo/types";

const exp = (over: Partial<Expense>): Expense => ({
  id: Math.random().toString(36).slice(2),
  artistId: "a",
  category: "marketing",
  label: "marketingMetaAds",
  amount: 100,
  date: "2026-05-01",
  addedBy: "omar",
  source: "manual",
  ...over,
});

describe("vue éclatée du budget : artiste → titre → dépense", () => {
  it("ne garde que la catégorie demandée", () => {
    const tree = buildSpendTree(
      [exp({ amount: 300 }), exp({ category: "studio", amount: 999 })],
      "marketing",
    );
    expect(tree.total).toBe(300);
    expect(tree.count).toBe(1);
  });

  it("sépare titre, projet sans titre et hors sortie", () => {
    const tree = buildSpendTree(
      [
        exp({ trackId: "t1", projectId: "p1", amount: 500 }),
        exp({ trackId: "t1", projectId: "p1", amount: 100, date: "2026-06-01" }),
        exp({ projectId: "p1", amount: 250 }),
        exp({ amount: 50 }),
      ],
      "marketing",
    );
    const titles = tree.artists[0].titles;
    expect(titles.map((n) => n.key)).toEqual(["track:t1", "project:p1", "none"]);
    expect(titles[0].amount).toBe(600);
    // la plus récente d'abord
    expect(titles[0].items.map((e) => e.date)).toEqual(["2026-06-01", "2026-05-01"]);
  });

  it("trie les artistes du plus coûteux au moins coûteux", () => {
    const tree = buildSpendTree(
      [exp({ artistId: "petit", amount: 10 }), exp({ artistId: "gros", amount: 90 })],
      "marketing",
    );
    expect(tree.artists.map((a) => a.artistId)).toEqual(["gros", "petit"]);
  });

  it("sur la démo, chaque euro du budget marketing se retrouve dans une ligne", () => {
    const all = expenses({ year: 2026 });
    const tree = buildSpendTree(all, "marketing");
    const attendu = all.filter((e) => e.category === "marketing").reduce((s, e) => s + e.amount, 0);
    expect(tree.total).toBe(attendu);
    const lignes = tree.artists.flatMap((a) => a.titles.flatMap((n) => n.items));
    expect(lignes.reduce((s, e) => s + e.amount, 0)).toBe(attendu);
    expect(tree.artists.reduce((s, a) => s + a.amount, 0)).toBe(attendu);
    expect(attendu).toBeGreaterThan(0);
  });
});

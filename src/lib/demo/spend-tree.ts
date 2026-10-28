import type { Expense, ExpenseCategory } from "./types";

/**
 * Vue éclatée d'un budget (le marketing, d'abord) : artiste → titre → dépense.
 *
 * Une dépense n'est pas toujours rattachée à un titre : le générateur (et la
 * saisie à la main) la rattache parfois à un projet seulement, parfois à rien.
 * On garde ces trois cas séparés plutôt que de les fondre — « 12 k € sur ce
 * titre » ne doit pas absorber ce qui a été dépensé pour l'album en général.
 */
export type SpendTitleKind = "track" | "project" | "none";

export type SpendTitleNode = {
  /** `track:<id>`, `project:<id>` ou `none` — stable, sert de clé d'ouverture. */
  key: string;
  kind: SpendTitleKind;
  trackId?: string;
  projectId?: string;
  amount: number;
  /** Dépenses du groupe, de la plus récente à la plus ancienne. */
  items: Expense[];
};

export type SpendArtistNode = {
  artistId: string;
  amount: number;
  count: number;
  /** Groupes du plus coûteux au moins coûteux. */
  titles: SpendTitleNode[];
};

export type SpendTree = {
  total: number;
  count: number;
  /** Artistes du plus coûteux au moins coûteux. */
  artists: SpendArtistNode[];
};

function titleKey(e: Expense): Pick<SpendTitleNode, "key" | "kind" | "trackId" | "projectId"> {
  if (e.trackId) return { key: `track:${e.trackId}`, kind: "track", trackId: e.trackId, projectId: e.projectId };
  if (e.projectId) return { key: `project:${e.projectId}`, kind: "project", projectId: e.projectId };
  return { key: "none", kind: "none" };
}

export function buildSpendTree(items: Expense[], category: ExpenseCategory): SpendTree {
  const byArtist = new Map<string, Map<string, SpendTitleNode>>();
  let total = 0;
  let count = 0;

  for (const e of items) {
    if (e.category !== category) continue;
    total += e.amount;
    count += 1;
    let titles = byArtist.get(e.artistId);
    if (!titles) byArtist.set(e.artistId, (titles = new Map()));
    const k = titleKey(e);
    let node = titles.get(k.key);
    if (!node) titles.set(k.key, (node = { ...k, amount: 0, items: [] }));
    node.amount += e.amount;
    node.items.push(e);
  }

  const artists: SpendArtistNode[] = Array.from(byArtist, ([artistId, titles]) => {
    const list = Array.from(titles.values())
      .map((n) => ({ ...n, items: [...n.items].sort((a, b) => b.date.localeCompare(a.date)) }))
      .sort((a, b) => b.amount - a.amount);
    return {
      artistId,
      amount: list.reduce((s, n) => s + n.amount, 0),
      count: list.reduce((s, n) => s + n.items.length, 0),
      titles: list,
    };
  }).sort((a, b) => b.amount - a.amount);

  return { total, count, artists };
}

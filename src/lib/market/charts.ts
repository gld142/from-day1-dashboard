/**
 * Lecture des classements Apple Music relevés chaque nuit (chart_entries) :
 * reconnaître les artistes d'une ligne, les mouvements d'un jour à l'autre, le
 * roster dans les classements, et les artistes qui montent (A&R). Tout est
 * dérivé de positions MESURÉES ; aucune extrapolation.
 */
export type ChartRow = {
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

export const normArtist = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const SEPARATORS = /\s*(?:&|,|\bfeat\.?(?=\s)|\bft\.?(?=\s)|\s+x\s+|\bavec\b|\bwith\b)\s*/i;

/** Les artistes crédités sur une ligne (« A & B feat. C » → a, b, c), normalisés. */
export const splitArtists = (artistName: string) => artistName.split(SEPARATORS).map(normArtist).filter(Boolean);

/** La ligne crédite-t-elle cet artiste ? Nom exact (normalisé), pas un morceau de nom. */
export function artistMatches(chartArtist: string, name: string): boolean {
  const n = normArtist(name);
  if (!n) return false;
  return normArtist(chartArtist) === n || splitArtists(chartArtist).includes(n);
}

export type Movement = { kind: "new" } | { kind: "up" | "down"; by: number } | { kind: "same" } | { kind: "unknown" };

/** Mouvement de chaque titre par rapport au classement précédent du même pays (vide = pas encore d'historique). */
export function chartMovements(today: ChartRow[], previous: ChartRow[]): Map<string, Movement> {
  const before = new Map(previous.map((r) => [r.item_id, r.position]));
  return new Map(
    today.map((r): [string, Movement] => {
      if (!previous.length) return [r.item_id, { kind: "unknown" }];
      const p = before.get(r.item_id);
      if (p === undefined) return [r.item_id, { kind: "new" }];
      if (p === r.position) return [r.item_id, { kind: "same" }];
      return [r.item_id, p > r.position ? { kind: "up", by: p - r.position } : { kind: "down", by: r.position - p }];
    }),
  );
}

export function rosterInCharts(rows: ChartRow[], roster: { id: string; name: string }[]) {
  return roster
    .map((a) => ({
      artistId: a.id,
      artistName: a.name,
      entries: rows.filter((r) => artistMatches(r.artist_name, a.name)).sort((x, y) => x.position - y.position || x.country.localeCompare(y.country)),
    }))
    .filter((a) => a.entries.length > 0);
}

export type Riser = { artist: string; title: string; country: string; position: number; kind: "new" | "up"; by: number | null; score: number; url: string | null };

/**
 * Entrées et montées d'un classement, hors roster, une ligne par artiste principal
 * (le premier crédité). Score = places gagnées ; une entrée vaut 101 − position.
 * Sans classement de la veille : rien (on ne devine pas une montée).
 */
export function risers(today: ChartRow[], previous: ChartRow[], exclude: string[], limit: number): Riser[] {
  if (!previous.length) return [];
  const moves = chartMovements(today, previous);
  const best = new Map<string, Riser>();
  for (const r of today) {
    const m = moves.get(r.item_id);
    if (!m || (m.kind !== "new" && m.kind !== "up")) continue;
    if (exclude.some((name) => artistMatches(r.artist_name, name))) continue;
    const main = r.artist_name.split(SEPARATORS)[0].trim();
    const score = m.kind === "new" ? 101 - r.position : m.by;
    const key = normArtist(main);
    if ((best.get(key)?.score ?? -1) >= score) continue;
    best.set(key, { artist: main, title: r.title, country: r.country, position: r.position, kind: m.kind, by: m.kind === "up" ? m.by : null, score, url: r.url });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.position - b.position).slice(0, limit);
}

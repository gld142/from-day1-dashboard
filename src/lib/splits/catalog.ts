/**
 * Catalogue d'un client : chaque titre présent dans les relevés importés, avec
 * ses streams, ses revenus et l'état de son split (saisi dans /splits).
 * Pas de date de sortie ni de durée : un relevé distributeur ne les donne pas.
 */
import { normTitle, type Split } from "./split";

type ArtistTitles = { titles: string[]; revenue: Record<string, number>; streams: Record<string, number>; hasRevenue: boolean };

export type CatalogRow = {
  artistId: string;
  artistName: string;
  title: string;
  streams: number;
  /** null : relevé importé avant le détail des revenus par titre. */
  revenue: number | null;
  per1000: number | null;
  /** Part du titre dans les revenus de SON artiste (0 → 1). */
  artistShare: number | null;
  split: "none" | "draft" | "agreed";
  isrc: string | null;
};

export function catalogRows({
  artists,
  titles,
  splits,
}: {
  artists: { id: string; name: string }[];
  titles: Record<string, ArtistTitles>;
  splits: Split[];
}): CatalogRow[] {
  const bySplit = new Map(splits.map((s) => [`${s.artist_id}:${normTitle(s.title)}`, s]));
  const rows = artists.flatMap((a) => {
    const t = titles[a.id];
    if (!t) return [];
    const artistRevenue = Object.values(t.revenue).reduce((s, v) => s + v, 0);
    return t.titles.map((title): CatalogRow => {
      const key = normTitle(title);
      const streams = t.streams[key] ?? 0;
      const revenue = t.hasRevenue ? (t.revenue[key] ?? 0) : null;
      const s = bySplit.get(`${a.id}:${key}`);
      return {
        artistId: a.id,
        artistName: a.name,
        title,
        streams,
        revenue,
        per1000: revenue !== null && streams > 0 ? (revenue / streams) * 1000 : null,
        artistShare: revenue !== null && artistRevenue > 0 ? revenue / artistRevenue : null,
        split: s ? s.status : "none",
        isrc: s?.isrc ?? null,
      };
    });
  });
  return rows.sort((x, y) => (y.revenue ?? -1) - (x.revenue ?? -1) || y.streams - x.streams);
}

/**
 * Partagé par les modules de la page Marché : ordre et teintes des groupes
 * (une seule rampe à partir du jeton de marque — pas d'arc-en-ciel), formats.
 */
import type { MarketGroup } from "@/lib/real";

/** Ordre de lecture : majors, grands indés, puis les deux résidus. */
export const GROUP_ORDER: readonly MarketGroup[] = [
  "universal",
  "sony",
  "warner",
  "believe",
  "because",
  "playtwo",
  "wagram",
  "idol",
  "kuroneko",
  "other",
  "unknown",
];

/**
 * Rampe monochrome : la marque à pleine force pour la première major, de plus
 * en plus mélangée à la carte ensuite ; les résidus (« Indé / autre », « Non
 * identifié ») en gris — ce ne sont pas des groupes.
 */
const BRAND_MIX: Partial<Record<MarketGroup, number>> = {
  universal: 100,
  sony: 78,
  warner: 58,
  believe: 44,
  because: 36,
  playtwo: 30,
  wagram: 25,
  idol: 21,
  kuroneko: 18,
};

export function groupColor(group: MarketGroup): string {
  if (group === "other") return "color-mix(in oklch, var(--muted-foreground) 45%, var(--card))";
  if (group === "unknown") return "color-mix(in oklch, var(--muted-foreground) 22%, var(--card))";
  return `color-mix(in oklch, var(--brand) ${BRAND_MIX[group] ?? 20}%, var(--card))`;
}

/** Part 0-1 → « 12,3 % » (jamais de signe). */
export function fmtShare(locale: string, share: number, digits = 1): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(share);
}

/** Points de pourcentage signés : « +1,2 » / « −0,4 » / « 0 ». */
export function fmtPoints(locale: string, points: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(points);
}

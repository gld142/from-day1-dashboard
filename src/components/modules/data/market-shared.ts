/**
 * Partagé par les modules de la page Marché : ordre et teintes des groupes
 * (une roue chromatique à luminosité égale, la maison à la couleur de la marque), formats.
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
 * Roue chromatique (Gaël, 29/10/2026 : « plus premium, des couleurs un peu plus visibles ») :
 * chaque groupe a sa teinte, prise sur le tour du cercle à luminosité et saturation égales
 * (OKLCH), donc distinctes sans qu'aucune ne crie. La maison (Universal) garde la couleur de la
 * marque ; les résidus (« Indé / autre », « Non identifié ») restent en gris : ce ne sont pas des
 * groupes.
 */
const GROUP_HUE: Partial<Record<MarketGroup, string>> = {
  sony: "oklch(0.63 0.13 250)",
  warner: "oklch(0.66 0.11 200)",
  believe: "oklch(0.68 0.12 158)",
  because: "oklch(0.74 0.12 100)",
  playtwo: "oklch(0.71 0.13 62)",
  wagram: "oklch(0.66 0.14 28)",
  idol: "oklch(0.64 0.13 352)",
  kuroneko: "oklch(0.58 0.11 318)",
};

export function groupColor(group: MarketGroup): string {
  if (group === "universal") return "var(--brand)";
  if (group === "other") return "color-mix(in oklch, var(--muted-foreground) 42%, var(--card))";
  if (group === "unknown") return "color-mix(in oklch, var(--muted-foreground) 20%, var(--card))";
  return GROUP_HUE[group] ?? "color-mix(in oklch, var(--muted-foreground) 30%, var(--card))";
}

/** Part 0-1 → « 12,3 % » (jamais de signe). */
export function fmtShare(locale: string, share: number, digits = 1): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(share);
}

/** Points de pourcentage signés : « +1,2 » / « −0,4 » / « 0 ». */
export function fmtPoints(locale: string, points: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(points);
}

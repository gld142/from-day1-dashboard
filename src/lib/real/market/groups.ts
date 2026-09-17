/**
 * Classification d'un titre par groupe (major ou grand indé) à partir des
 * mentions ℗ / © de sa page Spotify publique — la façon dont les parts de
 * marché sont comptées : c'est le distributeur qui « porte » le stream.
 *
 * Règles, dans l'ordre :
 *  1. Une ligne « Distribution Exclusive X » / « Licence exclusive X » /
 *     « Under exclusive license to X » / « Distributed by X » : X décide,
 *     même si une autre ligne cite un label du groupe (le ℗ d'un artiste
 *     auto-produit distribué par une major reste chez la major, et
 *     inversement un label indé cité en distribution exclusive l'emporte).
 *  2. Sinon, premier mot-clé rencontré, lignes ℗ d'abord (le master), © ensuite.
 *     Les segments d'édition (« publishing », « éditions ») sont ignorés :
 *     un éditeur n'est pas un distributeur.
 *  3. Des lignes sans aucun mot-clé → « other » (indé / autre), mesuré : on a
 *     bien lu le ℗, il ne cite aucun groupe.
 *  4. Aucune ligne (page non obtenue) → « unknown », estimé.
 *
 * Ce module n'importe rien d'exécutable : scripts/snapshot-market.mjs le
 * charge directement (Node ≥ 23, types effacés à la volée).
 */
import type { Provenance } from "../types";

export const MARKET_GROUPS = [
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
] as const;
export type MarketGroup = (typeof MARKET_GROUPS)[number];

export const MAJORS: readonly MarketGroup[] = ["universal", "sony", "warner"];
/** Grands indés distribués en propre — agrégés sous « Indés » dans les KPI. */
export const INDIES: readonly MarketGroup[] = ["believe", "because", "playtwo", "wagram", "idol", "kuroneko"];

export type LabelClassification = {
  group: MarketGroup;
  /** « measured » dès que des lignes ℗/© ont été lues ; « estimated » sans ligne. */
  provenance: Provenance;
  /** La ligne qui a décidé (null sans ligne). */
  evidence: string | null;
};

/**
 * Mots-clés par groupe : divisions et filiales, pas les labels indés qu'un
 * groupe distribue sous licence (ceux-là passent par la règle 1 quand la
 * ligne le dit). Comparaison insensible à la casse, sur mot entier.
 */
const KEYWORDS: ReadonlyArray<readonly [MarketGroup, readonly string[]]> = [
  [
    "universal",
    [
      "universal",
      "umg",
      "polydor",
      "capitol",
      "def jam",
      "island",
      "mercury",
      "barclay",
      "decca",
      "motown",
      "republic",
      "interscope",
      "virgin",
      "emi",
      "blue note",
      "verve",
      "deutsche grammophon",
      "6&7",
      "ingrooves",
      "a&m",
      // [PIAS] : groupe indé racheté à 100 % par Universal en 2025.
      "pias",
    ],
  ],
  ["sony", ["sony", "columbia", "epic", "rca", "arista", "jive", "ultra", "orchard", "awal", "laface"]],
  [
    "warner",
    ["warner", "atlantic", "parlophone", "elektra", "rec. 118", "rec 118", "erato", "wea", "ada france", "spinnin"],
  ],
  // AllPoints : services aux artistes de Believe (« AllPoints, a division of Believe »).
  ["believe", ["believe", "tunecore", "nuclear blast", "naive", "naïve", "allpoints", "all points"]],
  ["because", ["because"]],
  ["playtwo", ["play two", "playtwo"]],
  ["wagram", ["wagram"]],
  ["idol", ["idol"]],
  ["kuroneko", ["kuroneko"]],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Un mot-clé compilé : bornes « ni lettre ni chiffre » de part et d'autre (« emi » ne matche pas « Premier »). */
const COMPILED: ReadonlyArray<{ group: MarketGroup; keyword: string; re: RegExp }> = KEYWORDS.flatMap(
  ([group, words]) =>
    words.map((keyword) => ({
      group,
      keyword,
      re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(keyword)}(?![\\p{L}\\p{N}])`, "iu"),
    })),
);

/**
 * Formules de distribution / licence exclusive : ce qui suit désigne le
 * distributeur. Capture jusqu'à une virgule, un point-virgule, une barre ou
 * une parenthèse.
 */
const DISTRIBUTION_RES: readonly RegExp[] = [
  /distribution\s+exclusive\s*:?\s*(?:par\s+)?([^,;/(]+)/iu,
  /distribu[ée]e?s?\s+(?:exclusivement\s+)?par\s+([^,;/(]+)/iu,
  /(?:sous\s+)?licen[cs]e\s+exclusive\s*:?\s*(?:(?:à|a|to|de)\s+)?([^,;/(]+)/iu,
  /under\s+(?:exclusive\s+)?licen[cs]e\s+to\s+([^,;/(]+)/iu,
  /(?:exclusively\s+)?licen[cs]ed\s+(?:exclusively\s+)?(?:to|by)\s+([^,;/(]+)/iu,
  /exclusive\s+licen[cs]e\s+to\s+([^,;/(]+)/iu,
  /(?:under\s+)?exclusive\s+distribution\s+(?:to|by)\s+([^,;/(]+)/iu,
  /(?:exclusively\s+)?distributed\s+by\s+([^,;/(]+)/iu,
  /marketed\s+(?:and\s+distributed\s+)?by\s+([^,;/(]+)/iu,
];

/** Un segment d'édition (publishing / éditions) n'est pas un distributeur. */
const PUBLISHING_RE = /publishing|(?<!\p{L})[ée]ditions?(?!\p{L})/iu;

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/** Premier mot-clé de groupe dans un texte, ou null. */
export function groupFromText(text: string): { group: MarketGroup; keyword: string } | null {
  const t = normalize(text);
  for (const { group, keyword, re } of COMPILED) if (re.test(t)) return { group, keyword };
  return null;
}

/** Lignes ℗ d'abord (le master), © ensuite, ordre d'origine conservé sinon. */
function orderLines(lines: string[]): string[] {
  const norm = lines.map(normalize).filter((l) => l.length > 0);
  return [...norm.filter((l) => l.startsWith("℗")), ...norm.filter((l) => !l.startsWith("℗"))];
}

/** Distributeur explicite d'une ligne (formules de distribution / licence exclusive), ou null. */
export function distributorOf(line: string): string | null {
  const t = normalize(line);
  for (const re of DISTRIBUTION_RES) {
    const m = t.match(re);
    if (m?.[1]) {
      const tail = m[1].replace(/[\s.:-]+$/u, "").trim();
      if (tail.length > 0) return tail;
    }
  }
  return null;
}

/** Classification d'un titre à partir de ses lignes ℗ / © (voir l'en-tête du module). */
export function classifyLabel(lines: string[]): LabelClassification {
  const ordered = orderLines(lines);
  if (ordered.length === 0) return { group: "unknown", provenance: "estimated", evidence: null };

  // Règle 1 : le distributeur exclusif décide — connu ou non.
  for (const line of ordered) {
    const distributor = distributorOf(line);
    if (distributor === null) continue;
    const hit = groupFromText(distributor);
    return { group: hit ? hit.group : "other", provenance: "measured", evidence: line };
  }

  // Règle 2 : premier mot-clé, segments d'édition exclus.
  for (const line of ordered) {
    const segments = line.split(/[,;/]/).filter((s) => !PUBLISHING_RE.test(s));
    for (const seg of segments) {
      const hit = groupFromText(seg);
      if (hit) return { group: hit.group, provenance: "measured", evidence: line };
    }
  }

  // Règle 3 : des lignes lues, aucun groupe cité.
  return { group: "other", provenance: "measured", evidence: ordered[0] };
}

/**
 * Clés de répartition OFFICIELLES de la Sacem, lues le 05/10/2026 :
 *  - Statuts et Règlement général 2026, art. 9 et 57 à 61
 *    https://www.sacem.lu/media/031c15fe-b776-4002-a7e4-b10586e246e4/2026-statuts-sacem-fr-bd.pdf
 *  - Règles de répartition, avril 2025, annexe p. 46 (« Partage des droits »)
 *    https://www.sacem.lu/media/33bee4f4-de46-4202-97d0-4d64f8201150/regles-de-repartition-avril-2025-fr.pdf
 *
 * Trois droits, trois clés entre auteur, compositeur et éditeur :
 *  - DEP (exécution publique) : par tiers (art. 57) ;
 *  - DR (radio-mécanique) : 25 / 25 / 50, sauf clé phono plus avantageuse pour les créateurs ;
 *  - phono (reproduction mécanique) : selon le contrat d'édition.
 * Une œuvre sans éditeur : les créateurs touchent la part de l'éditeur (art. 58 et 61).
 *
 * Remplace l'ancienne hypothèse « l'auteur touche 50 % de l'édition », qui n'est que la clé DR.
 */
export const DEP_SPLIT = { author: 1 / 3, composer: 1 / 3, publisher: 1 / 3 } as const;
export const DR_SPLIT = { author: 0.25, composer: 0.25, publisher: 0.5 } as const;

export type Exploitation =
  | "tv"
  | "radio"
  | "physical"
  | "download"
  | "streaming_noninteractive"
  | "streaming_free"
  | "streaming_paid"
  | "vod"
  | "podcast"
  | "livestream"
  | "live"
  | "nightclub"
  | "background";

/** Part de chaque exploitation versée en DEP, DR et phono (Règles de répartition 2025, p. 46). */
export const EXPLOITATION_MIX: Record<Exploitation, { dep: number; dr: number; phono: number }> = {
  tv: { dep: 0.75, dr: 0.25, phono: 0 },
  radio: { dep: 0.67, dr: 0.33, phono: 0 },
  physical: { dep: 0, dr: 0, phono: 1 },
  download: { dep: 0.25, dr: 0, phono: 0.75 },
  streaming_noninteractive: { dep: 0.67, dr: 0, phono: 0.33 },
  streaming_free: { dep: 0.5, dr: 0, phono: 0.5 },
  streaming_paid: { dep: 0.5, dr: 0, phono: 0.5 },
  vod: { dep: 0.5, dr: 0, phono: 0.5 },
  podcast: { dep: 0.75, dr: 0, phono: 0.25 },
  livestream: { dep: 0.75, dr: 0, phono: 0.25 },
  live: { dep: 1, dr: 0, phono: 0 },
  nightclub: { dep: 0.8, dr: 0.2, phono: 0 },
  background: { dep: 0.695, dr: 0.305, phono: 0 },
};

export type Publishing = {
  /** L'œuvre a-t-elle un éditeur ? */
  published: boolean;
  /** Part du phono qui revient à l'éditeur selon le contrat d'édition (0 à 1) ; 50 % par défaut. */
  publisherPhonoShare?: number;
};

/** Hypothèse par défaut quand le contrat n'est pas connu : œuvre éditée, phono partagé 50 / 50. */
export const DEFAULT_PUBLISHING: Publishing = { published: true, publisherPhonoShare: 0.5 };

/**
 * Part des droits Sacem d'une œuvre qui revient aux CRÉATEURS (auteur + compositeur),
 * pour une exploitation donnée. Ex. streaming d'une œuvre éditée, phono 50/50 :
 * 50 % × 2/3 (DEP) + 50 % × 50 % (phono) = 58,3 %.
 */
export function creatorsShare(exploitation: Exploitation, p: Publishing = DEFAULT_PUBLISHING): number {
  if (!p.published) return 1;
  const m = EXPLOITATION_MIX[exploitation];
  const phonoCreators = 1 - Math.min(1, Math.max(0, p.publisherPhonoShare ?? 0.5));
  const drCreators = Math.max(DR_SPLIT.author + DR_SPLIT.composer, phonoCreators);
  return m.dep * (DEP_SPLIT.author + DEP_SPLIT.composer) + m.dr * drCreators + m.phono * phonoCreators;
}

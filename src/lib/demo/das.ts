/**
 * Les DA de démo, dans un module LÉGER : `role.tsx` (fournisseur racine, donc
 * /connexion et /inscription) valide le DA stocké contre cette liste. Mesuré le
 * 24/10/2026 sur le build Turbopack : l'importer depuis `data.ts` embarquait les
 * snapshots (chunk de 605 Ko avec « Nono La Grinta », « 2026-10-24 ») dans les
 * pages publiques. `data.ts` ré-exporte DAS et getDa : les autres appelants ne
 * changent pas.
 *
 * Prénoms FICTIFS (à remplacer par les vrais si Gaël les donne) ; chaque artiste
 * est rattaché au DA de sa catégorie (data.ts).
 */
import type { DA } from "./types";

export const DAS: DA[] = [
  { id: "da-urbain", name: "Inès M.", category: "urbain" },
  { id: "da-variete", name: "Julien R.", category: "variete" },
  { id: "da-compos", name: "Sofia K.", category: "compositeur" },
];

export function getDa(id: string): DA | null {
  return DAS.find((d) => d.id === id) ?? null;
}

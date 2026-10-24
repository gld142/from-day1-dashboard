/**
 * Le périmètre du roster : une catégorie, un DA, ou tout. Il vient de l'URL
 * (`?cat=`, `?da=` — partageable, et un rôle DA arrive déjà filtré) ou du rôle
 * (roles.ts). Les agrégats label d'api.ts acceptent la liste qu'il produit.
 */
import { ARTISTS, DAS } from "./data";
import { isArtistCategory, type Artist, type ArtistCategory } from "./types";

export type RosterScope = { category: ArtistCategory | null; daId: string | null };
export const FULL_SCOPE: RosterScope = { category: null, daId: null };

export function scopedArtists(scope: Partial<RosterScope> = {}, artists: Artist[] = ARTISTS): Artist[] {
  const { category = null, daId = null } = scope;
  // Une copie, jamais la référence : un `.sort()` sur le périmètre réordonnerait ARTISTS.
  if (!category && !daId) return [...artists];
  return artists.filter((a) => (!category || a.category === category) && (!daId || a.daId === daId));
}

/** `?cat=` et `?da=` : une valeur inconnue vaut « tout » — jamais une erreur, l'URL est partageable. */
export function parseScope(params: { get(name: string): string | null }): RosterScope {
  const cat = params.get("cat");
  const da = params.get("da");
  return {
    category: isArtistCategory(cat) ? cat : null,
    daId: da && DAS.some((d) => d.id === da) ? da : null,
  };
}

export function scopeQuery(scope: RosterScope): string {
  const p = new URLSearchParams();
  if (scope.category) p.set("cat", scope.category);
  if (scope.daId) p.set("da", scope.daId);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function isFullScope(scope: RosterScope): boolean {
  return !scope.category && !scope.daId;
}

/**
 * Périmètre effectif de /roster : le verrou du rôle (`scopeDaId`, le DA) prime sur l'URL —
 * un DA ne parcourt pas le roster des autres, et `?da=` ne peut pas élargir le sien. Sans
 * verrou (null), l'URL décide. Mesuré le 24/10/2026 : un DA qui cliquait « Roster » dans la
 * barre latérale arrivait sans `?da=` et voyait les 11 artistes quand Pulse en disait 6.
 */
export function effectiveScope(urlScope: RosterScope, lockedDaId: string | null): RosterScope {
  return lockedDaId ? { ...urlScope, daId: lockedDaId } : urlScope;
}

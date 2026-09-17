"use client";

/**
 * Skins Day 1 — deux signatures visuelles dérivées de la persona.
 *
 *  - "structure" (persona label) : précision, retenue — rayons 8 px, accent
 *    désaturé, aucune lueur, mouvements sobres (opacité, glissements de layout).
 *  - "artist" (persona artiste) : chaleur, souffle — rayons 14 px, accent plus
 *    chaud, halo doux, entrées décalées, aurora sur le héros.
 *
 * La skin est posée en `data-skin` sur le shell du dashboard (DashboardShell) ;
 * elle ne change QUE des tokens CSS (globals.css) et la signature de mouvement.
 * Les trois thèmes (nuit / aube / jour) restent indépendants.
 */
import { useRole, type Persona } from "@/lib/role";

export type Skin = "structure" | "artist";

export function skinFor(persona: Persona): Skin {
  return persona === "label" ? "structure" : "artist";
}

/** Skin courante, dérivée de la persona du RoleProvider. */
export function useSkin(): Skin {
  return skinFor(useRole().persona);
}

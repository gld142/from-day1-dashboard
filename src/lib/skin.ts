"use client";

/**
 * Skins Day 1 — deux signatures visuelles dérivées de la persona.
 *
 *  - "structure" (persona label) : précision, retenue — rayons 8 px, accent
 *    désaturé, aucune lueur, mouvements sobres (opacité, glissements de layout).
 *  - "artist" (persona artiste) : chaleur, souffle — rayons 14 px, accent plus
 *    chaud, halo doux, entrées décalées, salutation en fondu.
 *
 * La skin est posée en `data-skin` sur le shell du dashboard (DashboardShell) ;
 * elle ne change QUE des tokens CSS (globals.css) et la signature de mouvement.
 * Les trois thèmes (nuit / aube / jour) restent indépendants.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRole, type Persona } from "@/lib/role";

export type Skin = "structure" | "artist";

export function skinFor(persona: Persona): Skin {
  return persona === "label" ? "structure" : "artist";
}

/** Skin courante, dérivée de la persona du RoleProvider. */
export function useSkin(): Skin {
  return skinFor(useRole().persona);
}

/* ─── Entrées « une fois par navigation » ─────────────────────────────────
   Au premier chargement, le HTML serveur doit afficher le texte tel quel
   (LCP, pas de titre invisible pendant l'hydratation — mesurée à ~1 s sur
   Pulse). Les révélations cinétiques ne jouent donc qu'aux navigations
   client suivantes : ce drapeau de module passe à vrai après le premier
   montage côté navigateur (jamais côté serveur : les effets n'y tournent pas). */
let hydratedOnce = false;

/**
 * Vrai si le composant est monté lors d'une navigation client (l'app est déjà
 * hydratée) : les révélations d'entrée peuvent jouer. Faux au chargement
 * initial — le rendu serveur et le premier rendu client coïncident.
 */
export function useEntryReveal(): boolean {
  const [enabled] = useState(() => hydratedOnce);
  useEffect(() => {
    hydratedOnce = true;
  }, []);
  return enabled;
}

const noopSubscribe = () => () => {};

/**
 * Faux pendant le rendu serveur et l'hydratation, vrai ensuite : pour monter
 * ce qui n'a pas d'équivalent HTML (couche WebGL de /welcome) sans divergence
 * serveur / client.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

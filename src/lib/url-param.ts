/**
 * Un paramètre d'URL (`?cle=`) lu comme un état React, l'URL restant la seule
 * source de vérité : lien entrant, rechargement et retour arrière gardent la
 * valeur sans état dupliqué.
 *
 * Pourquoi pas `useSearchParams` : dans une page client prérendue, il force un
 * rendu côté client de tout l'arbre jusqu'au `Suspense` le plus proche (et fait
 * échouer le build sans frontière). Pourquoi pas `useState` + `useEffect` :
 * `setState` synchrone dans un effet est interdit par le lint React. D'où
 * `useSyncExternalStore` : côté serveur et pendant l'hydratation on rend
 * `fallback` (HTML identique), puis React relit l'URL et re-rend si elle diffère.
 */
import { useCallback, useSyncExternalStore } from "react";

/** Événement interne : `set` a réécrit l'URL sans navigation. */
const CHANGE_EVENT = "day1:url-param";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * `parse` valide la chaîne brute (null = absente ou invalide → `fallback`) ;
 * le passer stable (fonction de module) pour ne pas relire l'URL à chaque rendu.
 * L'écriture passe par `history.replaceState` : pas de navigation, pas
 * d'entrée d'historique par clic.
 */
export function useUrlParam<T extends string>(
  key: string,
  parse: (raw: string | null) => T | null,
  fallback: T,
): [T, (value: T) => void] {
  const read = useCallback(
    () => parse(new URLSearchParams(window.location.search).get(key)) ?? fallback,
    [key, parse, fallback],
  );
  const value = useSyncExternalStore(subscribe, read, () => fallback);

  const set = useCallback(
    (next: T) => {
      const url = new URL(window.location.href);
      url.searchParams.set(key, next);
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return [value, set];
}

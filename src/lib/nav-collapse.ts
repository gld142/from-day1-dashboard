"use client";

/**
 * Sections de navigation repliées — le choix de l'utilisateur, pas un défaut
 * imposé. Au premier lancement tout est déplié : un artiste seul qui n'a
 * besoin que de cinq pages peut replier le reste, un directeur artistique qui
 * les parcourt toutes ne voit aucune différence.
 *
 * Persisté en localStorage sous une clé à part (`day1-nav-collapsed`), et non
 * dans `day1-prefs` : la navigation se lit à chaque rendu de la coquille,
 * alors que le brief du jour ne se lit qu'une fois. Deux clés, deux caches,
 * pas de reparse croisé.
 *
 * Comme `prefs.tsx` et `role.tsx`, la source de vérité est le stockage et
 * React s'y abonne via `useSyncExternalStore`. Le snapshot est une CHAÎNE
 * (et non un Set) : React appelle `getSnapshot` plusieurs fois et compare les
 * résultats par identité — un objet reconstruit à chaque appel boucle.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "day1-nav-collapsed";

/** Rendu serveur et hydratation : rien n'est replié, donc HTML identique. */
const SERVER_SNAPSHOT = "[]";

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSnapshot: string = SERVER_SNAPSHOT;

function readSnapshot(): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      // On normalise : une valeur corrompue ne doit pas casser la navigation.
      let keys: string[] = [];
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) keys = parsed.filter((k) => typeof k === "string");
      }
      cachedSnapshot = JSON.stringify(keys);
    }
    return cachedSnapshot;
  } catch {
    /* stockage indisponible : tout reste déplié */
    return SERVER_SNAPSHOT;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(keys: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* noop : le pli reste valable pour la session en cours */
  }
  cachedRaw = undefined; // force la relecture au prochain snapshot
  for (const l of listeners) l();
}

/**
 * `collapsed` : les sections repliées. `toggle` : plier/déplier l'une d'elles.
 * Sortie de secours si l'on se perd : la palette ⌘K liste TOUTES les pages,
 * repliées comprises — elle ne lit pas cet état.
 */
export function useNavCollapse() {
  const snap = useSyncExternalStore(subscribe, readSnapshot, () => SERVER_SNAPSHOT);
  const collapsed = useMemo(() => new Set(JSON.parse(snap) as string[]), [snap]);

  const toggle = useCallback((key: string) => {
    const next = new Set(JSON.parse(readSnapshot()) as string[]);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    write([...next]);
  }, []);

  const expandAll = useCallback(() => write([]), []);

  return { collapsed, toggle, expandAll, hasCollapsed: collapsed.size > 0 };
}

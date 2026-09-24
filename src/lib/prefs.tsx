"use client";

/**
 * Préférences utilisateur légères : date de dernière ouverture du brief du jour.
 * (La visibilité des modules vit dans userdata/modules-store.ts.)
 * Persisté en localStorage (en prod : profil utilisateur côté serveur).
 *
 * La source de vérité est le stockage lui-même, et React s'y abonne. Lire
 * localStorage dans un effet puis appeler `setState` déclenche un second rendu
 * en cascade et empêche le compilateur React d'optimiser le fournisseur —
 * qui enveloppe tout le dashboard. `useSyncExternalStore` dit la même chose
 * sans effet, et suit les autres onglets en prime.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

type PrefsContextValue = {
  briefOpenedOn: string | null;
  markBriefOpened: (day: string) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

const STORAGE_KEY = "day1-prefs";

const listeners = new Set<() => void>();
/* On mémorise la chaîne brute pour ne pas reparser le JSON à chaque rendu. */
let cachedRaw: string | null | undefined;
let cachedValue: string | null = null;

function readBriefOpenedOn(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = raw
        ? ((JSON.parse(raw) as { briefOpenedOn?: string | null }).briefOpenedOn ?? null)
        : null;
    }
    return cachedValue;
  } catch {
    /* stockage indisponible : valeur par défaut */
    return null;
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

function writeBriefOpenedOn(day: string): void {
  try {
    // On ne réécrit que notre champ : l'ancien `hiddenModules` reste lisible
    // par modules-store tant qu'il n'a pas été repris.
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...prev, briefOpenedOn: day }),
    );
  } catch {
    /* noop */
  }
  cachedRaw = undefined; // force la relecture au prochain snapshot
  for (const l of listeners) l();
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const briefOpenedOn = useSyncExternalStore(
    subscribe,
    readBriefOpenedOn,
    () => null,
  );

  const markBriefOpened = useCallback((day: string) => {
    writeBriefOpenedOn(day);
  }, []);

  const value = useMemo(
    () => ({ briefOpenedOn, markBriefOpened }),
    [briefOpenedOn, markBriefOpened],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}

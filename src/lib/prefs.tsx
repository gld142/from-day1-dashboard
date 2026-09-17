"use client";

/**
 * Préférences utilisateur légères : date de dernière ouverture du brief du jour.
 * (La visibilité des modules vit dans userdata/modules-store.ts.)
 * Persisté en localStorage (en prod : profil utilisateur côté serveur).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type PrefsContextValue = {
  briefOpenedOn: string | null;
  markBriefOpened: (day: string) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

const STORAGE_KEY = "day1-prefs";

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [briefOpenedOn, setBriefOpenedOn] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { briefOpenedOn?: string | null };
        if (saved.briefOpenedOn) setBriefOpenedOn(saved.briefOpenedOn);
      }
    } catch {
      /* défauts */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // On ne réécrit que notre champ : l'ancien `hiddenModules` reste lisible
      // par modules-store tant qu'il n'a pas été repris.
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, briefOpenedOn }));
    } catch {
      /* noop */
    }
  }, [briefOpenedOn, hydrated]);

  const markBriefOpened = useCallback((day: string) => {
    setBriefOpenedOn(day);
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

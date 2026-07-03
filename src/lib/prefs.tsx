"use client";

/**
 * Préférences utilisateur : visibilité des modules dans la navigation.
 * L'utilisateur choisit ce qu'il veut voir ou pas voir sur SON compte.
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

/** Modules toujours visibles (cœur du produit, non masquables). */
export const CORE_MODULES = new Set(["/pulse", "/overview", "/settings"]);

type PrefsContextValue = {
  hiddenModules: string[];
  isHidden: (href: string) => boolean;
  toggleModule: (href: string) => void;
  briefOpenedOn: string | null;
  markBriefOpened: (day: string) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

const STORAGE_KEY = "day1-prefs";

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  const [briefOpenedOn, setBriefOpenedOn] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          hiddenModules?: string[];
          briefOpenedOn?: string | null;
        };
        if (Array.isArray(saved.hiddenModules)) {
          setHiddenModules(saved.hiddenModules.filter((h) => !CORE_MODULES.has(h)));
        }
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
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ hiddenModules, briefOpenedOn }),
      );
    } catch {
      /* noop */
    }
  }, [hiddenModules, briefOpenedOn, hydrated]);

  const isHidden = useCallback(
    (href: string) => hiddenModules.includes(href),
    [hiddenModules],
  );

  const toggleModule = useCallback((href: string) => {
    if (CORE_MODULES.has(href)) return;
    setHiddenModules((cur) =>
      cur.includes(href) ? cur.filter((h) => h !== href) : [...cur, href],
    );
  }, []);

  const markBriefOpened = useCallback((day: string) => {
    setBriefOpenedOn(day);
  }, []);

  const value = useMemo(
    () => ({ hiddenModules, isHidden, toggleModule, briefOpenedOn, markBriefOpened }),
    [hiddenModules, isHidden, toggleModule, briefOpenedOn, markBriefOpened],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}

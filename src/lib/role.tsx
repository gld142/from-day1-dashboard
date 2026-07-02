"use client";

/**
 * Système de rôles Day 1.
 *
 * Deux personas de démo :
 *  - "artist"  : l'artiste ne voit QUE ses propres données.
 *  - "label"   : la structure voit tout le roster, peut zoomer sur un artiste,
 *                et accède aux modules réservés (P&L, A&R, roster, dépenses).
 *
 * En production, ce contexte sera alimenté par la session (auth) et les
 * permissions granulaires ; l'API du hook ne changera pas.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Persona = "artist" | "label";

export const DEMO_ARTIST_ID = "sky-lune";

type RoleContextValue = {
  persona: Persona;
  /** Artiste actuellement "zoomé". En persona artiste : toujours lui-même. */
  artistId: string;
  /** En vue label : null = vue roster agrégée, sinon zoom artiste. */
  focusedArtistId: string | null;
  setPersona: (p: Persona) => void;
  setFocusedArtistId: (id: string | null) => void;
  /** True si l'utilisateur courant a le droit de voir les modules structure. */
  isLabel: boolean;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = "day1-role";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>("artist");
  const [focusedArtistId, setFocusedArtistId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          persona?: Persona;
          focusedArtistId?: string | null;
        };
        if (saved.persona === "artist" || saved.persona === "label") {
          setPersonaState(saved.persona);
        }
        if (saved.focusedArtistId !== undefined) {
          setFocusedArtistId(saved.focusedArtistId);
        }
      }
    } catch {
      /* stockage indisponible : on garde les valeurs par défaut */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ persona, focusedArtistId }),
      );
    } catch {
      /* noop */
    }
  }, [persona, focusedArtistId, hydrated]);

  const setPersona = useCallback((p: Persona) => {
    setPersonaState(p);
    // Changement de persona = on repart de la vue par défaut.
    setFocusedArtistId(null);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      persona,
      artistId:
        persona === "artist" ? DEMO_ARTIST_ID : (focusedArtistId ?? DEMO_ARTIST_ID),
      focusedArtistId: persona === "artist" ? DEMO_ARTIST_ID : focusedArtistId,
      setPersona,
      setFocusedArtistId,
      isLabel: persona === "label",
    }),
    [persona, focusedArtistId, setPersona],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

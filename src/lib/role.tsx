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
  useSyncExternalStore,
} from "react";
import {
  getUserData,
  subscribeUserData,
  USER_ARTIST_ID,
} from "@/lib/userdata/store";

export type Persona = "artist" | "label";

export const DEMO_ARTIST_ID = "dadju";

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
  /** True si des données réelles importées sont actives (mode "Mes données"). */
  hasUserData: boolean;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = "day1-role";

type RoleState = { persona: Persona; focusedArtistId: string | null };

/**
 * L'état de rôle vit dans localStorage, et React s'y abonne.
 *
 * Le lire dans un effet pour appeler `setState` ensuite déclenche un second
 * rendu en cascade et fait renoncer le compilateur React à optimiser ce
 * fournisseur — qui enveloppe TOUTE l'application. Le même fichier utilise
 * déjà `useSyncExternalStore` pour `hasUserData` : on suit ce motif.
 *
 * Piège de référence : le snapshot est un OBJET. S'il est reconstruit à chaque
 * appel, React boucle sans fin. On mémorise donc la chaîne brute et on ne
 * refabrique l'objet que lorsqu'elle change.
 */
const DEFAULT_ROLE: RoleState = { persona: "artist", focusedArtistId: null };

const roleListeners = new Set<() => void>();
let roleRaw: string | null | undefined;
let roleValue: RoleState = DEFAULT_ROLE;
/**
 * Canal d'acquisition (/welcome → CTA) : `?persona=` force le persona et prime
 * sur la valeur mémorisée. Il se consomme ICI, une fois, au chargement du
 * module — surtout PAS dans `readRole`.
 *
 * Mesuré : placé dans le snapshot, le paramètre était perdu. React appelle
 * `getSnapshot` plusieurs fois et compare les résultats pour détecter une
 * déchirure ; un snapshot qui consomme un drapeau renvoie « label » au premier
 * appel puis « artist » au second, et React retient le dernier. Le snapshot
 * doit être pur ; l'effet de bord vit hors du rendu.
 */
if (typeof window !== "undefined") {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("persona");
    if (fromUrl === "artist" || fromUrl === "label") {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ persona: fromUrl, focusedArtistId: null }),
      );
    }
  } catch {
    /* stockage indisponible : le paramètre est ignoré */
  }
}

function persistRole(next: RoleState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    roleRaw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : l'état reste en mémoire */
  }
}

/** Pur : deux appels d'affilée renvoient la même référence tant que le
 *  stockage n'a pas changé. C'est la condition de `useSyncExternalStore`. */
function readRole(): RoleState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== roleRaw) {
      roleRaw = raw;
      let next = DEFAULT_ROLE;
      if (raw) {
        const saved = JSON.parse(raw) as Partial<RoleState>;
        next = {
          persona:
            saved.persona === "artist" || saved.persona === "label"
              ? saved.persona
              : "artist",
          focusedArtistId: saved.focusedArtistId ?? null,
        };
      }
      roleValue = next;
    }
    return roleValue;
  } catch {
    /* stockage indisponible : on garde les valeurs par défaut */
    return roleValue;
  }
}

function subscribeRole(onChange: () => void): () => void {
  roleListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    roleListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeRole(next: RoleState): void {
  roleValue = next;
  persistRole(next);
  for (const l of roleListeners) l();
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribeRole, readRole, () => DEFAULT_ROLE);
  const { persona, focusedArtistId } = role;

  const setPersona = useCallback((p: Persona) => {
    // Changement de persona = on repart de la vue par défaut.
    writeRole({ persona: p, focusedArtistId: null });
  }, []);

  const setFocusedArtistId = useCallback((id: string | null) => {
    writeRole({ ...roleValue, focusedArtistId: id });
  }, []);

  // Données réelles importées : en persona artiste, le profil utilisateur
  // remplace l'artiste de démo dans TOUT le dashboard.
  const hasUserData = useSyncExternalStore(
    subscribeUserData,
    () => !!getUserData()?.active,
    () => false,
  );
  const artistSelfId = hasUserData ? USER_ARTIST_ID : DEMO_ARTIST_ID;

  const value = useMemo<RoleContextValue>(
    () => ({
      persona,
      artistId:
        persona === "artist" ? artistSelfId : (focusedArtistId ?? DEMO_ARTIST_ID),
      focusedArtistId: persona === "artist" ? artistSelfId : focusedArtistId,
      setPersona,
      setFocusedArtistId,
      isLabel: persona === "label",
      hasUserData,
    }),
    [persona, focusedArtistId, setPersona, artistSelfId, hasUserData],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

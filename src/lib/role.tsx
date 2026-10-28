"use client";

/**
 * Système de rôles Day 1.
 *
 * Deux personas de démo :
 *  - "artist"  : l'artiste ne voit QUE ses propres données.
 *  - "label"   : la structure voit tout le roster, peut zoomer sur un artiste,
 *                et accède aux modules réservés (P&L, A&R, roster, dépenses).
 *
 * Maison à rôles (Universal, `TENANT.roles`) : la persona est toujours « label »
 * et l'identité se choisit par métier (`jobRole`, roles.ts) ; le DA porte en
 * plus un périmètre (`daId` → `scopeDaId`) que les agrégats structure suivent.
 *
 * En production, ce contexte sera alimenté par la session (auth) et les
 * permissions granulaires ; l'API du hook ne changera pas.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  getUserData,
  subscribeUserData,
  USER_ARTIST_ID,
} from "@/lib/userdata/store";
import { getDa } from "@/lib/demo/das";
import { isOrgDa } from "@/lib/userdata/org-store";
import { isJobRole, roleScope, type JobRole } from "@/lib/roles";
import { TENANT } from "@/lib/tenant";

export type Persona = "artist" | "label";

/** L'artiste ouvert par défaut en persona artiste : celui de la maison (Dadju n'existe pas chez Universal). */
export const DEMO_ARTIST_ID = TENANT.defaultArtistId;

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
  /** Rôle métier (maison Universal) ; null = aucun rôle choisi, ou maison sans rôles. */
  jobRole: JobRole | null;
  /** Le DA incarné quand `jobRole === "da"`. */
  daId: string | null;
  /** Périmètre effectif : l'id du DA quand le rôle restreint, sinon null (tout le roster). */
  scopeDaId: string | null;
  /** Choisir un rôle passe en persona structure et repart de la vue roster ; null retire le rôle.
   *  « da » exige un DA connu, sinon le rôle retombe sur null (withDa). */
  setJobRole: (role: JobRole | null, daId?: string | null) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const noop = () => {};

/**
 * Mode client : l'identité est fixée — persona artiste, sur SON artiste (le relevé
 * importé, exposé sous USER_ARTIST_ID). Pas de bascule label, pas d'artistes de démo.
 */
export function CustomerRoleProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<RoleContextValue>(
    () => ({
      persona: "artist",
      artistId: USER_ARTIST_ID,
      focusedArtistId: USER_ARTIST_ID,
      setPersona: noop,
      setFocusedArtistId: noop,
      isLabel: false,
      hasUserData: true,
      jobRole: null,
      daId: null,
      scopeDaId: null,
      setJobRole: noop,
    }),
    [],
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

const STORAGE_KEY = "day1-role";

export type RoleState = {
  persona: Persona;
  focusedArtistId: string | null;
  /** Rôle métier (roles.ts) ; une valeur inconnue en stockage vaut « aucun rôle ». */
  jobRole: JobRole | null;
  daId: string | null;
};

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
const DEFAULT_ROLE: RoleState = { persona: "artist", focusedArtistId: null, jobRole: null, daId: null };

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
        JSON.stringify({ persona: fromUrl, focusedArtistId: null, jobRole: null, daId: null }),
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

/**
 * Pur, sans DOM : l'état de rôle depuis la chaîne stockée. Une persona ou un
 * rôle inconnus (ancien stockage, valeur bricolée), un JSON invalide, « null »
 * ou un tableau retombent sur la valeur par défaut — jamais une erreur
 * (mesuré le 24/10/2026 : `JSON.parse` levait sur « {bad » et sur « null »).
 * Le couple rôle/DA passe par `withDa` : un DA sans DA connu ne vaut aucun rôle.
 * La valeur par défaut est UNE référence (readRole en dépend). Exporté pour le
 * test unitaire.
 */
export function parseRoleState(raw: string | null): RoleState {
  if (!raw) return DEFAULT_ROLE;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return DEFAULT_ROLE;
  }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return DEFAULT_ROLE;
  const s = saved as Partial<Record<keyof RoleState, unknown>>;
  return {
    persona: s.persona === "artist" || s.persona === "label" ? s.persona : "artist",
    focusedArtistId: typeof s.focusedArtistId === "string" ? s.focusedArtistId : null,
    ...withDa(isJobRole(s.jobRole) ? s.jobRole : null, typeof s.daId === "string" ? s.daId : null),
  };
}

/**
 * Pur : le rôle et son DA, cohérents. Le rôle DA exige un DA CONNU (das.ts) : un
 * `daId` inconnu ou absent donnerait, avec le rôle DA, un périmètre vide (Pulse
 * diviserait 0 par 0) — ou, si on ne gardait que le rôle, TOUT le roster sous une
 * barre du haut qui dit « DA » (relecture du 24/10/2026). Un DA sans DA valide
 * retombe donc sur « aucun rôle ». Les autres rôles ne portent pas de DA. Point
 * unique pour la lecture du stockage (parseRoleState) et l'écriture (setJobRole).
 */
export function withDa(jobRole: JobRole | null, daId: string | null): Pick<RoleState, "jobRole" | "daId"> {
  /* Connu = un DA de das.ts, ou un DA ajouté dans Réglages → Organisation (org-store, module léger). */
  if (jobRole === "da") return daId && (getDa(daId) || isOrgDa(daId)) ? { jobRole: "da", daId } : { jobRole: null, daId: null };
  return { jobRole, daId: null };
}

/**
 * Pur : le rôle et son DA tels que le fournisseur les expose — seulement dans la
 * maison à rôles (`TENANT.roles`). Ailleurs, un rôle resté en stockage est inerte :
 * ni la navigation ni la barre du haut ne doivent le voir. Exporté pour le test
 * unitaire (le fournisseur lui-même ne se teste pas sans DOM).
 */
export function boundRole(
  state: Pick<RoleState, "jobRole" | "daId">,
  rolesEnabled: boolean,
): Pick<RoleState, "jobRole" | "daId"> {
  return rolesEnabled ? { jobRole: state.jobRole, daId: state.daId } : { jobRole: null, daId: null };
}

/** Pur : deux appels d'affilée renvoient la même référence tant que le
 *  stockage n'a pas changé. C'est la condition de `useSyncExternalStore`. */
function readRole(): RoleState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== roleRaw) {
      roleRaw = raw;
      roleValue = parseRoleState(raw);
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
  /* Maison à rôles : la persona reste « structure » — le sélecteur propose des métiers, pas des personas. */
  const persona: Persona = TENANT.roles ? "label" : role.persona;
  const { focusedArtistId } = role;
  /* Hors maison à rôles, un rôle resté en stockage n'existe pas (boundRole, testé). */
  const { jobRole, daId } = boundRole(role, TENANT.roles);

  const setPersona = useCallback((p: Persona) => {
    // Changement de persona = on repart de la vue par défaut, sans rôle.
    writeRole({ persona: p, focusedArtistId: null, jobRole: null, daId: null });
  }, []);

  const setFocusedArtistId = useCallback((id: string | null) => {
    writeRole({ ...roleValue, focusedArtistId: id });
  }, []);

  const setJobRole = useCallback((next: JobRole | null, nextDaId: string | null = null) => {
    /* `setJobRole("da", null)` écrit « aucun rôle » (withDa) : le DA se choisit avec son DA. */
    writeRole({ persona: "label", focusedArtistId: null, ...withDa(next, nextDaId) });
  }, []);

  /* Le périmètre du rôle (jobRole et daId sont déjà nuls hors maison à rôles). */
  const scopeDaId = roleScope(jobRole, daId).daId;

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
      jobRole,
      daId,
      scopeDaId,
      setJobRole,
    }),
    [persona, focusedArtistId, setPersona, setFocusedArtistId, artistSelfId, hasUserData, jobRole, daId, scopeDaId, setJobRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

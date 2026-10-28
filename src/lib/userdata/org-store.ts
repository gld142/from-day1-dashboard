/**
 * Store local de l'organisation de la maison (démo) — pôles, personnes, attributions des
 * artistes. Modèle pur : `src/lib/demo/org.ts`.
 *
 * Persisté en localStorage sous `day1-org`, avec un cache module et `subscribe/snapshot` pour
 * `useSyncExternalStore` — même patron que modules-store / shares-store : hydratation explicite
 * (`hydrateOrg()`, depuis un effet, cf. use-org.ts) pour que le rendu d'hydratation produise le
 * même HTML que le serveur (organisation par défaut), les écarts arrivant juste après.
 *
 * LÉGER : `role.tsx` (fournisseur racine) l'importe pour reconnaître un DA ajouté ; il ne doit
 * donc jamais importer `@/lib/demo/data` (relevés, ~600 Ko dans /connexion — AGENTS.md).
 */
import {
  DEFAULT_ORG,
  addPerson,
  addPole,
  assignArtist,
  hasDa,
  parseOrgState,
  renamePerson,
  type AssignmentField,
  type OrgKind,
  type OrgState,
} from "@/lib/demo/org";
import type { Artist } from "@/lib/demo/types";

export const ORG_STORAGE_KEY = "day1-org";

/* Cache module — hydraté côté client par `hydrateOrg()`, lu de façon synchrone. */
let cache: OrgState = DEFAULT_ORG;
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/**
 * Relit localStorage une fois (idempotent) et prévient les abonnés si l'organisation stockée
 * s'écarte du défaut. Sans window (serveur) : no-op. Un stockage corrompu vaut le défaut.
 */
export function hydrateOrg(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let next: OrgState;
  try {
    next = parseOrgState(window.localStorage.getItem(ORG_STORAGE_KEY));
  } catch {
    next = DEFAULT_ORG;
  }
  if (next === cache) return;
  cache = next;
  notify();
}

function write(next: OrgState) {
  if (next === cache) return;
  cache = next;
  try {
    if (next === DEFAULT_ORG) window.localStorage.removeItem(ORG_STORAGE_KEY);
    else window.localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota ou stockage indisponible — l'organisation reste en mémoire pour la session */
  }
  notify();
}

/** L'organisation courante (référence stable entre deux écritures ; défaut côté serveur). */
export function getOrg(): OrgState {
  return cache;
}

export function renameOrgPerson(id: string, name: string): void {
  hydrateOrg();
  write(renamePerson(cache, id, name));
}

/** Ajoute une personne ; renvoie son id (null si le nom est vide). */
export function addOrgPerson(kind: OrgKind, name: string): string | null {
  hydrateOrg();
  const r = addPerson(cache, kind, name);
  write(r.org);
  return r.id;
}

/** Ajoute un pôle ; renvoie son id (null si le nom est vide). */
export function addOrgPole(name: string): string | null {
  hydrateOrg();
  const r = addPole(cache, name);
  write(r.org);
  return r.id;
}

export function assignOrgArtist(
  artist: Pick<Artist, "id" | "category" | "daId">,
  field: AssignmentField,
  value: string,
): void {
  hydrateOrg();
  write(assignArtist(cache, artist, field, value));
}

/** Oublie toute l'organisation saisie : retour aux pôles, personnes et attributions par défaut. */
export function resetOrg(): void {
  hydrateOrg();
  write(DEFAULT_ORG);
}

/**
 * Le DA existe-t-il dans l'organisation (défaut ou ajouté) ? Pour `role.tsx` (`withDa`), qui
 * lit le rôle stocké hors de React : avant l'hydratation du store, on lit le stockage SANS
 * toucher au cache ni notifier (appelé depuis un getSnapshot, qui doit rester sans effet).
 */
export function isOrgDa(id: string | null): boolean {
  if (!id) return false;
  if (hydrated || typeof window === "undefined") return hasDa(cache, id);
  try {
    return hasDa(parseOrgState(window.localStorage.getItem(ORG_STORAGE_KEY)), id);
  } catch {
    return hasDa(DEFAULT_ORG, id);
  }
}

/** Pour `useSyncExternalStore` : notifié à chaque écriture / hydratation, et entre onglets. */
export function subscribeOrg(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== ORG_STORAGE_KEY) return;
    try {
      cache = parseOrgState(window.localStorage.getItem(ORG_STORAGE_KEY));
    } catch {
      cache = DEFAULT_ORG;
    }
    notify();
  };
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

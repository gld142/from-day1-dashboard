/**
 * Store local des modules — quelles pages l'utilisateur affiche dans SA navigation.
 *
 * Ne retient que les CHOIX explicites (`overrides` : href → visible). Une page
 * sans choix suit la valeur par défaut de son persona, définie dans nav.ts
 * (`isVisibleByDefault`). Réinitialiser = oublier tous les choix.
 *
 * Persisté en localStorage sous une clé unique, avec un cache module et
 * `subscribe/snapshot` pour `useSyncExternalStore` — même patron que
 * shares-store : hydratation explicite (`hydrateModules()`, depuis un effet,
 * cf. use-modules.ts) pour que le rendu d'hydratation produise le même HTML
 * que le serveur (navigation par défaut), les choix arrivant juste après.
 *
 * Masquer ne concerne que la navigation : les routes restent accessibles par URL.
 */

import { isVisibleByDefault, navItemByHref, type ModuleOverrides } from "@/lib/nav";
import type { Persona } from "@/lib/role";

const STORAGE_KEY = "day1-modules";
/** Ancienne clé (PrefsProvider) : liste de hrefs masqués, reprise une fois. */
const LEGACY_PREFS_KEY = "day1-prefs";

type ModulesState = {
  version: 1;
  overrides: ModuleOverrides;
};

/* Cache module — hydraté côté client par `hydrateModules()`, lu de façon synchrone. */
let cache: ModuleOverrides = {};
let hydrated = false;
/** JSON des overrides, recalculé à chaque écriture : clé de memo stable entre deux changements. */
let snapshot = "{}";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function isOverrides(v: unknown): v is ModuleOverrides {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every((x) => typeof x === "boolean")
  );
}

/** Lit la clé courante ; à défaut, reprend les masquages de l'ancien PrefsProvider. */
function readStorage(): ModuleOverrides {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    const state = parsed as Partial<ModulesState> | null;
    return state?.version === 1 && isOverrides(state.overrides) ? state.overrides : {};
  }
  const legacy = window.localStorage.getItem(LEGACY_PREFS_KEY);
  if (!legacy) return {};
  const parsed: unknown = JSON.parse(legacy);
  const hidden = (parsed as { hiddenModules?: unknown } | null)?.hiddenModules;
  if (!Array.isArray(hidden)) return {};
  const out: ModuleOverrides = {};
  for (const h of hidden) if (typeof h === "string") out[h] = false;
  return out;
}

/**
 * Relit localStorage une fois (idempotent) et prévient les abonnés si des
 * choix existent. Sans window (serveur) : no-op, le cache reste vide.
 */
export function hydrateModules(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    cache = readStorage();
  } catch {
    cache = {};
  }
  const next = JSON.stringify(cache);
  if (next === snapshot) return;
  snapshot = next;
  notify();
}

function persist() {
  snapshot = JSON.stringify(cache);
  try {
    const state: ModulesState = { version: 1, overrides: cache };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota ou stockage indisponible — les choix restent en mémoire pour la session */
  }
  notify();
}

/** Choix explicite pour cette page ; undefined = suit le défaut du persona. */
export function getModuleOverride(href: string): boolean | undefined {
  return cache[href];
}

/** Tous les choix explicites (lecture synchrone, `{}` avant hydratation et côté serveur). */
export function getModuleOverrides(): ModuleOverrides {
  return cache;
}

/**
 * Visibilité effective d'une page pour un persona : choix utilisateur s'il
 * existe, sinon défaut de nav.ts. Une page inconnue de la navigation est
 * visible (rien ne la masque).
 */
export function getModuleVisibility(href: string, persona: Persona): boolean {
  const override = cache[href];
  if (override !== undefined) return override;
  const item = navItemByHref(href);
  return item ? isVisibleByDefault(item, persona) : true;
}

/** Enregistre un choix explicite (afficher / masquer) pour cette page. */
export function setModuleVisibility(href: string, visible: boolean): void {
  // Écriture depuis un gestionnaire d'événement : on s'assure de ne pas écraser
  // des choix encore non relus.
  hydrateModules();
  if (cache[href] === visible) return;
  cache = { ...cache, [href]: visible };
  persist();
}

/** Oublie tous les choix : chaque persona retrouve sa navigation par défaut. */
export function resetModules(): void {
  hydrateModules();
  if (Object.keys(cache).length === 0) return;
  cache = {};
  persist();
}

/** Pour `useSyncExternalStore` : notifié à chaque set / reset / hydratation. */
export function subscribeModules(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Clé de cache stable (JSON des choix) : dépendance des memos qui recalculent la navigation. */
export function modulesSnapshot(): string {
  return snapshot;
}

/**
 * Store local des relevés de répartition importés — « Vos relevés, c'est vous ».
 *
 * Le reçu affiché sur /rights est un relevé simulé pour la démo. L'artiste (ou
 * la structure) importe son relevé de répartition SACEM / ADAMI ; pour
 * l'instant seul le NOM du fichier est retenu — pas de lecture, pas d'envoi —
 * le rapprochement œuvre par œuvre viendra ensuite. La clé est le périmètre :
 * un artistId, ou « roster » pour les relevés importés en vue structure.
 *
 * Même patron que signatures-store : cache module, `subscribe/snapshot` pour
 * `useSyncExternalStore`, hydratation explicite (`hydrateRightsImports()`
 * depuis un effet — cf. use-rights.ts) et non au premier `getRightsImport()`,
 * pour que le rendu d'hydratation coïncide avec le HTML serveur (sans import).
 */

const STORAGE_KEY = "day1-rights-imports";

/** Périmètre d'un import : un artiste, ou tout le roster (vue structure). */
export const ROSTER_SCOPE = "roster";

export type RightsImport = {
  version: 1;
  /** artistId, ou ROSTER_SCOPE. */
  scopeId: string;
  /** Nom du fichier choisi (jamais lu ni envoyé). */
  fileName: string;
  /** Horodatage ISO de l'import. */
  importedAt: string;
};

type ImportsMap = Record<string, RightsImport>;

/* Cache module — hydraté côté client par `hydrateRightsImports()`, lu de façon synchrone. */
let cache: ImportsMap = {};
let hydrated = false;
/** JSON du cache, recalculé à chaque écriture : clé de memo stable entre deux changements. */
let snapshot = "{}";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Ne garde que des entrées bien formées (un localStorage altéré ne casse pas la page). */
function sanitize(parsed: unknown): ImportsMap {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: ImportsMap = {};
  for (const [scopeId, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const s = v as Partial<RightsImport>;
    if (typeof s.scopeId === "string" && typeof s.fileName === "string" && typeof s.importedAt === "string") {
      out[scopeId] = { version: 1, scopeId: s.scopeId, fileName: s.fileName, importedAt: s.importedAt };
    }
  }
  return out;
}

/**
 * Relit localStorage une fois (idempotent) et prévient les abonnés si des
 * imports existent. Sans window (serveur) : no-op, le cache reste vide.
 */
export function hydrateRightsImports(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = sanitize(raw ? JSON.parse(raw) : {});
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
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* quota ou stockage indisponible — l'import reste en mémoire pour la session */
  }
  notify();
}

/** Relevé importé pour un périmètre ; null si aucun, avant hydratation, ou côté serveur. */
export function getRightsImport(scopeId: string): RightsImport | null {
  return cache[scopeId] ?? null;
}

export function saveRightsImport(s: { scopeId: string; fileName: string }): RightsImport {
  // Écriture depuis un gestionnaire d'événement : on relit d'abord pour ne pas
  // écraser les imports d'autres périmètres encore non relus.
  hydrateRightsImports();
  const next: RightsImport = {
    version: 1,
    scopeId: s.scopeId,
    fileName: s.fileName,
    importedAt: new Date().toISOString(),
  };
  cache = { ...cache, [s.scopeId]: next };
  persist();
  return next;
}

export function clearRightsImport(scopeId: string): void {
  hydrateRightsImports();
  if (!(scopeId in cache)) return;
  const rest = { ...cache };
  delete rest[scopeId];
  cache = rest;
  persist();
}

/** Pour `useSyncExternalStore` : notifié à chaque save / clear / hydratation. */
export function subscribeRightsImports(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Clé de cache stable (JSON de tous les imports) : dépendance des `useMemo` des pages. */
export function rightsImportsSnapshot(): string {
  return snapshot;
}

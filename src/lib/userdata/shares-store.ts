/**
 * Store local des parts de l'artiste — « Ta part, c'est ton contrat ».
 *
 * L'estimateur ne connaît que le brut master ; ce que l'artiste touche dépend
 * de SON contrat. Ici il renseigne ses pourcentages (ou les recopie de son
 * contrat importé) ; la façade api.ts les lit de façon synchrone et les
 * cascades passent de « simulé » à « renseigné ».
 *
 * Persisté en localStorage sous une clé unique (map artistId → parts), avec
 * un cache module et `subscribe/snapshot` pour `useSyncExternalStore`.
 *
 * Hydratation explicite (`hydrateShares()`, depuis un effet — cf. use-shares.ts)
 * et non au premier `getShares()` : pendant le rendu d'hydratation, le client
 * doit produire le même HTML que le serveur (sans parts) ; les parts arrivent
 * juste après, par notification, et les pages abonnées se re-rendent.
 *
 * Le fichier de contrat n'est jamais envoyé : seul son nom est retenu.
 */

const STORAGE_KEY = "day1-shares";

export type ArtistShares = {
  version: 1;
  artistId: string;
  /** Part de l'artiste sur les revenus master (0-100), null = inconnue. */
  masterSharePct: number | null;
  /** L'artiste est-il auteur et/ou compositeur ? */
  isAuthor: boolean;
  /** Part de l'artiste dans les droits d'auteur de ses titres (0-100), null = inconnue. */
  authorSharePct: number | null;
  /** Nom du contrat importé (le fichier n'est jamais envoyé ; lecture locale). */
  contractFileName: string | null;
  updatedAt: string;
};

/** Le sous-ensemble que l'estimateur consomme. */
export type SharesInput = Pick<ArtistShares, "masterSharePct" | "isAuthor" | "authorSharePct">;

type SharesMap = Record<string, ArtistShares>;

/* Cache module — hydraté côté client par `hydrateShares()`, lu de façon synchrone. */
let cache: SharesMap = {};
let hydrated = false;
/** JSON du cache, recalculé à chaque écriture : clé de memo stable entre deux changements. */
let snapshot = "{}";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/**
 * Relit localStorage une fois (idempotent) et prévient les abonnés si des
 * parts existent. Sans window (serveur) : no-op, le cache reste vide.
 */
export function hydrateShares(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SharesMap) : {};
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
    /* quota ou stockage indisponible — les parts restent en mémoire pour la session */
  }
  notify();
}

/** Pourcentage borné à [0, 100] ; NaN / non fini → null (inconnu). */
function clampPct(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.min(100, Math.max(0, v));
}

/** Parts renseignées pour un artiste ; null si rien n'a été saisi, avant hydratation, ou côté serveur. */
export function getShares(artistId: string): ArtistShares | null {
  return cache[artistId] ?? null;
}

export function saveShares(s: Omit<ArtistShares, "version" | "updatedAt">): ArtistShares {
  // Écriture depuis un gestionnaire d'événement : on s'assure de ne pas écraser
  // les parts d'autres artistes encore non relues.
  hydrateShares();
  const next: ArtistShares = {
    version: 1,
    artistId: s.artistId,
    masterSharePct: clampPct(s.masterSharePct),
    isAuthor: s.isAuthor,
    authorSharePct: clampPct(s.authorSharePct),
    contractFileName: s.contractFileName,
    updatedAt: new Date().toISOString(),
  };
  cache = { ...cache, [s.artistId]: next };
  persist();
  return next;
}

export function clearShares(artistId: string): void {
  hydrateShares();
  if (!(artistId in cache)) return;
  const rest = { ...cache };
  delete rest[artistId];
  cache = rest;
  persist();
}

/** Pour `useSyncExternalStore` : notifié à chaque save / clear / hydratation. */
export function subscribeShares(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Clé de cache stable (JSON des parts de tous les artistes) : à passer en
 * dépendance des `useMemo` qui appellent `estimateSummary`, et incluse dans
 * la clé de memo d'api.ts.
 */
export function sharesSnapshot(): string {
  return snapshot;
}

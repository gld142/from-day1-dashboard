/**
 * Store local des signatures de splits — « Signer un split ».
 *
 * L'artiste signe le partage d'un titre au doigt ou à la souris ; l'image
 * (PNG en data URL) et la date restent sur CET appareil, dans localStorage,
 * sous une clé unique (map trackId → signature). Rien n'est envoyé.
 *
 * Même patron que shares-store : cache module, `subscribe/snapshot` pour
 * `useSyncExternalStore`, hydratation explicite (`hydrateSignatures()`
 * depuis un effet — cf. use-signatures.ts) et non au premier `getSignature()`,
 * pour que le rendu d'hydratation coïncide avec le HTML serveur (sans
 * signature) ; les signatures arrivent juste après, par notification.
 */

const STORAGE_KEY = "day1-signatures";

export type SplitSignature = {
  version: 1;
  trackId: string;
  /** Horodatage ISO de la signature. */
  signedAt: string;
  /** PNG de la signature (data URL), rogné à l'encre. */
  dataUrl: string;
};

type SignaturesMap = Record<string, SplitSignature>;

/* Cache module — hydraté côté client par `hydrateSignatures()`, lu de façon synchrone. */
let cache: SignaturesMap = {};
let hydrated = false;
/** JSON du cache, recalculé à chaque écriture : clé de memo stable entre deux changements. */
let snapshot = "{}";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Ne garde que des entrées bien formées (un localStorage altéré ne casse pas la page). */
function sanitize(parsed: unknown): SignaturesMap {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: SignaturesMap = {};
  for (const [trackId, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const s = v as Partial<SplitSignature>;
    if (
      typeof s.trackId === "string" &&
      typeof s.signedAt === "string" &&
      typeof s.dataUrl === "string" &&
      s.dataUrl.startsWith("data:image/")
    ) {
      out[trackId] = { version: 1, trackId: s.trackId, signedAt: s.signedAt, dataUrl: s.dataUrl };
    }
  }
  return out;
}

/**
 * Relit localStorage une fois (idempotent) et prévient les abonnés si des
 * signatures existent. Sans window (serveur) : no-op, le cache reste vide.
 */
export function hydrateSignatures(): void {
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
    /* quota ou stockage indisponible — la signature reste en mémoire pour la session */
  }
  notify();
}

/** Signature locale d'un titre ; null si non signé ici, avant hydratation, ou côté serveur. */
export function getSignature(trackId: string): SplitSignature | null {
  return cache[trackId] ?? null;
}

export function saveSignature(s: { trackId: string; dataUrl: string }): SplitSignature {
  // Écriture depuis un gestionnaire d'événement : on relit d'abord pour ne pas
  // écraser les signatures d'autres titres encore non relues.
  hydrateSignatures();
  const next: SplitSignature = {
    version: 1,
    trackId: s.trackId,
    signedAt: new Date().toISOString(),
    dataUrl: s.dataUrl,
  };
  cache = { ...cache, [s.trackId]: next };
  persist();
  return next;
}

export function clearSignature(trackId: string): void {
  hydrateSignatures();
  if (!(trackId in cache)) return;
  const rest = { ...cache };
  delete rest[trackId];
  cache = rest;
  persist();
}

/** Pour `useSyncExternalStore` : notifié à chaque save / clear / hydratation. */
export function subscribeSignatures(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Clé de cache stable (JSON de toutes les signatures) : dépendance des `useMemo` des pages. */
export function signaturesSnapshot(): string {
  return snapshot;
}

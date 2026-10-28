/**
 * Ce que chaque service a déjà vu dans le fil : la pastille « +1 » d'une note, le compteur rouge
 * de la barre latérale. Démo : localStorage `day1-feed-seen`, une entrée par service (« finance »,
 * « da:da-urbain »…, « structure » sans rôle) → note → dernier passage (ISO).
 *
 * Est NOUVEAU pour moi ce qu'un AUTRE service a écrit après mon dernier passage sur la note : une
 * réponse, ou la note elle-même. Ce que j'écris n'est jamais « nouveau » pour moi. Une note jamais
 * ouverte part d'un point de référence commun (12 h avant la dernière activité du fil) : à la
 * première visite, 3 ou 4 éléments par service s'allument (mesuré le 28/10 sur les exemples, contre
 * 7 à 10 avec 24 h), pas tout l'historique de la démo.
 */
import type { JobRole } from "@/lib/roles";
import type { Actor, FeedNote } from "./feed-model";

const STORAGE_KEY = "day1-feed-seen";
/** Fenêtre de la première visite. */
const FIRST_VISIT_MS = 12 * 3_600_000;

type SeenState = Record<string, Record<string, string>>;

/** La clé du lecteur : un DA est un lecteur à part entière (Inès ne lit pas pour Julien). */
export function viewerKey(role: JobRole | null, daId: string | null): string {
  if (role === "da") return `da:${daId ?? ""}`;
  return role ?? "structure";
}

/** Écrit par moi : même service, et pour un DA, le même DA. */
export function isMine(by: Pick<Actor, "role" | "daId">, role: JobRole | null, daId: string | null): boolean {
  if (by.role !== role) return false;
  return role !== "da" || by.daId === daId;
}

/** 12 h avant la dernière activité du fil : le point de départ d'une note jamais ouverte. */
export function seenBaseline(notes: Pick<FeedNote, "createdAt" | "replies">[]): string {
  let last = 0;
  for (const n of notes) {
    last = Math.max(last, Date.parse(n.createdAt));
    for (const r of n.replies) last = Math.max(last, Date.parse(r.at));
  }
  return new Date(last - FIRST_VISIT_MS).toISOString();
}

/** Combien d'éléments nouveaux pour moi sur cette note (réponses d'autres services + la note elle-même). */
export function unreadOf(
  note: Pick<FeedNote, "createdAt" | "from" | "replies" | "history">,
  seenAt: string | undefined,
  baseline: string,
  role: JobRole | null,
  daId: string | null,
): number {
  const since = Date.parse(seenAt ?? baseline);
  // Le DA auteur vit dans l'événement de création (la note ne garde que le service).
  const created = note.history.find((e) => e.type === "created");
  const author = { role: note.from, daId: created?.by?.daId ?? null };
  let n = Date.parse(note.createdAt) > since && !isMine(author, role, daId) ? 1 : 0;
  for (const r of note.replies) if (Date.parse(r.at) > since && !isMine(r.by, role, daId)) n += 1;
  return n;
}

/* ─── Stockage (même motif que feed-store : cache module + abonnés) ─── */

let cache: SeenState | null = null;
let snapshot = "{}";
const listeners = new Set<() => void>();

function load(): SeenState {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SeenState) : {};
  } catch {
    cache = {};
  }
  snapshot = JSON.stringify(cache);
  return cache;
}

export function subscribeSeen(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = null;
    load();
    fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function seenSnapshot(): string {
  load();
  return snapshot;
}

export function markSeen(viewer: string, noteId: string, at: string): void {
  const state = load();
  if (state[viewer]?.[noteId] && state[viewer][noteId] >= at) return;
  cache = { ...state, [viewer]: { ...(state[viewer] ?? {}), [noteId]: at } };
  snapshot = JSON.stringify(cache);
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* navigation privée : l'état vit le temps de la page */
  }
  for (const l of listeners) l();
}

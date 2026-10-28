/**
 * Pièces jointes du fil, traduites par Day One (feed-attachment.ts) : note → pièces. Démo :
 * localStorage `day1-feed-attachments`, à part du fil (le modèle des notes ne bouge pas). Seule la
 * traduction est gardée — jamais le fichier lui-même, qui ne quitte pas le navigateur.
 */
import type { FeedAttachment } from "./feed-attachment";

const STORAGE_KEY = "day1-feed-attachments";
/** Garde-fou de taille : au-delà, les plus anciennes pièces d'une note sortent. */
const MAX_PER_NOTE = 6;

type State = Record<string, FeedAttachment[]>;

let cache: State | null = null;
let snapshot = "{}";
const listeners = new Set<() => void>();

function load(): State {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as State) : {};
  } catch {
    cache = {};
  }
  snapshot = JSON.stringify(cache);
  return cache;
}

export function subscribeAttachments(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function attachmentsSnapshot(): string {
  load();
  return snapshot;
}

export function addAttachment(noteId: string, attachment: FeedAttachment): void {
  const state = load();
  const list = [...(state[noteId] ?? []), attachment].slice(-MAX_PER_NOTE);
  cache = { ...state, [noteId]: list };
  snapshot = JSON.stringify(cache);
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* navigation privée, ou stockage plein : la pièce vit le temps de la page */
  }
  for (const l of listeners) l();
}

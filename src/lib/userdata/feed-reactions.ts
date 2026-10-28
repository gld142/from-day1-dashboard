/**
 * Réactions en un clic sur un message du fil (✅ reçu / fait, 👀 je regarde, 👍 d'accord) : dire
 * « reçu » sans écrire. Démo : localStorage `day1-feed-reactions`, message → réaction → lecteurs
 * (clés feed-seen). Un second clic retire la sienne.
 */
export const REACTIONS = ["✅", "👀", "👍"] as const;
export type Reaction = (typeof REACTIONS)[number];

type State = Record<string, Partial<Record<Reaction, string[]>>>;

/** Pur : ajoute ma réaction, ou la retire si elle y est déjà. */
export function toggleReaction(state: State, messageId: string, reaction: Reaction, viewer: string): State {
  const current = state[messageId]?.[reaction] ?? [];
  const next = current.includes(viewer) ? current.filter((v) => v !== viewer) : [...current, viewer];
  return { ...state, [messageId]: { ...(state[messageId] ?? {}), [reaction]: next } };
}

const STORAGE_KEY = "day1-feed-reactions";
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

export function subscribeReactions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reactionsSnapshot(): string {
  load();
  return snapshot;
}

export function react(messageId: string, reaction: Reaction, viewer: string): void {
  cache = toggleReaction(load(), messageId, reaction, viewer);
  snapshot = JSON.stringify(cache);
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* navigation privée */
  }
  for (const l of listeners) l();
}

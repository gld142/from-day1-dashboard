/**
 * Fil entre services (spec Universal v2, §5) : une note posée par un service,
 * adressée à d'autres, rattachée ou non à un artiste, avec urgence et échéance —
 * et, depuis le 28/10/2026, un statut à quatre valeurs, un historique, des
 * réponses, des mentions, une prise en charge et un lien vers l'objet
 * (le modèle pur : feed-model.ts ; les exemples : feed-seed.ts).
 *
 * Démo : localStorage `day1-feed`, cache module, `subscribe/snapshot` pour
 * `useSyncExternalStore`, hydratation explicite (`hydrateFeed()`, depuis un
 * effet — cf. use-feed.ts) : le rendu d'hydratation produit le même HTML que
 * le serveur (aucune note), les notes arrivent juste après. Des exemples sont
 * posés au premier chargement si le fil est vide — une seule fois.
 *
 * Stockage : `{ version: 2, seeded, notes }`. Un stockage v1 (avant le 28/10) est
 * migré à la lecture, sans perte (`migrateNote`), puis réécrit en v2 ; ses
 * exemples reçoivent leurs réponses et prises en charge (`enrichLegacySeed`).
 *
 * Hors périmètre ici : emails, base, pièces jointes (produit).
 */
import {
  addReply,
  assignNote,
  changeStatus,
  createNote,
  migrateNote,
  normalizeNote,
  type Actor,
  type DaOf,
  type FeedNote,
  type FeedStatus,
  type NewNote,
} from "./feed-model";
import { SEED_IDS, enrichLegacySeed, seedNotes } from "./feed-seed";

export {
  FEED_TEXT_MAX,
  URGENCIES,
  notesForRole,
  openCountByArtist,
  sortNotes,
  type DaOf,
  type FeedNote,
  type NewNote,
  type Urgency,
} from "./feed-model";
export { seedNotes } from "./feed-seed";

const STORAGE_KEY = "day1-feed";

type FeedState = { version: 2; seeded: boolean; notes: FeedNote[] };

/** Sans DA connu (appel sans table) : aucune mention @DA <prénom> ne passe le périmètre d'un artiste. */
const NO_DA: DaOf = () => null;

let cache: FeedNote[] = [];
let seeded = false;
let hydrated = false;
let snapshot = "[]";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function persist() {
  snapshot = JSON.stringify(cache);
  try {
    const state: FeedState = { version: 2, seeded, notes: cache };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota ou stockage indisponible — les notes restent en mémoire pour la session */
  }
  notify();
}

const isPresent = <T,>(v: T | null): v is T => v !== null;

/** Le stockage tel qu'il est, dans la forme courante. `migrated` : il était en v1. */
function readState(raw: string | null, now: Date): { notes: FeedNote[]; seeded: boolean; migrated: boolean } {
  const parsed = raw ? (JSON.parse(raw) as { version?: unknown; seeded?: unknown; notes?: unknown }) : null;
  const list = Array.isArray(parsed?.notes) ? (parsed.notes as unknown[]) : null;
  if (parsed?.version === 2 && list) {
    return { notes: list.map(normalizeNote).filter(isPresent), seeded: parsed.seeded === true, migrated: false };
  }
  if (parsed?.version === 1 && list) {
    const notes = list
      .map(migrateNote)
      .filter(isPresent)
      .map((n) => (SEED_IDS.includes(n.id) ? enrichLegacySeed(n, now) : n));
    return { notes, seeded: parsed.seeded === true, migrated: true };
  }
  return { notes: [], seeded: false, migrated: false };
}

/**
 * Relit localStorage une fois (idempotent) ; pose les exemples si le fil n'a
 * jamais été rempli. `today` date les exemples (le jour de la démo côté appli),
 * `now` borne leurs étapes (jamais dans le futur). Sans window (serveur) : no-op,
 * le cache reste vide.
 */
export function hydrateFeed(today: Date = new Date(), now: Date = new Date()): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let migrated = false;
  try {
    const state = readState(window.localStorage.getItem(STORAGE_KEY), now);
    cache = state.notes;
    seeded = state.seeded;
    migrated = state.migrated;
  } catch {
    cache = [];
    seeded = false;
  }
  if (!seeded && cache.length === 0) {
    cache = seedNotes(today, now);
    seeded = true;
    persist();
    return;
  }
  if (migrated) {
    persist();
    return;
  }
  const next = JSON.stringify(cache);
  if (next === snapshot) return;
  snapshot = next;
  notify();
}

export function getNotes(): FeedNote[] {
  return cache;
}

const newId = (prefix: string, now: Date) => `${prefix}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function addNote(input: NewNote, now: Date = new Date(), daOf: DaOf = NO_DA): FeedNote {
  hydrateFeed(now, now);
  const note = createNote(input, { id: newId("note", now), at: now.toISOString(), daOf });
  cache = [note, ...cache];
  persist();
  return note;
}

/** Applique une action pure à une note ; rien n'est écrit si elle ne change pas (même référence). */
function update(id: string, now: Date, fn: (n: FeedNote) => FeedNote): void {
  hydrateFeed(now, now);
  const current = cache.find((n) => n.id === id);
  if (!current) return;
  const next = fn(current);
  if (next === current) return;
  cache = cache.map((n) => (n.id === id ? next : n));
  persist();
}

/** « Traité », en un clic, depuis n'importe quel statut ouvert. */
export function markDone(id: string, now: Date = new Date(), by: Actor | null = null): void {
  update(id, now, (n) => (n.status === "open" ? changeStatus(n, "done", by, now.toISOString()) : n));
}

export function setStatus(id: string, status: FeedStatus, by: Actor | null, now: Date = new Date()): void {
  update(id, now, (n) => changeStatus(n, status, by, now.toISOString()));
}

export function replyToNote(id: string, text: string, by: Actor, daOf: DaOf, now: Date = new Date()): void {
  update(id, now, (n) => addReply(n, text, { id: newId("reply", now), at: now.toISOString(), by, daOf }));
}

export function assignNoteTo(id: string, personId: string | null, by: Actor | null, daOf: DaOf, now: Date = new Date()): void {
  update(id, now, (n) => assignNote(n, personId, { at: now.toISOString(), by, daOf }));
}

export function subscribeFeed(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Clé de cache stable (JSON des notes) : "[]" côté serveur et avant hydratation. */
export function feedSnapshot(): string {
  return snapshot;
}

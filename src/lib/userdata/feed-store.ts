/**
 * Fil entre services (spec Universal v2, §5) : une note posée par un service,
 * adressée à d'autres, rattachée ou non à un artiste, avec urgence et échéance.
 *
 * Démo : localStorage `day1-feed`, cache module, `subscribe/snapshot` pour
 * `useSyncExternalStore`, hydratation explicite (`hydrateFeed()`, depuis un
 * effet — cf. use-feed.ts) : le rendu d'hydratation produit le même HTML que
 * le serveur (aucune note), les notes arrivent juste après. Des exemples sont
 * posés au premier chargement si le fil est vide — une seule fois.
 *
 * Hors périmètre ici : emails, base, pièces jointes (produit).
 */
import type { JobRole } from "@/lib/roles";

const STORAGE_KEY = "day1-feed";
export const FEED_TEXT_MAX = 500;

export type Urgency = "info" | "important" | "urgent";
export const URGENCIES: Urgency[] = ["urgent", "important", "info"];

export type FeedNote = {
  id: string;
  createdAt: string;
  from: JobRole;
  /** « Juridique · Camille » — le service et la personne, tel qu'affiché. */
  fromName: string;
  /** Services visés. */
  to: JobRole[];
  artistId: string | null;
  urgency: Urgency;
  /** AAAA-MM-JJ, ou null. */
  dueDate: string | null;
  /** 500 caractères max. */
  text: string;
  status: "open" | "done";
  doneAt: string | null;
};

export type NewNote = Pick<FeedNote, "from" | "fromName" | "to" | "artistId" | "urgency" | "dueDate" | "text">;

type FeedState = { version: 1; seeded: boolean; notes: FeedNote[] };

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
    const state: FeedState = { version: 1, seeded, notes: cache };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota ou stockage indisponible — les notes restent en mémoire pour la session */
  }
  notify();
}

function isNote(v: unknown): v is FeedNote {
  const n = v as Partial<FeedNote> | null;
  return !!n && typeof n.id === "string" && typeof n.text === "string" && Array.isArray(n.to) && (n.status === "open" || n.status === "done");
}

/**
 * Relit localStorage une fois (idempotent) ; pose les exemples si le fil n'a
 * jamais été rempli. Sans window (serveur) : no-op, le cache reste vide.
 */
export function hydrateFeed(today: Date = new Date()): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<FeedState>) : null;
    cache = parsed?.version === 1 && Array.isArray(parsed.notes) ? parsed.notes.filter(isNote) : [];
    seeded = parsed?.seeded === true;
  } catch {
    cache = [];
    seeded = false;
  }
  if (!seeded && cache.length === 0) {
    cache = seedNotes(today);
    seeded = true;
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

export function addNote(input: NewNote, now: Date = new Date()): FeedNote {
  hydrateFeed(now);
  const note: FeedNote = {
    id: `note-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now.toISOString(),
    from: input.from,
    fromName: input.fromName,
    to: [...new Set(input.to)],
    artistId: input.artistId,
    urgency: input.urgency,
    dueDate: input.dueDate,
    text: input.text.trim().slice(0, FEED_TEXT_MAX),
    status: "open",
    doneAt: null,
  };
  cache = [note, ...cache];
  persist();
  return note;
}

export function markDone(id: string, now: Date = new Date()): void {
  hydrateFeed(now);
  if (!cache.some((n) => n.id === id && n.status === "open")) return;
  cache = cache.map((n) => (n.id === id ? { ...n, status: "done", doneAt: now.toISOString() } : n));
  persist();
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

/* ─── Helpers purs (testables sans store) ─── */

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, important: 1, info: 2 };

/** Urgence, puis échéance croissante (sans échéance en dernier), puis la plus récente d'abord. */
export function sortNotes(notes: FeedNote[]): FeedNote[] {
  return [...notes].sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export type DaOf = (artistId: string) => string | null;

/**
 * Les notes OUVERTES à traiter par un rôle : adressées à son service ; pour un
 * DA, seulement celles de ses artistes (une note sans artiste s'adresse à tous
 * les DA). Sans rôle (maison day1) : tout ce qui est ouvert.
 */
export function notesForRole(notes: FeedNote[], role: JobRole | null, daId: string | null, daOf: DaOf): FeedNote[] {
  return notes.filter((n) => {
    if (n.status !== "open") return false;
    if (!role) return true;
    if (!n.to.includes(role)) return false;
    if (role === "da" && daId && n.artistId) return daOf(n.artistId) === daId;
    return true;
  });
}

export function openCountByArtist(notes: FeedNote[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of notes) if (n.status === "open" && n.artistId) out[n.artistId] = (out[n.artistId] ?? 0) + 1;
  return out;
}

/* ─── Exemples (spec §5), datés par rapport à `today` ─── */

const ALL_ROLES: JobRole[] = ["da", "finance", "juridique", "direction", "presidence"];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const shift = (today: Date, days: number) => new Date(today.getTime() + days * 86_400_000);
/** Le prochain « 30 » du calendrier : ce mois-ci s'il n'est pas passé, sinon le mois suivant. */
function nextDay30(today: Date): string {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const thisMonth = new Date(Date.UTC(y, m, 30));
  return isoDay(today.getUTCDate() < 30 ? thisMonth : new Date(Date.UTC(y, m + 1, 30)));
}
/** Le prochain vendredi (aujourd'hui si c'en est un). */
function nextFriday(today: Date): string {
  const delta = (5 - today.getUTCDay() + 7) % 7;
  return isoDay(shift(today, delta));
}

export function seedNotes(today: Date): FeedNote[] {
  const at = (daysAgo: number) => shift(today, -daysAgo).toISOString();
  const base = { status: "open" as const, doneAt: null };
  return [
    { ...base, id: "seed-recoupement-nono", createdAt: at(1), from: "juridique", fromName: "Juridique · Camille", to: ["finance"], artistId: "nono-la-grinta", urgency: "urgent", dueDate: isoDay(shift(today, 15)),
      text: "Clause de recoupement croisé de l'avance de Nono La Grinta : à faire retirer au prochain avenant. Échéance 15 jours." },
    { ...base, id: "seed-avance-leto", createdAt: at(2), from: "finance", fromName: "Finance · Thomas", to: ["da"], artistId: "leto", urgency: "important", dueDate: isoDay(shift(today, 30)),
      text: "Avance de Leto recoupée à 80 % : prévoir la renégociation avant la prochaine sortie." },
    { ...base, id: "seed-option-louane", createdAt: at(0), from: "da", fromName: "DA variété · Julien R.", to: ["juridique"], artistId: "louane", urgency: "urgent", dueDate: nextDay30(today),
      text: "Option sur Louane à lever avant le 30." },
    { ...base, id: "seed-comite-catalogue", createdAt: at(3), from: "direction", fromName: "Direction · Gaël", to: ALL_ROLES, artistId: null, urgency: "info", dueDate: nextFriday(today),
      text: "Comité catalogue vendredi : remonter les œuvres sans split signé." },
    { ...base, id: "seed-edition-gustave", createdAt: at(4), from: "juridique", fromName: "Juridique · Camille", to: ["da"], artistId: "gustave-rudman", urgency: "info", dueDate: null,
      text: "Contrat d'édition de Gustave Rudman reçu, relecture en cours." },
    { ...base, id: "seed-deezer-q3", createdAt: at(1), from: "finance", fromName: "Finance · Thomas", to: ["direction"], artistId: "elgrandetoto", urgency: "important", dueDate: isoDay(shift(today, 7)),
      text: "Relevé Deezer Q3 reçu : écart d'audit sur ElGrandeToto, à arbitrer." },
  ];
}

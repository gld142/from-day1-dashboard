/**
 * Suivi des placements d'une maison d'édition — qui a placé quoi, quand, où ça en est.
 *
 * Le statut d'un placement ne se devine pas : l'équipe le pose À LA MAIN (Gaël, 28/10/2026).
 * Cinq étapes : proposée → en discussion → signée → sortie → déclarée SACEM. Chaque changement
 * est daté et signé (le métier qui l'a fait), et l'historique alimente « Activité récente ».
 *
 * Les placements de la démo (`PLACEMENTS`, data.ts, déjà filtrés par la maison) servent de point de départ : leur étape et
 * leurs dates d'historique sont SIMULÉES (seuls les titres et streams des œuvres sorties sont réels).
 * Ce que l'équipe change ou ajoute est enregistré dans ce navigateur (localStorage `day1-placements`),
 * comme le fil entre services : rien en base, aucun envoi.
 *
 * Les montants (`placementMoney`, `placementFacts` dans api.ts) lisent l'état SUIVI : déclarer une
 * œuvre à la SACEM ici la retire de « Non déclaré » sur Œuvres et sur Pulse.
 *
 * Hydratation explicite (`hydratePlacements()` depuis un effet, cf. use-placements.ts) : le rendu
 * serveur et le premier rendu client lisent l'état de départ, identiques.
 */
import { PLACEMENTS } from "@/lib/demo/data";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { Placement, PlacementStatus } from "@/lib/demo/types";

export type PlacementStage = "proposee" | "discussion" | "signee" | "sortie" | "declaree";
export const STAGES: readonly PlacementStage[] = ["proposee", "discussion", "signee", "sortie", "declaree"];

export type PlacementEvent = {
  id: string;
  placementId: string;
  stage: PlacementStage;
  at: string;
  /** Qui l'a posé, figé au moment de l'action (« Finance », « DA · Inès M. »). null = exemple de démo. */
  by: string | null;
};

export type TrackedPlacement = Placement & {
  stage: PlacementStage;
  /** Dernier changement d'étape. */
  changedAt: string;
  changedBy: string | null;
  /** Étape et historique de démo, pas encore touchés par l'équipe. */
  simulated: boolean;
  /** Ajouté à la main par l'équipe. */
  added: boolean;
};

type State = {
  version: 1;
  overrides: Record<string, { stage: PlacementStage; at: string; by: string | null }>;
  added: Placement[];
  events: PlacementEvent[];
};

const STORAGE_KEY = "day1-placements";
const EMPTY: State = { version: 1, overrides: {}, added: [], events: [] };
const DAY_MS = 86_400_000;

/* ─── Modèle pur ─── */

export function stageToStatus(stage: PlacementStage): PlacementStatus {
  if (stage === "sortie" || stage === "declaree") return "released";
  if (stage === "signee") return "unreleased";
  return "pitched";
}

/** L'étape de départ d'un placement de démo. « Encore une fois » est en discussion, pour montrer l'étape. */
export function seedStage(p: Placement): PlacementStage {
  if (p.status === "released") return p.declared ? "declaree" : "sortie";
  if (p.status === "unreleased") return "signee";
  return p.id === "pl-encore" ? "discussion" : "proposee";
}

/**
 * Déclarée à la SACEM ? Une œuvre sortie l'est à l'étape « déclarée », pas à « sortie ». Avant la
 * sortie, le dépôt peut déjà être fait (« Trop loin » l'est) : on garde l'information d'origine.
 */
function declaredAt(stage: PlacementStage, seedDeclared: boolean): boolean {
  if (stage === "declaree") return true;
  if (stage === "sortie") return false;
  return seedDeclared;
}

const iso = (d: Date) => d.toISOString();
const daysBefore = (today: Date, n: number) => new Date(today.getTime() - n * DAY_MS);

/**
 * Historique de démo (SIMULÉ), déterministe : une sortie à sa date, une déclaration un mois plus
 * tard ; les signatures et propositions s'étalent sur les dernières semaines, pour que « Nouveautés »
 * et « Signées récemment » aient quelque chose à montrer.
 */
export function seedEvents(seed: readonly Placement[], today: Date = DEMO_TODAY): PlacementEvent[] {
  const out: PlacementEvent[] = [];
  let pipe = 0;
  for (const p of seed) {
    const stage = seedStage(p);
    if (stage === "sortie" || stage === "declaree") {
      out.push({ id: `seed-${p.id}-sortie`, placementId: p.id, stage: "sortie", at: `${p.date}T10:00:00.000Z`, by: null });
      if (stage === "declaree") {
        const d = new Date(Date.parse(`${p.date}T10:00:00.000Z`) + 30 * DAY_MS);
        out.push({ id: `seed-${p.id}-declaree`, placementId: p.id, stage: "declaree", at: iso(d), by: null });
      }
    } else {
      // 2, 5, 11, 19 jours avant aujourd'hui : deux tombent dans les 7 derniers jours.
      const ago = [2, 5, 11, 19, 26][pipe % 5];
      pipe += 1;
      out.push({ id: `seed-${p.id}-${stage}`, placementId: p.id, stage, at: iso(daysBefore(today, ago)), by: null });
    }
  }
  return out;
}

/** L'état suivi : départ de démo, puis les changements et ajouts de l'équipe. */
export function trackPlacements(
  state: State,
  seed: readonly Placement[] = PLACEMENTS,
  today: Date = DEMO_TODAY,
): TrackedPlacement[] {
  const seedEv = seedEvents(seed, today);
  const lastSeed = new Map<string, PlacementEvent>();
  for (const e of seedEv) {
    const cur = lastSeed.get(e.placementId);
    if (!cur || e.at > cur.at) lastSeed.set(e.placementId, e);
  }
  const fromSeed = seed.map((p): TrackedPlacement => {
    const o = state.overrides[p.id];
    const stage = o?.stage ?? seedStage(p);
    const ev = lastSeed.get(p.id);
    return {
      ...p,
      status: stageToStatus(stage),
      declared: declaredAt(stage, p.declared),
      stage,
      changedAt: o?.at ?? ev?.at ?? `${p.date}T10:00:00.000Z`,
      changedBy: o ? o.by : null,
      simulated: !o,
      added: false,
    };
  });
  const added = state.added.map((p): TrackedPlacement => {
    const o = state.overrides[p.id];
    const stage = o?.stage ?? seedStage(p);
    return {
      ...p,
      status: stageToStatus(stage),
      declared: declaredAt(stage, p.declared),
      stage,
      changedAt: o?.at ?? `${p.date}T10:00:00.000Z`,
      changedBy: o?.by ?? null,
      simulated: false,
      added: true,
    };
  });
  return [...fromSeed, ...added];
}

/** Historique complet, le plus récent en tête : départ de démo + actions de l'équipe. */
export function activity(state: State, seed: readonly Placement[] = PLACEMENTS, today: Date = DEMO_TODAY): PlacementEvent[] {
  return [...seedEvents(seed, today), ...state.events].sort((a, b) => b.at.localeCompare(a.at));
}

/** Nouveauté : un changement d'étape dans les 7 derniers jours. */
export function isRecent(p: Pick<TrackedPlacement, "changedAt">, now: Date = DEMO_TODAY, days = 7): boolean {
  return now.getTime() - Date.parse(p.changedAt) <= days * DAY_MS && Date.parse(p.changedAt) <= now.getTime() + DAY_MS;
}

export function withStage(state: State, placementId: string, stage: PlacementStage, by: string | null, at: string): State {
  return {
    ...state,
    overrides: { ...state.overrides, [placementId]: { stage, at, by } },
    events: [...state.events, { id: `ev-${placementId}-${Date.parse(at).toString(36)}-${state.events.length}`, placementId, stage, at, by }],
  };
}

export function withAdded(state: State, p: Placement, stage: PlacementStage, by: string | null, at: string): State {
  return withStage({ ...state, added: [...state.added, p] }, p.id, stage, by, at);
}

export function parseState(raw: string | null): State {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== "object" || (v as State).version !== 1) return EMPTY;
    const s = v as State;
    return {
      version: 1,
      overrides: s.overrides && typeof s.overrides === "object" ? s.overrides : {},
      added: Array.isArray(s.added) ? s.added : [],
      events: Array.isArray(s.events) ? s.events : [],
    };
  } catch {
    return EMPTY;
  }
}

/* ─── Store (localStorage) ─── */

let state: State = EMPTY;
let snapshot = JSON.stringify(EMPTY);
let hydrated = false;
let tracked: TrackedPlacement[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  tracked = null;
  for (const fn of listeners) fn();
}

export function hydratePlacements(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    state = parseState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    state = EMPTY;
  }
  const next = JSON.stringify(state);
  if (next === snapshot) return;
  snapshot = next;
  notify();
}

function persist(next: State) {
  state = next;
  snapshot = JSON.stringify(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* stockage indisponible : les changements restent en mémoire pour la session */
  }
  notify();
}

/** Les placements tels que l'équipe les suit (départ de démo avant hydratation, et côté serveur). */
export function getTrackedPlacements(): TrackedPlacement[] {
  if (!tracked) tracked = trackPlacements(state);
  return tracked;
}

export function getActivity(): PlacementEvent[] {
  return activity(state);
}

export function setPlacementStage(placementId: string, stage: PlacementStage, by: string | null, now: Date = new Date()): void {
  hydratePlacements();
  persist(withStage(state, placementId, stage, by, now.toISOString()));
}

export type NewPlacement = Pick<Placement, "artistId" | "title" | "performer" | "date" | "writerSharePct"> & {
  roles?: Placement["roles"];
};

export function addPlacement(input: NewPlacement, stage: PlacementStage, by: string | null, now: Date = new Date()): Placement {
  hydratePlacements();
  const p: Placement = {
    id: `pl-u-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    artistId: input.artistId,
    title: input.title.trim(),
    performer: input.performer.trim(),
    roles: input.roles ?? ["compositeur"],
    writerSharePct: Math.min(100, Math.max(0, input.writerSharePct)),
    producerPointsPct: 0,
    status: stageToStatus(stage),
    date: input.date,
    declared: stage === "declaree",
    streams: 0,
  };
  persist(withAdded(state, p, stage, by, now.toISOString()));
  return p;
}

export function subscribePlacements(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Clé de cache stable, à mettre en dépendance des `useMemo` qui lisent les placements. */
export function placementsSnapshot(): string {
  return snapshot;
}

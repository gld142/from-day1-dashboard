/**
 * Store local de la « valeur exacte » du back catalogue, renseignée par la
 * structure (DAF, expert) — jamais par l'artiste. Même patron que
 * signatures-store : cache module, subscribe/snapshot pour useSyncExternalStore,
 * hydratation explicite depuis un effet. Rien n'est envoyé.
 */
import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "day1-valuations";

export type DeclaredValuation = {
  version: 1;
  artistId: string;
  /** Valeur exacte du back catalogue, en euros. */
  value: number;
  /** Qui l'a renseignée (DAF, expert-comptable, cabinet…). */
  source: string;
  updatedAt: string;
};

type ValuationsMap = Record<string, DeclaredValuation>;

let cache: ValuationsMap = {};
let hydrated = false;
let snapshot = "{}";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function sanitize(parsed: unknown): ValuationsMap {
  if (!parsed || typeof parsed !== "object") return {};
  const out: ValuationsMap = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const d = v as Partial<DeclaredValuation> | null;
    if (!d || d.version !== 1 || typeof d.value !== "number" || !Number.isFinite(d.value) || d.value < 0) continue;
    out[k] = { version: 1, artistId: k, value: d.value, source: String(d.source ?? "").slice(0, 80), updatedAt: String(d.updatedAt ?? "") };
  }
  return out;
}

function persist() {
  snapshot = JSON.stringify(cache);
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* stockage indisponible : on garde le cache mémoire */
  }
  notify();
}

export function hydrateValuations() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? sanitize(JSON.parse(raw)) : {};
  } catch {
    cache = {};
  }
  snapshot = JSON.stringify(cache);
  notify();
}

export function getDeclaredValuation(artistId: string): DeclaredValuation | null {
  return cache[artistId] ?? null;
}

export function saveDeclaredValuation(artistId: string, value: number, source: string): DeclaredValuation {
  const clean = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  const entry: DeclaredValuation = { version: 1, artistId, value: clean, source: source.trim().slice(0, 80), updatedAt: new Date().toISOString() };
  cache = { ...cache, [artistId]: entry };
  persist();
  return entry;
}

export function clearDeclaredValuation(artistId: string) {
  const { [artistId]: _removed, ...rest } = cache;
  void _removed;
  cache = rest;
  persist();
}

export function subscribeValuations(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function valuationsSnapshot(): string {
  return snapshot;
}

/** Clé de memo + hydratation : à appeler dans les pages qui lisent les valeurs déclarées. */
export function useValuationsSnapshot(): string {
  useEffect(() => hydrateValuations(), []);
  return useSyncExternalStore(subscribeValuations, valuationsSnapshot, () => "{}");
}

/** Réservé aux tests. */
export function __resetValuationsForTests() {
  cache = {};
  hydrated = false;
  snapshot = "{}";
}

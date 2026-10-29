/**
 * Répartition SACEM d'un auteur-compositeur, recopiée de son relevé — source par source.
 *
 * Pourquoi (Gaël, 29/10/2026) : un compositeur de musique à l'image (Brice Davoli) touche
 * l'essentiel de ses droits par la DIFFUSION (télévision, cinéma, publicité), que les streams ne
 * mesurent pas. Le dashboard estimait ses revenus depuis Spotify : 56,7 k€ et une marge de
 * −295 %, faux par construction. Aucune source publique ne donne les répartitions nominatives :
 * rien n'est inventé ici, l'équipe saisit le dernier relevé et ce chiffre, « renseigné », passe
 * devant l'estimation (roster, page de l'auteur).
 *
 * Enregistré dans ce navigateur (localStorage `day1-sacem`), comme le fil et le suivi des
 * placements ; hydratation explicite depuis un effet (use-sacem.ts).
 */
export type SacemSource = "tv" | "radio" | "cinema" | "pub" | "streaming" | "live" | "etranger";
export const SACEM_SOURCES: readonly SacemSource[] = ["tv", "radio", "cinema", "pub", "streaming", "live", "etranger"];

export type SacemEntry = {
  artistId: string;
  /** Année de répartition du relevé. */
  year: number;
  /** Euros, par source (0 si rien). */
  bySource: Record<SacemSource, number>;
  at: string;
  by: string | null;
};

type State = { version: 1; entries: Record<string, SacemEntry> };
const STORAGE_KEY = "day1-sacem";
const EMPTY: State = { version: 1, entries: {} };

/* ─── Pur ─── */

export function sacemTotal(e: Pick<SacemEntry, "bySource">): number {
  return SACEM_SOURCES.reduce((s, k) => s + (e.bySource[k] ?? 0), 0);
}

/** Un montant saisi (« 12 500 », « 12500,50 ») → euros ; vide → 0 ; illisible ou négatif → null. */
export function parseAmount(raw: string): number | null {
  const t = raw.replace(/[\s  €]/g, "").replace(",", ".");
  if (t === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

export function parseSacemState(raw: string | null): State {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== "object" || (v as State).version !== 1 || typeof (v as State).entries !== "object") return EMPTY;
    const out: Record<string, SacemEntry> = {};
    for (const [id, e] of Object.entries((v as State).entries)) {
      if (!e || typeof e !== "object" || typeof e.year !== "number" || !e.bySource) continue;
      const bySource = {} as Record<SacemSource, number>;
      for (const k of SACEM_SOURCES) {
        const n = Number((e.bySource as Record<string, unknown>)[k] ?? 0);
        bySource[k] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
      out[id] = { artistId: id, year: e.year, bySource, at: String(e.at ?? ""), by: e.by ?? null };
    }
    return { version: 1, entries: out };
  } catch {
    return EMPTY;
  }
}

/* ─── Store ─── */

let state: State = EMPTY;
let snapshot = JSON.stringify(EMPTY);
let hydrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function hydrateSacem(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    state = parseSacemState(window.localStorage.getItem(STORAGE_KEY));
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
    /* stockage indisponible : la saisie reste en mémoire pour la session */
  }
  notify();
}

/** Le dernier relevé saisi pour cet auteur ; null s'il n'y en a pas (ou avant hydratation). */
export function getSacem(artistId: string): SacemEntry | null {
  return state.entries[artistId] ?? null;
}

export function saveSacem(input: Omit<SacemEntry, "at">, now: Date = new Date()): SacemEntry {
  hydrateSacem();
  const e: SacemEntry = { ...input, at: now.toISOString() };
  persist({ version: 1, entries: { ...state.entries, [input.artistId]: e } });
  return e;
}

export function clearSacem(artistId: string): void {
  hydrateSacem();
  if (!(artistId in state.entries)) return;
  const rest = { ...state.entries };
  delete rest[artistId];
  persist({ version: 1, entries: rest });
}

export function subscribeSacem(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function sacemSnapshot(): string {
  return snapshot;
}

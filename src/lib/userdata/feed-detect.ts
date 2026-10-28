/**
 * « Day One a repéré » : ce que les données de la maison disent déjà, et qui mérite une note.
 *
 * Trois sources, toutes lues dans le dashboard, jamais inventées :
 * - un écart d'audit non résolu (attendu − déclaré) → Finance, lien vers /audit ;
 * - une option, une fin de contrat ou une fenêtre d'audit qui tombe dans les 60 jours, ou une
 *   clause inhabituelle → Juridique et le DA, lien vers /contracts ;
 * - une chute de streams d'au moins 5 % sur 30 jours → le DA, lien vers la fiche artiste.
 *
 * Un signal n'est PAS une note : la vue le propose, un clic le pose dans le fil (texte, service,
 * échéance et lien déjà remplis — rien à recopier). Ce qui a été posé ou écarté ne revient pas
 * (localStorage `day1-feed-detected`).
 */
import { CONTRACTS } from "@/lib/demo/data";
import { auditFindings, streamsDelta, sumStreams } from "@/lib/demo/api";
import type { JobRole } from "@/lib/roles";
import type { FeedLink, Urgency } from "./feed-model";

const DAY = 86_400_000;
const CONTRACT_HORIZON_DAYS = 60;
const STREAMS_DROP_PCT = -5;
const AUDIT_MIN_GAP = 1_000;

export type SignalKind = "audit" | "contract" | "clause" | "streams";

export type Signal = {
  /** Stable : ce qui a été posé ou écarté ne revient pas. */
  id: string;
  kind: SignalKind;
  artistId: string;
  urgency: Urgency;
  to: JobRole[];
  dueDate: string | null;
  link: FeedLink;
  /** Valeurs du texte (la vue le rédige dans la langue de l'action). */
  amount?: number;
  pct?: number;
  source?: string;
  period?: string;
  /** Alerte de contrat : son message, dans les deux langues. */
  message?: { fr: string; en: string };
};

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, important: 1, info: 2 };

export function detectSignals(artistIds: string[], today: string, limit = 5): Signal[] {
  const t0 = Date.parse(`${today}T00:00:00Z`);
  const out: Signal[] = [];
  for (const artistId of artistIds) {
    // Audit : un signal par artiste, le total des écarts ouverts, la plus grosse source en exemple.
    const open = auditFindings(artistId).filter((f) => f.status !== "resolved" && f.expected > f.reported);
    const gap = open.reduce((s, f) => s + (f.expected - f.reported), 0);
    if (gap >= AUDIT_MIN_GAP) {
      const top = [...open].sort((a, b) => b.expected - b.reported - (a.expected - a.reported))[0];
      out.push({
        id: `audit:${artistId}:${Math.round(gap)}`,
        kind: "audit",
        artistId,
        urgency: gap >= 20_000 ? "important" : "info",
        to: ["finance"],
        dueDate: null,
        link: { kind: "audit", href: "/audit" },
        amount: Math.round(gap),
        source: top.source,
        period: top.period,
      });
    }
    // Contrats : ce qui tombe dans les 60 jours, et les clauses à revoir.
    for (const c of CONTRACTS.filter((x) => x.artistId === artistId)) {
      for (const [i, a] of c.alerts.entries()) {
        if (a.kind === "unusual-clause") {
          out.push({
            id: `clause:${c.id}:${i}`,
            kind: "clause",
            artistId,
            urgency: a.severity === "danger" ? "important" : "info",
            to: ["juridique", "da"],
            dueDate: null,
            link: { kind: "contract", href: "/contracts" },
            message: a.message,
          });
          continue;
        }
        if (!a.dueDate) continue;
        const days = Math.round((Date.parse(`${a.dueDate}T00:00:00Z`) - t0) / DAY);
        if (days < 0 || days > CONTRACT_HORIZON_DAYS) continue;
        out.push({
          id: `contract:${c.id}:${i}:${a.dueDate}`,
          kind: "contract",
          artistId,
          urgency: days <= 14 ? "urgent" : "important",
          to: ["juridique", "da"],
          dueDate: a.dueDate,
          link: { kind: "contract", href: "/contracts" },
          message: a.message,
        });
      }
    }
    // Streams : une chute nette sur 30 jours.
    const pct = streamsDelta(artistId, 30);
    if (pct <= STREAMS_DROP_PCT) {
      const cur = sumStreams(artistId, 30);
      const lost = cur - cur / (1 + pct / 100);
      out.push({
        id: `streams:${artistId}:${today}`,
        kind: "streams",
        artistId,
        urgency: "info",
        to: ["da"],
        dueDate: null,
        link: { kind: "artist", href: "/pulse" },
        amount: Math.round(Math.abs(lost)),
        pct: Math.round(pct * 10) / 10,
      });
    }
  }
  return out
    .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, limit);
}

/* ─── Ce qui a déjà été posé ou écarté ─── */

const STORAGE_KEY = "day1-feed-detected";
let cache: string[] | null = null;
let snapshot = "[]";
const listeners = new Set<() => void>();

function load(): string[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    cache = [];
  }
  snapshot = JSON.stringify(cache);
  return cache;
}

export function subscribeDetected(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function detectedSnapshot(): string {
  load();
  return snapshot;
}

export function markDetected(id: string): void {
  const ids = load();
  if (ids.includes(id)) return;
  cache = [...ids, id];
  snapshot = JSON.stringify(cache);
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* navigation privée */
  }
  for (const l of listeners) l();
}

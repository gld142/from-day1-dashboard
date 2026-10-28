"use client";

/**
 * Abonnement React au fil (feed-store) + périmètre du rôle courant : « à traiter
 * pour moi » suit `jobRole` / `daId` ; sans rôle (maison day1), tout est pour moi.
 * "[]" côté serveur et pendant l'hydratation (HTML identique), les notes juste après.
 *
 * « Aujourd'hui » du fil = le jour de la DÉMO (`DEMO_TODAY`, date du dernier relevé) : les
 * exemples sont datés par rapport à lui et les pastilles d'échéance le comparent à lui, jamais
 * à l'horloge du navigateur. Les actions (réponse, statut…) gardent l'heure réelle.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ALL_ARTISTS } from "@/lib/demo/data";
import { DEMO_TODAY, isoDay } from "@/lib/demo/seed";
import { useRole } from "@/lib/role";
import type { Actor, FeedStatus, NewNote } from "./feed-model";
import {
  addNote,
  assignNoteTo,
  feedSnapshot,
  hydrateFeed,
  markDone,
  notesForRole,
  openCountByArtist,
  replyToNote,
  setStatus,
  subscribeFeed,
  type FeedNote,
} from "./feed-store";

const SERVER_SNAPSHOT = "[]";
/* Tout le catalogue, pas le roster de la maison : une note sur un artiste exclu
   de cette maison garde son DA, et le résultat ne dépend pas du tenant. */
export const daOf = (artistId: string) => ALL_ARTISTS.find((a) => a.id === artistId)?.daId ?? null;

/** Le jour de la démo, AAAA-MM-JJ (pastilles « En retard » / « Cette semaine »). */
export const FEED_TODAY = isoDay(DEMO_TODAY);

export function useFeed() {
  const { jobRole, daId } = useRole();
  useEffect(() => {
    hydrateFeed(DEMO_TODAY, new Date());
  }, []);
  const snap = useSyncExternalStore(subscribeFeed, feedSnapshot, () => SERVER_SNAPSHOT);
  const notes = useMemo(() => JSON.parse(snap) as FeedNote[], [snap]);
  const forMe = useMemo(() => notesForRole(notes, jobRole, daId, daOf), [notes, jobRole, daId]);
  const byArtist = useMemo(() => openCountByArtist(notes), [notes]);
  const add = useCallback((input: NewNote) => addNote(input, new Date(), daOf), []);
  const done = useCallback((id: string, by: Actor | null = null) => markDone(id, new Date(), by), []);
  const status = useCallback((id: string, s: FeedStatus, by: Actor) => setStatus(id, s, by), []);
  const reply = useCallback((id: string, text: string, by: Actor) => replyToNote(id, text, by, daOf), []);
  const assign = useCallback((id: string, personId: string | null, by: Actor) => assignNoteTo(id, personId, by, daOf), []);
  return { notes, forMe, openForMe: forMe.length, byArtist, add, done, status, reply, assign, jobRole, daId };
}

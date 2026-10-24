"use client";

/**
 * Abonnement React au fil (feed-store) + périmètre du rôle courant : « à traiter
 * pour moi » suit `jobRole` / `daId` ; sans rôle (maison day1), tout est pour moi.
 * "[]" côté serveur et pendant l'hydratation (HTML identique), les notes juste après.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ALL_ARTISTS } from "@/lib/demo/data";
import { useRole } from "@/lib/role";
import {
  addNote,
  feedSnapshot,
  hydrateFeed,
  markDone,
  notesForRole,
  openCountByArtist,
  subscribeFeed,
  type FeedNote,
} from "./feed-store";

const SERVER_SNAPSHOT = "[]";
/* Tout le catalogue, pas le roster de la maison : une note sur un artiste exclu
   de cette maison garde son DA, et le résultat ne dépend pas du tenant. */
const daOf = (artistId: string) => ALL_ARTISTS.find((a) => a.id === artistId)?.daId ?? null;

export function useFeed() {
  const { jobRole, daId } = useRole();
  useEffect(() => {
    hydrateFeed();
  }, []);
  const snap = useSyncExternalStore(subscribeFeed, feedSnapshot, () => SERVER_SNAPSHOT);
  const notes = useMemo(() => JSON.parse(snap) as FeedNote[], [snap]);
  const forMe = useMemo(() => notesForRole(notes, jobRole, daId, daOf), [notes, jobRole, daId]);
  const byArtist = useMemo(() => openCountByArtist(notes), [notes]);
  const add = useCallback((input: Parameters<typeof addNote>[0]) => addNote(input), []);
  const done = useCallback((id: string) => markDone(id), []);
  return { notes, forMe, openForMe: forMe.length, byArtist, add, done, jobRole, daId };
}

"use client";

/**
 * « Nouveau pour moi » dans le fil, pour le service courant (feed-seen.ts). `{}` côté serveur et
 * pendant l'hydratation : aucune pastille dans le HTML, elles s'allument juste après.
 *
 * Le point de départ d'une note jamais ouverte est FIGÉ à la première visite du lecteur (clé
 * `__since`) : recalculé à chaque rendu, il avançait avec la moindre activité — poser une note
 * éteignait toutes les pastilles (mesuré le 28/10 : 4 → 0).
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRole } from "@/lib/role";
import type { FeedNote } from "./feed-model";
import { markSeen, seenBaseline, seenSnapshot, subscribeSeen, unreadOf, viewerKey } from "./feed-seen";

const SINCE = "__since";

export function useFeedSeen(notes: FeedNote[]) {
  const { jobRole, daId } = useRole();
  const snap = useSyncExternalStore(subscribeSeen, seenSnapshot, () => "{}");
  const viewer = viewerKey(jobRole, daId);
  const seen = useMemo(() => (JSON.parse(snap) as Record<string, Record<string, string>>)[viewer] ?? {}, [snap, viewer]);
  const computed = useMemo(() => seenBaseline(notes), [notes]);
  const baseline = seen[SINCE] ?? computed;
  useEffect(() => {
    if (notes.length > 0 && !seen[SINCE]) markSeen(viewer, SINCE, computed);
  }, [notes.length, seen, viewer, computed]);
  const unread = useCallback(
    (n: FeedNote) => unreadOf(n, seen[n.id], baseline, jobRole, daId),
    [seen, baseline, jobRole, daId],
  );
  const see = useCallback((noteId: string) => markSeen(viewer, noteId, new Date().toISOString()), [viewer]);
  return { unread, see };
}

"use client";

/**
 * « Nouveau pour moi » dans le fil, pour le service courant (feed-seen.ts). `{}` côté serveur et
 * pendant l'hydratation : aucune pastille dans le HTML, elles s'allument juste après.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useRole } from "@/lib/role";
import type { FeedNote } from "./feed-model";
import { markSeen, seenBaseline, seenSnapshot, subscribeSeen, unreadOf, viewerKey } from "./feed-seen";

export function useFeedSeen(notes: FeedNote[]) {
  const { jobRole, daId } = useRole();
  const snap = useSyncExternalStore(subscribeSeen, seenSnapshot, () => "{}");
  const viewer = viewerKey(jobRole, daId);
  const seen = useMemo(() => (JSON.parse(snap) as Record<string, Record<string, string>>)[viewer] ?? {}, [snap, viewer]);
  const baseline = useMemo(() => seenBaseline(notes), [notes]);
  const unread = useCallback(
    (n: FeedNote) => unreadOf(n, seen[n.id], baseline, jobRole, daId),
    [seen, baseline, jobRole, daId],
  );
  const see = useCallback((noteId: string) => markSeen(viewer, noteId, new Date().toISOString()), [viewer]);
  return { unread, see };
}

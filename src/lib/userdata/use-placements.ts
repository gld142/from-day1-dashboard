"use client";

/**
 * Abonnement React au suivi des placements (placements-store). Renvoie la clé `placementsSnapshot()` :
 * l'état de départ côté serveur et pendant l'hydratation (HTML identique), puis l'état enregistré
 * dès que l'effet a relu localStorage. À passer en dépendance des `useMemo` qui lisent les placements.
 */
import { useEffect, useSyncExternalStore } from "react";
import { hydratePlacements, placementsSnapshot, subscribePlacements } from "./placements-store";

const SERVER_SNAPSHOT = JSON.stringify({ version: 1, overrides: {}, added: [], events: [] });

export function usePlacementsSnapshot(): string {
  useEffect(() => {
    hydratePlacements();
  }, []);
  return useSyncExternalStore(subscribePlacements, placementsSnapshot, () => SERVER_SNAPSHOT);
}

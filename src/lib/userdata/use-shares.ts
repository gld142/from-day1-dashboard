"use client";

/**
 * Abonnement React aux parts renseignées (shares-store).
 *
 * Renvoie la clé de cache `sharesSnapshot()` : "{}" côté serveur et pendant
 * l'hydratation (HTML identique), puis la vraie valeur dès que l'effet a relu
 * localStorage. À passer en dépendance des `useMemo` qui appellent
 * `estimateSummary` / `estimateSummaries` : elles se recalculent à chaque
 * enregistrement.
 */
import { useEffect, useSyncExternalStore } from "react";
import { hydrateShares, sharesSnapshot, subscribeShares } from "./shares-store";

const SERVER_SNAPSHOT = "{}";

export function useSharesSnapshot(): string {
  useEffect(() => {
    hydrateShares();
  }, []);
  return useSyncExternalStore(subscribeShares, sharesSnapshot, () => SERVER_SNAPSHOT);
}

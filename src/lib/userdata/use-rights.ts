"use client";

/**
 * Abonnement React aux relevés de répartition importés (rights-store).
 *
 * Renvoie la clé de cache `rightsImportsSnapshot()` : "{}" côté serveur et
 * pendant l'hydratation (HTML identique), puis la vraie valeur dès que l'effet
 * a relu localStorage. À passer en dépendance des `useMemo` qui lisent
 * `getRightsImport` : ils se recalculent à chaque import.
 */
import { useEffect, useSyncExternalStore } from "react";
import { hydrateRightsImports, rightsImportsSnapshot, subscribeRightsImports } from "./rights-store";

const SERVER_SNAPSHOT = "{}";

export function useRightsImportsSnapshot(): string {
  useEffect(() => {
    hydrateRightsImports();
  }, []);
  return useSyncExternalStore(subscribeRightsImports, rightsImportsSnapshot, () => SERVER_SNAPSHOT);
}

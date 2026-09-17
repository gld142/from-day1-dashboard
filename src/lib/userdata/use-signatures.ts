"use client";

/**
 * Abonnement React aux signatures locales de splits (signatures-store).
 *
 * Renvoie la clé de cache `signaturesSnapshot()` : "{}" côté serveur et
 * pendant l'hydratation (HTML identique), puis la vraie valeur dès que l'effet
 * a relu localStorage. À passer en dépendance des `useMemo` qui lisent
 * `getSignature` : ils se recalculent à chaque signature.
 */
import { useEffect, useSyncExternalStore } from "react";
import { hydrateSignatures, signaturesSnapshot, subscribeSignatures } from "./signatures-store";

const SERVER_SNAPSHOT = "{}";

export function useSignaturesSnapshot(): string {
  useEffect(() => {
    hydrateSignatures();
  }, []);
  return useSyncExternalStore(subscribeSignatures, signaturesSnapshot, () => SERVER_SNAPSHOT);
}

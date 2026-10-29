"use client";

/**
 * Abonnement React aux répartitions SACEM saisies (sacem-store) : « vide » côté serveur et pendant
 * l'hydratation (HTML identique), puis la saisie enregistrée dès que l'effet a relu localStorage.
 */
import { useEffect, useSyncExternalStore } from "react";
import { hydrateSacem, sacemSnapshot, subscribeSacem } from "./sacem-store";

const SERVER_SNAPSHOT = JSON.stringify({ version: 1, entries: {} });

export function useSacemSnapshot(): string {
  useEffect(() => {
    hydrateSacem();
  }, []);
  return useSyncExternalStore(subscribeSacem, sacemSnapshot, () => SERVER_SNAPSHOT);
}

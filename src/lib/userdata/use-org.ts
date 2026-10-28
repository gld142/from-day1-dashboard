"use client";

/**
 * Abonnement React à l'organisation de la maison (org-store). Côté serveur et pendant
 * l'hydratation : l'organisation par défaut (HTML identique), puis la vraie valeur dès l'effet.
 *
 * `useScopedRoster(daId)` : le périmètre d'un rôle DA selon l'attribution RÉELLE des artistes
 * (et non plus leur catégorie). Pulse, Revenus, Streams, Audience, Contrats et la barre du haut
 * le lisent : réattribuer un artiste le déplace aussitôt dans le périmètre du nouveau DA.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ARTISTS } from "@/lib/demo/data";
import { DEFAULT_ORG, type OrgState } from "@/lib/demo/org";
import { scopedArtists } from "@/lib/demo/scope";
import type { Artist } from "@/lib/demo/types";
import { getOrg, hydrateOrg, subscribeOrg } from "./org-store";

const serverOrg = () => DEFAULT_ORG;

export function useOrg(): OrgState {
  useEffect(() => {
    hydrateOrg();
  }, []);
  return useSyncExternalStore(subscribeOrg, getOrg, serverOrg);
}

/** Les artistes du périmètre (null = tout le roster), catégorie et DA selon l'organisation. */
export function useScopedRoster(daId: string | null): Artist[] {
  const org = useOrg();
  return useMemo(() => scopedArtists({ daId }, ARTISTS, org), [daId, org]);
}

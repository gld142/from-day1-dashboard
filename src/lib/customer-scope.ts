"use client";

/**
 * Le périmètre des pages Revenus / Streams en mode client :
 *  - « artist » : le relevé de l'artiste ouvert (store, comme avant) ;
 *  - « label »  : le relevé virtuel de l'espace, demandé par `?perimetre=label`,
 *    seulement en vue label (sinon on retombe sur l'artiste).
 *
 * En périmètre label, `data` peut être `null` (aucun relevé dans l'espace) alors que
 * `label` est non nul : la page affiche alors « Aucun relevé importé dans cet espace »,
 * elle ne retombe pas sur l'artiste.
 */
import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useCustomer, useCustomerLabelStatement, type CustomerInfo } from "@/lib/customer-mode";
import type { LabelStatement } from "@/lib/userdata/merge";
import { getUserData, subscribeUserData, type UserData } from "@/lib/userdata/store";

export type StatementScope = "artist" | "label";

export function useStatementScope(): { scope: StatementScope; data: UserData | null; label: LabelStatement | null; customer: CustomerInfo | null } {
  const customer = useCustomer();
  const label = useCustomerLabelStatement();
  const wantsLabel = useSearchParams().get("perimetre") === "label";
  const artistData = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const scope: StatementScope = wantsLabel && customer?.view === "label" && label ? "label" : "artist";
  return { scope, data: scope === "label" ? label!.data : artistData, label: scope === "label" ? label : null, customer };
}

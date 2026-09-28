"use client";

/**
 * Mode client : le dashboard d'un compte payant, sur l'artiste choisi dans /espace.
 * Les chiffres viennent du relevé importé en base (jamais du localStorage de démo),
 * l'identité est fixée (CustomerRoleProvider), la navigation réduite aux pages qui
 * reposent sur ce relevé (CUSTOMER_MODULES).
 *
 * Rien n'est rendu côté serveur : la façade lit un état de module, qui ne doit
 * jamais être partagé entre requêtes serveur — et le HTML initial ne doit pas
 * montrer la démo le temps d'un éclair.
 */
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { CustomerRoleProvider } from "@/lib/role";
import type { CustomerContracts } from "@/lib/accounts/customer";
import type { RosterArtist } from "@/lib/userdata/roster";
import { clearCustomerData, setCustomerDataSilently, type UserData } from "@/lib/userdata/store";

export type CustomerInfo = {
  userId: string;
  workspaceId: string;
  email: string;
  workspaceName: string;
  role: "owner" | "member" | "artist";
  artistId: string;
  artistName: string;
};

const Ctx = createContext<CustomerInfo | null>(null);
const RosterCtx = createContext<RosterArtist[] | null>(null);
const ContractsCtx = createContext<CustomerContracts | null>(null);

/** Les infos du client en mode client, `null` en mode démo. */
export function useCustomer(): CustomerInfo | null {
  return useContext(Ctx);
}

/** Les artistes de l'espace et leur dernier relevé — chargés sur les pages de la vue structure seulement. */
export function useCustomerRoster(): RosterArtist[] | null {
  return useContext(RosterCtx);
}

/** Les contrats visibles (RLS) et les artistes — chargés sur /contracts seulement. */
export function useCustomerContracts(): CustomerContracts | null {
  return useContext(ContractsCtx);
}

const subscribeNever = () => () => {};

export function CustomerMode({
  info,
  data,
  roster = null,
  contracts = null,
  children,
}: {
  info: CustomerInfo;
  data: UserData | null;
  roster?: RosterArtist[] | null;
  contracts?: CustomerContracts | null;
  children: React.ReactNode;
}) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  useEffect(() => () => clearCustomerData(), []);
  if (!mounted) return <div className="p-8 text-sm text-muted-foreground">Chargement de ton dashboard…</div>;
  // Avant que la moindre page ne lise la façade (idempotent).
  setCustomerDataSilently(data ? { ...data, artistName: info.artistName, active: true } : null);
  return (
    <Ctx.Provider value={info}>
      <RosterCtx.Provider value={roster}>
        <ContractsCtx.Provider value={contracts}>
          <CustomerRoleProvider>{children}</CustomerRoleProvider>
        </ContractsCtx.Provider>
      </RosterCtx.Provider>
    </Ctx.Provider>
  );
}

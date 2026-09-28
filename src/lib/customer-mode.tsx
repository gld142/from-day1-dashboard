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
import type { CustomerContracts, CustomerFinances, CustomerRegister, CustomerRights, CustomerSplits } from "@/lib/accounts/customer";
import type { Placement } from "@/lib/registers/placements";
import type { Show } from "@/lib/registers/shows";
import type { SyncLicense } from "@/lib/registers/sync";
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
const SplitsCtx = createContext<CustomerSplits | null>(null);
const RightsCtx = createContext<CustomerRights | null>(null);
const FinancesCtx = createContext<CustomerFinances | null>(null);
/** Registres saisis (concerts, placements, sync) — chargés chacun sur sa page seulement. */
export type CustomerRegisters = {
  shows?: CustomerRegister<Show>;
  placements?: CustomerRegister<Placement>;
  sync?: CustomerRegister<SyncLicense>;
};
const RegistersCtx = createContext<CustomerRegisters>({});

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

/** Les splits visibles (RLS), les artistes et les titres de leurs relevés — chargés sur /splits seulement. */
export function useCustomerSplits(): CustomerSplits | null {
  return useContext(SplitsCtx);
}

/** Les versements de droits visibles (RLS) et les artistes — chargés sur /rights seulement. */
export function useCustomerRights(): CustomerRights | null {
  return useContext(RightsCtx);
}

/** Dépenses, droits et revenus des relevés (RLS) — chargés sur /finances seulement. */
export function useCustomerFinances(): CustomerFinances | null {
  return useContext(FinancesCtx);
}

export function useCustomerRegisters(): CustomerRegisters {
  return useContext(RegistersCtx);
}

const subscribeNever = () => () => {};

export function CustomerMode({
  info,
  data,
  roster = null,
  contracts = null,
  splits = null,
  rights = null,
  finances = null,
  registers = {},
  children,
}: {
  info: CustomerInfo;
  data: UserData | null;
  roster?: RosterArtist[] | null;
  contracts?: CustomerContracts | null;
  splits?: CustomerSplits | null;
  rights?: CustomerRights | null;
  finances?: CustomerFinances | null;
  registers?: CustomerRegisters;
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
          <SplitsCtx.Provider value={splits}>
            <RightsCtx.Provider value={rights}>
              <FinancesCtx.Provider value={finances}>
                <RegistersCtx.Provider value={registers}>
                  <CustomerRoleProvider>{children}</CustomerRoleProvider>
                </RegistersCtx.Provider>
              </FinancesCtx.Provider>
            </RightsCtx.Provider>
          </SplitsCtx.Provider>
        </ContractsCtx.Provider>
      </RosterCtx.Provider>
    </Ctx.Provider>
  );
}

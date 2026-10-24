"use client";

/**
 * Abonnement React aux modules (modules-store) — la source unique de la
 * navigation : sidebar, menu mobile, palette ⌘K et Réglages lisent ce hook.
 *
 * `sections` = navigation rendue pour le persona courant (défauts + choix) ;
 * `catalog` = toutes les pages accessibles au persona, visibles ou non
 * (Réglages → Modules) — les deux sans les pages que la maison n'ouvre pas
 * (`sectionsForTenant`). Côté serveur et pendant l'hydratation, les choix
 * valent `{}` : HTML identique, puis la vraie valeur dès l'effet.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { FileUp } from "lucide-react";
import {
  customerSections,
  isModuleVisible,
  navCatalogForPersona,
  navForPersona,
  sectionsForTenant,
  type NavItem,
} from "@/lib/nav";
import { useCustomer } from "@/lib/customer-mode";
import { useRole } from "@/lib/role";
import { modulesState } from "@/lib/roles";
import { TENANT } from "@/lib/tenant";
import {
  hydrateModules,
  modulesSnapshot,
  resetModules,
  setModuleVisibility,
  subscribeModules,
} from "./modules-store";

const SERVER_SNAPSHOT = "{}";

export function useModules() {
  const { persona, jobRole } = useRole();
  useEffect(() => {
    hydrateModules();
  }, []);
  const snap = useSyncExternalStore(subscribeModules, modulesSnapshot, () => SERVER_SNAPSHOT);
  /* La maison retire ses pages fermées (Universal : les pages internes From Day 1) du catalogue
     ET de la navigation : ni Réglages, ni la sidebar, ni la palette ⌘K ne les listent. */
  const catalog = useMemo(() => sectionsForTenant(navCatalogForPersona(persona), TENANT), [persona]);
  /* Préréglage du rôle sous les choix explicites de l'utilisateur, et « Réinitialiser » qui ne
     compte que ces choix : la paire vient de roles.ts (modulesState), pure et testée. */
  const { overrides, hasOverrides } = useMemo(
    () => modulesState(snap, jobRole, catalog.flatMap((s) => s.items.map((i) => i.href))),
    [snap, jobRole, catalog],
  );

  const customer = useCustomer();
  const sections = useMemo(() => {
    const nav = sectionsForTenant(navForPersona(persona, overrides), TENANT);
    if (!customer) return nav;
    // Mode client : un menu à part (nav.ts, customerSections) — jamais la démo.
    const importItem = nav.flatMap((s) => s.items).find((i) => i.href === "/import");
    return customerSections(customer, importItem ?? { href: "/import", labelKey: "items.importer", icon: FileUp });
  }, [persona, overrides, customer]);
  const isVisible = useCallback(
    (item: NavItem) => isModuleVisible(item, persona, overrides),
    [persona, overrides],
  );

  return {
    persona,
    sections,
    catalog,
    isVisible,
    setVisible: setModuleVisibility,
    reset: resetModules,
    hasOverrides,
  };
}

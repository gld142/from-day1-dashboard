"use client";

/**
 * Abonnement React aux modules (modules-store) — la source unique de la
 * navigation : sidebar, menu mobile, palette ⌘K et Réglages lisent ce hook.
 *
 * `sections` = navigation rendue pour le persona courant (défauts + choix) ;
 * `catalog` = toutes les pages accessibles au persona, visibles ou non
 * (Réglages → Modules). Côté serveur et pendant l'hydratation, les choix
 * valent `{}` : HTML identique, puis la vraie valeur dès l'effet.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  isModuleVisible,
  navCatalogForPersona,
  navForPersona,
  type ModuleOverrides,
  type NavItem,
} from "@/lib/nav";
import { useCustomer } from "@/lib/customer-mode";
import { CUSTOMER_BUSINESS_ITEMS, CUSTOMER_FIGURES_ITEMS, CUSTOMER_HOME_ITEM, CUSTOMER_ROSTER_ITEM } from "@/lib/nav";
import { useRole } from "@/lib/role";
import {
  hydrateModules,
  modulesSnapshot,
  resetModules,
  setModuleVisibility,
  subscribeModules,
} from "./modules-store";

const SERVER_SNAPSHOT = "{}";

export function useModules() {
  const { persona } = useRole();
  useEffect(() => {
    hydrateModules();
  }, []);
  const snap = useSyncExternalStore(subscribeModules, modulesSnapshot, () => SERVER_SNAPSHOT);
  const overrides = useMemo(() => JSON.parse(snap) as ModuleOverrides, [snap]);

  const customer = useCustomer();
  const sections = useMemo(() => {
    const nav = navForPersona(persona, overrides);
    if (!customer) return nav;
    // Mode client : un menu à part, seulement les pages branchées sur les relevés
    // (pas de « rituel quotidien » ni de « live » : les relevés sont mensuels). Le
    // roster (vue structure) pour le propriétaire et l'équipe, pas pour l'artiste invité.
    const overview = customer.role === "artist" ? [CUSTOMER_HOME_ITEM] : [CUSTOMER_HOME_ITEM, CUSTOMER_ROSTER_ITEM];
    const account = nav.flatMap((s) => s.items).filter((i) => i.href === "/import");
    return [
      { labelKey: "sections.overview", items: overview },
      { labelKey: "sections.figures", items: CUSTOMER_FIGURES_ITEMS },
      { labelKey: "sections.rights", items: CUSTOMER_BUSINESS_ITEMS },
      { labelKey: "sections.account", items: account },
    ];
  }, [persona, overrides, customer]);
  const catalog = useMemo(() => navCatalogForPersona(persona), [persona]);
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
    hasOverrides: Object.keys(overrides).length > 0,
  };
}

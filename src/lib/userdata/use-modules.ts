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
import { CUSTOMER_HOME_ITEM, CUSTOMER_MODULES, CUSTOMER_ROSTER_ITEM } from "@/lib/nav";
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
    // Mode client : seulement les pages branchées sur le relevé du client ; le
    // roster (vue structure) pour le propriétaire et l'équipe, pas pour l'artiste invité.
    const open = nav
      .map((s) => ({ ...s, items: s.items.filter((i) => CUSTOMER_MODULES.has(i.href)) }))
      .filter((s) => s.items.length > 0);
    const daily = customer.role === "artist" ? [CUSTOMER_HOME_ITEM] : [CUSTOMER_HOME_ITEM, CUSTOMER_ROSTER_ITEM];
    return [{ labelKey: "sections.daily", items: daily }, ...open.filter((s) => s.labelKey !== "sections.daily")];
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

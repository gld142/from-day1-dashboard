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
import { FileUp } from "lucide-react";
import {
  customerSections,
  isModuleVisible,
  navCatalogForPersona,
  navForPersona,
  type ModuleOverrides,
  type NavItem,
} from "@/lib/nav";
import { useCustomer } from "@/lib/customer-mode";
import { useRole } from "@/lib/role";
import { effectiveOverrides, hasUserOverrides } from "@/lib/roles";
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
  const catalog = useMemo(() => navCatalogForPersona(persona), [persona]);
  /* Préréglage du rôle sous les choix explicites de l'utilisateur (roles.ts, effectiveOverrides —
     l'ordre de la fusion y est testé). `snap` n'est analysé qu'une fois par rendu : les choix
     servent à la fusion ET à « Réinitialiser », qui ne compte que les choix de l'utilisateur. */
  const { overrides, hasOverrides } = useMemo(() => {
    const user = JSON.parse(snap) as ModuleOverrides;
    return {
      overrides: effectiveOverrides(jobRole, catalog.flatMap((s) => s.items.map((i) => i.href)), user),
      hasOverrides: hasUserOverrides(user),
    };
  }, [snap, jobRole, catalog]);

  const customer = useCustomer();
  const sections = useMemo(() => {
    const nav = navForPersona(persona, overrides);
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

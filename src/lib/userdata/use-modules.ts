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
import { roleOverrides, type JobRole } from "@/lib/roles";
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
  // TODO Task 8 : lire `jobRole` depuis `useRole()` (ajouté à RoleState par la Task 8) ; d'ici là, aucun rôle.
  const jobRole: JobRole | null = null; // posé par la Task 8
  useEffect(() => {
    hydrateModules();
  }, []);
  const snap = useSyncExternalStore(subscribeModules, modulesSnapshot, () => SERVER_SNAPSHOT);
  const catalog = useMemo(() => navCatalogForPersona(persona), [persona]);
  /* Préréglage du rôle (roles.ts) sous les choix explicites de l'utilisateur : un rôle règle la
     navigation comme Réglages → Modules l'aurait fait, et l'utilisateur garde le dernier mot. */
  const overrides = useMemo<ModuleOverrides>(() => {
    const user = JSON.parse(snap) as ModuleOverrides;
    return { ...roleOverrides(jobRole, catalog.flatMap((s) => s.items.map((i) => i.href))), ...user };
  }, [snap, jobRole, catalog]);
  // Seuls les choix de l'utilisateur comptent : un rôle sans choix ne doit pas allumer « Réinitialiser ».
  const hasOverrides = snap !== SERVER_SNAPSHOT && Object.keys(JSON.parse(snap) as ModuleOverrides).length > 0;

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

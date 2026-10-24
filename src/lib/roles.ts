/**
 * Rôles métier de la maison Universal (spec Universal v2, §4) : un rôle = une
 * page d'arrivée, une navigation (préréglage de modules, comme Réglages →
 * Modules) et, pour le DA, un périmètre (ses artistes). Le sélecteur de rôle
 * est un outil de DÉMO, pas une authentification.
 *
 * Pur : aucun import de nav.ts (qui importe le type Persona de role.tsx, qui
 * importe JobRole d'ici). Les hrefs du catalogue sont passés par l'appelant.
 */
import type { ModuleOverrides } from "@/lib/nav";

export const JOB_ROLES = ["da", "finance", "juridique", "direction", "presidence"] as const;
export type JobRole = (typeof JOB_ROLES)[number];

export function isJobRole(v: unknown): v is JobRole {
  return typeof v === "string" && (JOB_ROLES as readonly string[]).includes(v);
}

export type RoleConfig = {
  id: JobRole;
  /** Page d'arrivée (le DA : voir `roleLanding`, qui ajoute `?da=`). */
  landing: string;
  /** Hrefs visibles dans la navigation, ou « all » (direction). Réglages reste toujours (verrouillé dans nav.ts). */
  nav: readonly string[] | "all";
  /** « da » : ses artistes partout où un agrégat label existe ; « all » : tout le roster. */
  scope: "da" | "all";
};

export const ROLES: Record<JobRole, RoleConfig> = {
  da: {
    id: "da",
    landing: "/roster",
    nav: ["/roster", "/pulse", "/streams", "/audience", "/ar-watch", "/contracts", "/fil"],
    scope: "da",
  },
  finance: {
    id: "finance",
    landing: "/revenue",
    nav: ["/revenue", "/finances", "/rights", "/valuation", "/audit", "/fil"],
    scope: "all",
  },
  juridique: {
    id: "juridique",
    landing: "/contracts",
    nav: ["/contracts", "/splits", "/rights", "/placements", "/fil"],
    scope: "all",
  },
  direction: { id: "direction", landing: "/pulse", nav: "all", scope: "all" },
  presidence: {
    id: "presidence",
    /* Pulse en vue structure s'ouvre déjà sur la synthèse (streams, revenus, valorisation, alertes). */
    landing: "/pulse",
    nav: ["/pulse", "/roster", "/valuation", "/fil"],
    scope: "all",
  },
};

/** Page d'arrivée : le DA arrive sur son roster déjà filtré. */
export function roleLanding(role: JobRole, daId: string | null): string {
  if (role === "da" && daId) return `/roster?da=${encodeURIComponent(daId)}`;
  return ROLES[role].landing;
}

/**
 * Préréglage de modules du rôle, dans le format des choix utilisateur
 * (`ModuleOverrides`) : visible = dans la liste du rôle, caché sinon. Les choix
 * explicites de l'utilisateur se posent PAR-DESSUS (use-modules.ts).
 */
export function roleOverrides(role: JobRole | null, catalogHrefs: readonly string[]): ModuleOverrides {
  if (!role || ROLES[role].nav === "all") return {};
  const keep = new Set(ROLES[role].nav as readonly string[]);
  return Object.fromEntries(catalogHrefs.map((h) => [h, keep.has(h)]));
}

/** Périmètre du rôle : les artistes du DA, sinon tout le roster. */
export function roleScope(role: JobRole | null, daId: string | null): { daId: string | null } {
  return role === "da" && daId ? { daId } : { daId: null };
}

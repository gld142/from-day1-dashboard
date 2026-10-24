/**
 * La « maison » (tenant) : choisie AU BUILD par NEXT_PUBLIC_TENANT, elle règle
 * le nom, la co-marque, le roster (artistes exclus) et le sélecteur de rôle
 * métier. Deux projets Vercel, un seul code (spec Universal v2, §1).
 *
 * Pur et sans import : lu par data.ts (roster), la sidebar, le layout racine
 * (metadata) et role.tsx (artiste ouvert par défaut).
 */
export type TenantId = "day1" | "universal";

export type Tenant = {
  id: TenantId;
  /** « Day 1 Dashboard Pro » / « Day One × Universal » — le nom du label de démo. */
  name: string;
  /** Marque de la sidebar et du menu mobile. */
  shortName: string;
  tagline: string;
  /** Co-marque (null = Day 1 seul). */
  logo: { text: string; bg: string; fg: string } | null;
  /** Artistes du roster complet que cette maison ne montre pas. */
  excludedArtists: string[];
  /** Sélecteur de rôle métier dans la barre du haut (à la place des personas). */
  roles: boolean;
  /** Artiste ouvert par défaut en persona artiste (role.tsx) — jamais un exclu. */
  defaultArtistId: string;
};

export const TENANTS: Record<TenantId, Tenant> = {
  day1: {
    id: "day1",
    name: "Day 1 Dashboard Pro",
    shortName: "Day 1",
    tagline: "Dashboard 360°",
    logo: null,
    excludedArtists: ["kiko"],
    roles: false,
    defaultArtistId: "dadju",
  },
  universal: {
    id: "universal",
    name: "Day One × Universal",
    shortName: "Day One × Universal",
    tagline: "Un dashboard par métier",
    logo: { text: "UNIVERSAL", bg: "#000000", fg: "#ffffff" },
    excludedArtists: ["dadju"],
    roles: true,
    defaultArtistId: "nono-la-grinta",
  },
};

export function isTenantId(v: string | undefined): v is TenantId {
  return v === "day1" || v === "universal";
}

export function tenantFor(raw: string | undefined): Tenant {
  return TENANTS[isTenantId(raw) ? raw : "day1"];
}

/**
 * La maison du build. Lecture LITTÉRALE de `process.env.NEXT_PUBLIC_TENANT` :
 * Next ne remplace la variable côté client que sous cette forme exacte.
 */
export const TENANT: Tenant = tenantFor(process.env.NEXT_PUBLIC_TENANT);

/** Retire de `list` les artistes exclus par la maison (ordre conservé). */
export function excludeArtists<T extends { id: string }>(list: T[], tenant: Tenant = TENANT): T[] {
  return list.filter((a) => !tenant.excludedArtists.includes(a.id));
}

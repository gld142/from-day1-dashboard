/**
 * La « maison » (tenant) : choisie AU BUILD par NEXT_PUBLIC_TENANT, elle règle
 * le nom, la co-marque, le roster (artistes exclus) et le sélecteur de rôle
 * métier. Deux projets Vercel, un seul code (spec Universal v2, §1).
 *
 * Pur et sans import : lu par data.ts (roster), la sidebar, le layout racine
 * (metadata) et role.tsx (artiste ouvert par défaut).
 */
export type TenantId = "day1" | "universal";

/**
 * Canaux co-brandés de l'écran /welcome?source=… (configuration dans
 * components/modules/welcome/sources.ts, textes dans messages/<locale>/welcome.json).
 */
export type WelcomeSourceId = "capitol" | "umpg" | "universal" | "believe" | "direct";

export type Tenant = {
  id: TenantId;
  /** « Day 1 Dashboard Pro » / « Day One × Universal » — le nom du label de démo. */
  name: string;
  /** Marque de la sidebar et du menu mobile. */
  shortName: string;
  /** Marque de la porte /acces. Les pages produit (connexion, inscription, espace) gardent « Day 1 Pro » dans les deux maisons. */
  publicName: string;
  tagline: string;
  /** Co-marque (null = Day 1 seul). */
  logo: { text: string; bg: string; fg: string } | null;
  /** Artistes du roster complet que cette maison ne montre pas. */
  excludedArtists: string[];
  /** Sélecteur de rôle métier dans la barre du haut (à la place des personas). */
  roles: boolean;
  /** Artiste ouvert par défaut en persona artiste (role.tsx) — jamais un exclu. */
  defaultArtistId: string;
  /**
   * Pages internes From Day 1 (`internal` dans nav.ts : comparatif, pipeline partenaires —
   * dont le pitch de Day 1 À PROPOS d'Universal). false = elles n'existent pas dans cette
   * maison : 404 réel posé par le proxy, absentes des listes, textes et libellés non envoyés
   * (`isRouteAllowedForTenant`, `internalPageMessageKeys`).
   */
  internalPages: boolean;
  /**
   * Canaux de /welcome que cette maison ouvre : `resolveSource` n'en résout pas d'autre, la
   * bascule de canal n'en liste pas d'autre, et seuls leurs textes partent vers le navigateur
   * (`pageMessages`). La maison universal n'ouvre que des entités Universal Music Group
   * (capitol, umpg, universal) et le canal direct : jamais le canal d'un autre partenaire
   * (Believe : contact nommé, positionnement de Day 1 face à DistroKid).
   */
  welcomeSources: readonly WelcomeSourceId[];
  /** Canal d'un `?source=` absent, inconnu ou fermé dans cette maison (fait partie de `welcomeSources`). */
  welcomeDefaultSource: WelcomeSourceId;
  /**
   * Tout le roster est signé en édition : chaque artiste est AUSSI auteur ou compositeur de ce
   * qu'il interprète (Gaël, 28/10/2026 : être au roster d'Universal Music Publishing, c'est avoir
   * été signé comme auteur ou compositeur). La différence qui reste : le compositeur non
   * interprète (`kind: "composer"`) vit des placements sur les disques des AUTRES.
   */
  writersRoster: boolean;
};

export const TENANTS: Record<TenantId, Tenant> = {
  day1: {
    id: "day1",
    name: "Day 1 Dashboard Pro",
    shortName: "From Day 1",
    publicName: "Day 1 Pro",
    tagline: "Dashboard 360°",
    logo: null,
    excludedArtists: ["kiko"],
    roles: false,
    defaultArtistId: "dadju",
    internalPages: true,
    welcomeSources: ["capitol", "umpg", "universal", "believe", "direct"],
    welcomeDefaultSource: "direct",
    writersRoster: false,
  },
  universal: {
    id: "universal",
    name: "Day One × Universal",
    shortName: "Day One × Universal",
    publicName: "Day One × Universal",
    tagline: "Un dashboard par métier",
    logo: { text: "UNIVERSAL", bg: "#000000", fg: "#ffffff" },
    // Kiko retiré le 28/10/2026 à la demande de Gaël (veille du rendez-vous Universal).
    excludedArtists: ["dadju", "kiko"],
    roles: true,
    defaultArtistId: "nono-la-grinta",
    internalPages: false,
    welcomeSources: ["capitol", "umpg", "universal", "direct"],
    welcomeDefaultSource: "universal",
    writersRoster: true,
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

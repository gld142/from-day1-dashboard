/**
 * Navigation canonique du dashboard.
 * `labelKey` pointe vers le namespace i18n "nav".
 * `personas` restreint l'affichage (ex : le P&L roster est réservé au label).
 * `defaultHidden` masque la page par défaut dans la navigation (l'utilisateur
 * peut la réactiver dans Réglages → Modules) ; `internal` marque les pages à
 * usage From Day 1 (pitch, pipeline partenaires), masquées pour tous.
 * Les routes restent accessibles par URL : masquer ne concerne que la navigation.
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AudioWaveform,
  BadgeEuro,
  BarChart3,
  Binoculars,
  Calculator,
  CircleDollarSign,
  Clapperboard,
  Coins,
  Crosshair,
  FileText,
  FileUp,
  Fingerprint,
  FlaskConical,
  Gauge,
  Globe2,
  Handshake,
  HeartHandshake,
  Landmark,
  LibraryBig,
  MapPin,
  MessageSquareText,
  PieChart,
  Radar,
  ReceiptEuro,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  SplitSquareHorizontal,
  Swords,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";
import type { Persona } from "@/lib/role";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  personas?: Persona[];
  badgeKey?: "new" | "beta" | "soon";
  /** Masquée par défaut pour ces personas ("all" = pour tous). */
  defaultHidden?: Persona[] | "all";
  /** Page à usage interne From Day 1 : masquée pour tous, badge « Interne » dans Réglages. */
  internal?: true;
};

/** Visibilité choisie par l'utilisateur, par href ; absent = valeur par défaut. */
export type ModuleOverrides = Record<string, boolean>;

/** Seule page jamais masquable : c'est là que l'on réactive les autres. */
export const LOCKED_MODULES: ReadonlySet<string> = new Set(["/settings"]);

export type NavSection = {
  labelKey: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "sections.daily",
    items: [
      { href: "/pulse", labelKey: "items.pulse", icon: Activity },
      { href: "/overview", labelKey: "items.overview", icon: Gauge },
      {
        href: "/roster",
        labelKey: "items.roster",
        icon: UsersRound,
        personas: ["label"],
      },
    ],
  },
  {
    labelKey: "sections.data",
    items: [
      { href: "/streams", labelKey: "items.streams", icon: AudioWaveform },
      {
        // Parts du Top 200 Spotify France par groupe / artiste / genre, relevé chaque matin.
        href: "/market",
        labelKey: "items.market",
        icon: PieChart,
        badgeKey: "new",
      },
      { href: "/revenue", labelKey: "items.revenue", icon: CircleDollarSign },
      { href: "/audience", labelKey: "items.audience", icon: Globe2 },
      {
        href: "/algo-position",
        labelKey: "items.algoposition",
        icon: Crosshair,
        badgeKey: "new",
      },
    ],
  },
  {
    labelKey: "sections.finances",
    items: [
      {
        href: "/finances",
        labelKey: "items.finances",
        icon: ReceiptEuro,
        badgeKey: "new",
      },
      {
        // Simulateur de scénarios (deals, projections) — visible par défaut
        // pour les deux personas, désactivable dans Réglages → Modules.
        href: "/calculator",
        labelKey: "items.calculator",
        icon: Calculator,
        badgeKey: "new",
      },
      {
        href: "/valuation",
        labelKey: "items.valuation",
        icon: TrendingUp,
      },
      {
        href: "/fractional",
        labelKey: "items.fractional",
        icon: Coins,
        badgeKey: "soon",
        defaultHidden: ["label"],
      },
    ],
  },
  {
    labelKey: "sections.rights",
    items: [
      {
        href: "/splits",
        labelKey: "items.splits",
        icon: SplitSquareHorizontal,
      },
      { href: "/contracts", labelKey: "items.contracts", icon: FileText },
      { href: "/rights", labelKey: "items.rights", icon: Scale },
      { href: "/urssaf", labelKey: "items.urssaf", icon: Landmark },
    ],
  },
  {
    labelKey: "sections.intelligence",
    items: [
      {
        href: "/audit",
        labelKey: "items.audit",
        icon: ShieldCheck,
        badgeKey: "beta",
      },
      { href: "/day1-index", labelKey: "items.day1index", icon: Fingerprint },
      {
        href: "/copilot",
        labelKey: "items.copilot",
        icon: MessageSquareText,
      },
      {
        href: "/ar-watch",
        labelKey: "items.arwatch",
        icon: Radar,
        personas: ["label"],
      },
    ],
  },
  {
    labelKey: "sections.growth",
    items: [
      { href: "/fans", labelKey: "items.fans", icon: HeartHandshake },
      { href: "/discovery", labelKey: "items.discovery", icon: FlaskConical },
      { href: "/sync", labelKey: "items.sync", icon: Clapperboard },
      { href: "/tour", labelKey: "items.tour", icon: MapPin },
      { href: "/catalog", labelKey: "items.catalog", icon: LibraryBig },
      { href: "/team", labelKey: "items.team", icon: Users },
    ],
  },
  {
    labelKey: "sections.pitch",
    items: [
      {
        href: "/comparatif",
        labelKey: "items.comparatif",
        icon: Swords,
        personas: ["label"],
        internal: true,
      },
      {
        href: "/onboardings",
        labelKey: "items.onboardings",
        icon: Handshake,
        personas: ["label"],
        internal: true,
      },
    ],
  },
  {
    labelKey: "sections.account",
    items: [
      {
        href: "/import",
        labelKey: "items.importer",
        icon: FileUp,
        badgeKey: "new",
      },
      { href: "/settings", labelKey: "items.settings", icon: Settings },
    ],
  },
];

/**
 * Parcours structure : ordre des sections et des pages pour le persona label.
 * Le rituel commence par le roster, les contrats ouvrent le business, l'A&R
 * suit l'audit, et l'équipe rejoint le compte. Une page absente de cette
 * liste (ajoutée plus tard à NAV_SECTIONS) garde sa section d'origine, en fin
 * de section : rien ne disparaît par oubli.
 */
const LABEL_LAYOUT: ReadonlyArray<{ labelKey: string; hrefs: string[] }> = [
  { labelKey: "sections.daily", hrefs: ["/roster", "/pulse", "/overview"] },
  {
    labelKey: "sections.data",
    hrefs: ["/streams", "/market", "/revenue", "/audience", "/algo-position"],
  },
  {
    labelKey: "sections.finances",
    hrefs: ["/finances", "/valuation", "/calculator", "/fractional"],
  },
  {
    labelKey: "sections.rights",
    hrefs: ["/contracts", "/splits", "/rights", "/urssaf"],
  },
  {
    labelKey: "sections.intelligence",
    hrefs: ["/audit", "/ar-watch", "/day1-index", "/copilot"],
  },
  {
    labelKey: "sections.growth",
    hrefs: ["/fans", "/tour", "/catalog", "/discovery", "/sync"],
  },
  { labelKey: "sections.pitch", hrefs: ["/comparatif", "/onboardings"] },
  { labelKey: "sections.account", hrefs: ["/import", "/team", "/settings"] },
];

function applyLayout(
  sections: NavSection[],
  layout: typeof LABEL_LAYOUT,
): NavSection[] {
  const byHref = new Map<string, NavItem>();
  for (const s of sections) for (const i of s.items) byHref.set(i.href, i);
  const placed = new Set<string>();
  const out: NavSection[] = layout.map((l) => ({
    labelKey: l.labelKey,
    items: l.hrefs.flatMap((href) => {
      const item = byHref.get(href);
      if (!item) return [];
      placed.add(href);
      return [item];
    }),
  }));
  // Filet : une page non listée dans le layout reste dans sa section d'origine.
  for (const s of sections) {
    for (const i of s.items) {
      if (placed.has(i.href)) continue;
      const target = out.find((o) => o.labelKey === s.labelKey);
      if (target) target.items.push(i);
      else out.push({ labelKey: s.labelKey, items: [i] });
    }
  }
  return out;
}

/** Le persona a-t-il accès à cette page (indépendamment de sa visibilité) ? */
function allowedFor(item: NavItem, persona: Persona): boolean {
  return !item.personas || item.personas.includes(persona);
}

/** Visibilité par défaut (sans choix utilisateur) pour ce persona. */
export function isVisibleByDefault(item: NavItem, persona: Persona): boolean {
  if (item.internal || item.defaultHidden === "all") return false;
  return !item.defaultHidden?.includes(persona);
}

/**
 * Toutes les pages accessibles au persona, dans son ordre, visibles ou non :
 * c'est la liste que Réglages → Modules affiche avec un interrupteur.
 */
export function navCatalogForPersona(persona: Persona): NavSection[] {
  const base = persona === "label" ? applyLayout(NAV_SECTIONS, LABEL_LAYOUT) : NAV_SECTIONS;
  return base
    .map((s) => ({ ...s, items: s.items.filter((i) => allowedFor(i, persona)) }))
    .filter((s) => s.items.length > 0);
}

/** Visibilité effective : choix utilisateur s'il existe, sinon défaut du persona. */
export function isModuleVisible(
  item: NavItem,
  persona: Persona,
  overrides: ModuleOverrides = {},
): boolean {
  if (LOCKED_MODULES.has(item.href)) return true;
  return overrides[item.href] ?? isVisibleByDefault(item, persona);
}

/** Navigation rendue : catalogue du persona, filtré par la visibilité effective. */
export function navForPersona(
  persona: Persona,
  overrides: ModuleOverrides = {},
): NavSection[] {
  return navCatalogForPersona(persona)
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => isModuleVisible(i, persona, overrides)),
    }))
    .filter((s) => s.items.length > 0);
}

/** Item de navigation par href (null si inconnu). */
export function navItemByHref(href: string): NavItem | null {
  for (const s of NAV_SECTIONS) for (const i of s.items) if (i.href === href) return i;
  return null;
}

// Icônes réexportées pour usage ponctuel dans les pages.
export const NavIcons = {
  BarChart3,
  Binoculars,
  PieChart,
  Sparkles,
  BadgeEuro,
};

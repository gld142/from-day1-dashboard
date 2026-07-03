/**
 * Navigation canonique du dashboard.
 * `labelKey` pointe vers le namespace i18n "nav".
 * `personas` restreint l'affichage (ex : le P&L roster est réservé au label).
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
  FileText,
  Fingerprint,
  Gauge,
  Globe2,
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
};

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
      { href: "/revenue", labelKey: "items.revenue", icon: CircleDollarSign },
      { href: "/audience", labelKey: "items.audience", icon: Globe2 },
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
      { href: "/tour", labelKey: "items.tour", icon: MapPin },
      { href: "/catalog", labelKey: "items.catalog", icon: LibraryBig },
      { href: "/team", labelKey: "items.team", icon: Users },
    ],
  },
  {
    labelKey: "sections.account",
    items: [{ href: "/settings", labelKey: "items.settings", icon: Settings }],
  },
];

/** Aplati, filtré par persona et par préférences de visibilité. */
export function navForPersona(
  persona: Persona,
  isHidden?: (href: string) => boolean,
): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) =>
        (!i.personas || i.personas.includes(persona)) &&
        (!isHidden || !isHidden(i.href)),
    ),
  })).filter((s) => s.items.length > 0);
}

// Icônes réexportées pour usage ponctuel dans les pages.
export const NavIcons = {
  BarChart3,
  Binoculars,
  PieChart,
  Sparkles,
  BadgeEuro,
};

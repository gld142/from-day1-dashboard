/**
 * Canaux d'acquisition co-brandés (spec §7).
 * Un canal = un partenaire qui envoie ses artistes / équipes vers Day 1 via
 * `/welcome?source=<id>`. Les textes vivent dans messages/<locale>/welcome.json ;
 * ici, uniquement la configuration structurelle (logo, persona, sidebar).
 */
export type WelcomeSource = "capitol" | "umpg" | "universal" | "believe" | "direct";

export type SourceConfig = {
  id: WelcomeSource;
  /** Logo texte du partenaire ("" pour le canal direct : pas de co-marque). */
  logo: string;
  logoBg: string;
  logoFg: string;
  /** Nombre de lignes « ce que cet onboarding résout » (clés 1..n dans welcome.json). */
  values: number;
  /** Clés de nav.json → items épinglés dans la sidebar par défaut. */
  sidebar: string[];
  /** Clés de nav.json → items cachés pour ce canal. */
  hidden: string[];
  /** Persona appliqué à l'entrée dans le dashboard (via `?persona=`). */
  persona: "artist" | "label";
  /** Première page après le CTA. */
  landing: string;
};

export const SOURCES: Record<WelcomeSource, SourceConfig> = {
  capitol: {
    id: "capitol",
    logo: "CAPITOL",
    logoBg: "#111111",
    logoFg: "#ffffff",
    values: 5,
    sidebar: ["roster", "pulse", "streams", "revenue", "audience", "contracts", "audit", "arwatch"],
    hidden: ["urssaf"],
    persona: "label",
    landing: "/roster",
  },
  umpg: {
    id: "umpg",
    logo: "UNIVERSAL MUSIC PUBLISHING",
    logoBg: "#1d1d1f",
    logoFg: "#ffffff",
    values: 5,
    sidebar: ["pulse", "revenue", "rights", "splits", "valuation", "audit", "day1index", "contracts"],
    hidden: ["arwatch"],
    persona: "artist",
    landing: "/pulse",
  },
  universal: {
    id: "universal",
    logo: "UNIVERSAL",
    logoBg: "#000000",
    logoFg: "#ffffff",
    values: 5,
    sidebar: ["roster", "pulse", "streams", "revenue", "contracts", "audit", "arwatch", "rights"],
    hidden: ["urssaf"],
    persona: "label",
    landing: "/roster",
  },
  believe: {
    id: "believe",
    logo: "BELIEVE",
    logoBg: "#FFD400",
    logoFg: "#0A0A0F",
    values: 4,
    sidebar: ["pulse", "streams", "revenue", "audit", "splits", "rights", "day1index"],
    hidden: ["arwatch", "roster"],
    persona: "artist",
    landing: "/pulse",
  },
  direct: {
    id: "direct",
    logo: "",
    logoBg: "transparent",
    logoFg: "inherit",
    values: 3,
    sidebar: ["pulse", "streams", "revenue", "audit"],
    hidden: [],
    persona: "artist",
    landing: "/pulse",
  },
};

export const SOURCE_IDS = Object.keys(SOURCES) as WelcomeSource[];

/** Résout `?source=` (string, tableau ou absent) vers un canal connu, sinon direct. */
export function resolveSource(raw: string | string[] | undefined): SourceConfig {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s && s in SOURCES ? SOURCES[s as WelcomeSource] : SOURCES.direct;
}

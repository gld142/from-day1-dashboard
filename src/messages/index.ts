import type { Locale } from "@/i18n/config";
import { TENANT, type Tenant } from "@/lib/tenant";

/* ─── Namespaces communs ─── */
import frCommon from "./fr/common.json";
import enCommon from "./en/common.json";
import frNav from "./fr/nav.json";
import enNav from "./en/nav.json";

/* ─── Namespaces modules (un fichier = un module, éditable en parallèle) ─── */
import frPulse from "./fr/pulse.json";
import enPulse from "./en/pulse.json";
import frStreams from "./fr/streams.json";
import enStreams from "./en/streams.json";
import frPlacements from "./fr/placements.json";
import enPlacements from "./en/placements.json";
import frMarket from "./fr/market.json";
import enMarket from "./en/market.json";
import frRevenue from "./fr/revenue.json";
import enRevenue from "./en/revenue.json";
import frAudience from "./fr/audience.json";
import enAudience from "./en/audience.json";
import frFinances from "./fr/finances.json";
import enFinances from "./en/finances.json";
import frCalculator from "./fr/calculator.json";
import enCalculator from "./en/calculator.json";
import frSplits from "./fr/splits.json";
import enSplits from "./en/splits.json";
import frContracts from "./fr/contracts.json";
import enContracts from "./en/contracts.json";
import frRights from "./fr/rights.json";
import enRights from "./en/rights.json";
import frUrssaf from "./fr/urssaf.json";
import enUrssaf from "./en/urssaf.json";
import frAudit from "./fr/audit.json";
import enAudit from "./en/audit.json";
import frValuation from "./fr/valuation.json";
import enValuation from "./en/valuation.json";
import frDay1Index from "./fr/day1index.json";
import enDay1Index from "./en/day1index.json";
import frCopilot from "./fr/copilot.json";
import enCopilot from "./en/copilot.json";
import frFans from "./fr/fans.json";
import enFans from "./en/fans.json";
import frTour from "./fr/tour.json";
import enTour from "./en/tour.json";
import frArWatch from "./fr/arwatch.json";
import enArWatch from "./en/arwatch.json";
import frRoster from "./fr/roster.json";
import enRoster from "./en/roster.json";
import frCatalog from "./fr/catalog.json";
import enCatalog from "./en/catalog.json";
import frTeam from "./fr/team.json";
import enTeam from "./en/team.json";
import frSettings from "./fr/settings.json";
import frBrief from "./fr/brief.json";
import enBrief from "./en/brief.json";
import frAlgoPosition from "./fr/algoposition.json";
import enAlgoPosition from "./en/algoposition.json";
import frDiscovery from "./fr/discovery.json";
import enDiscovery from "./en/discovery.json";
import frSync from "./fr/sync.json";
import enSync from "./en/sync.json";
import frFractional from "./fr/fractional.json";
import enFractional from "./en/fractional.json";
import frComparatif from "./fr/comparatif.json";
import enComparatif from "./en/comparatif.json";
import frOnboardings from "./fr/onboardings.json";
import enOnboardings from "./en/onboardings.json";
import frImporter from "./fr/importer.json";
import enImporter from "./en/importer.json";
import frAsk from "./fr/ask.json";
import enAsk from "./en/ask.json";
import frWelcome from "./fr/welcome.json";
import enWelcome from "./en/welcome.json";
import frFil from "./fr/fil.json";
import enFil from "./en/fil.json";
import enSettings from "./en/settings.json";

const MESSAGES = {
  fr: {
    common: frCommon,
    nav: frNav,
    pulse: frPulse,
    streams: frStreams,
    market: frMarket,
    placements: frPlacements,
    revenue: frRevenue,
    audience: frAudience,
    finances: frFinances,
    calculator: frCalculator,
    splits: frSplits,
    contracts: frContracts,
    rights: frRights,
    urssaf: frUrssaf,
    audit: frAudit,
    valuation: frValuation,
    day1index: frDay1Index,
    copilot: frCopilot,
    fans: frFans,
    tour: frTour,
    arwatch: frArWatch,
    roster: frRoster,
    catalog: frCatalog,
    team: frTeam,
    settings: frSettings,
    algoposition: frAlgoPosition,
    discovery: frDiscovery,
    sync: frSync,
    fractional: frFractional,
    comparatif: frComparatif,
    onboardings: frOnboardings,
    importer: frImporter,
    brief: frBrief,
    ask: frAsk,
    welcome: frWelcome,
    fil: frFil,
  },
  en: {
    common: enCommon,
    nav: enNav,
    pulse: enPulse,
    streams: enStreams,
    market: enMarket,
    placements: enPlacements,
    revenue: enRevenue,
    audience: enAudience,
    finances: enFinances,
    calculator: enCalculator,
    splits: enSplits,
    contracts: enContracts,
    rights: enRights,
    urssaf: enUrssaf,
    audit: enAudit,
    valuation: enValuation,
    day1index: enDay1Index,
    copilot: enCopilot,
    fans: enFans,
    tour: enTour,
    arwatch: enArWatch,
    roster: enRoster,
    catalog: enCatalog,
    team: enTeam,
    settings: enSettings,
    algoposition: enAlgoPosition,
    discovery: enDiscovery,
    sync: enSync,
    fractional: enFractional,
    comparatif: enComparatif,
    onboardings: enOnboardings,
    importer: enImporter,
    brief: enBrief,
    ask: enAsk,
    welcome: enWelcome,
    fil: enFil,
  },
} as const;

/**
 * Namespaces lus SEULEMENT par les pages internes From Day 1 (nav.ts, `internal`) :
 * /comparatif (comparison-table) et /onboardings (partner-board, dont le pitch de Day 1
 * À PROPOS d'Universal). Ils ne partent vers le navigateur qu'avec leur propre page
 * (`internalPageMessages`), jamais avec le fournisseur racine (`rootClientMessages`).
 */
export const INTERNAL_NAMESPACES = ["comparatif", "onboardings"] as const;
export type InternalNamespace = (typeof INTERNAL_NAMESPACES)[number];

type AllMessages = (typeof MESSAGES)[Locale];
type RootClientMessages = Omit<AllMessages, InternalNamespace>;

function withoutInternal(messages: AllMessages | RootClientMessages): RootClientMessages {
  return Object.fromEntries(
    Object.entries(messages).filter(([ns]) => !(INTERNAL_NAMESPACES as readonly string[]).includes(ns)),
  ) as RootClientMessages;
}

/**
 * Les messages de la requête (i18n/request.ts) : ce que lisent les composants SERVEUR
 * (`getTranslations`). Une maison sans pages internes (`tenant.internalPages`) ne reçoit pas
 * leurs textes, même côté serveur.
 */
export function getMessages(locale: Locale, tenant: Tenant = TENANT) {
  const all = MESSAGES[locale];
  if (tenant.internalPages) return all;
  return withoutInternal(all);
}

/**
 * Les messages du NextIntlClientProvider RACINE (app/layout.tsx), sérialisés dans CHAQUE page,
 * /connexion et /inscription comprises (publiques, sans porte). Sans prop `messages`, next-intl 4
 * (`NextIntlClientProviderServer`) hérite de tout `getMessages()` : mesuré le 24/10/2026, le pitch
 * « Universal détient la donnée… » et le nom de son contact se lisaient dans le HTML de /connexion
 * de la maison day1 (et de la maison universal avant f12fb51). Dans les deux maisons, la racine
 * n'envoie donc AUCUN namespace interne.
 */
export function rootClientMessages(locale: Locale, tenant: Tenant = TENANT): RootClientMessages {
  return withoutInternal(getMessages(locale, tenant));
}

/**
 * Les messages d'un fournisseur IMBRIQUÉ autour d'une page interne : les messages racine plus les
 * namespaces demandés. Il faut les deux : un IntlProvider imbriqué ne fusionne pas avec le parent
 * (use-intl : `messages` fourni remplace celui du contexte). Une maison sans pages internes n'en
 * reçoit aucun, même demandé (la page appelle `notFound()` avant ; ceci est la défense en
 * profondeur).
 */
export function internalPageMessages(
  locale: Locale,
  namespaces: readonly InternalNamespace[],
  tenant: Tenant = TENANT,
): RootClientMessages & Partial<Pick<AllMessages, InternalNamespace>> {
  const root = rootClientMessages(locale, tenant);
  if (!tenant.internalPages) return root;
  const all = MESSAGES[locale];
  return { ...root, ...Object.fromEntries(namespaces.map((ns) => [ns, all[ns]])) };
}

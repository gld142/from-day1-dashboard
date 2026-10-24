import type { Locale } from "@/i18n/config";
import { internalPageMessageKeys } from "@/lib/nav";
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
 * Les namespaces, clés de `MESSAGES` communes aux deux langues : les listes ci-dessous en sont
 * typées (`satisfies`), une faute de frappe y échoue à `tsc` sur la ligne même de la liste.
 */
type Namespace = keyof (typeof MESSAGES)[Locale];

/**
 * Namespaces lus SEULEMENT par les pages internes From Day 1 (nav.ts, `internal`) :
 * /comparatif (comparison-table) et /onboardings (partner-board, dont le pitch de Day 1
 * À PROPOS d'Universal). Namespaces « de page » (ci-dessous) ; une maison sans pages internes
 * (`tenant.internalPages`) ne les reçoit pas du tout, même côté serveur.
 */
export const INTERNAL_NAMESPACES = ["comparatif", "onboardings"] as const satisfies readonly Namespace[];
type InternalNamespace = (typeof INTERNAL_NAMESPACES)[number];

/**
 * Namespaces « DE PAGE » : ils ne partent vers le navigateur qu'avec la page qui les lit, dans un
 * fournisseur imbriqué autour de sa vue (`pageMessages`, i18n/intl-providers.tsx), jamais avec le
 * fournisseur racine (`rootClientMessages`), sérialisé dans CHAQUE page — /connexion et
 * /inscription comprises (publiques, sans porte).
 * - comparatif, onboardings : les pages internes (INTERNAL_NAMESPACES).
 * - welcome : l'écran co-brandé /welcome?source=… (seul lecteur : cobrand-screen.tsx). Un bloc par
 *   partenaire, dont Believe (contact nommé, positionnement face à DistroKid) ; chaque maison n'en
 *   reçoit que ses canaux (`tenant.welcomeSources`). Mesuré le 24/10/2026 (curl) : tout le
 *   namespace, bloc Believe compris, se lisait dans le HTML de /connexion et /inscription des deux
 *   maisons.
 */
export const PAGE_SCOPED_NAMESPACES = [...INTERNAL_NAMESPACES, "welcome"] as const satisfies readonly Namespace[];
export type PageScopedNamespace = (typeof PAGE_SCOPED_NAMESPACES)[number];

/**
 * Namespaces de page absents des messages de la REQUÊTE (`getMessages`) dans toutes les maisons :
 * leur contenu dépend de la maison (welcome : ses canaux) et aucun composant serveur ne les lit.
 * Hors de la requête, un `<NextIntlClientProvider>` rendu sans `messages` (qui hérite de tout
 * `getMessages()`) ne peut pas les emporter, et la maison universal ne porte jamais le bloc d'un
 * autre partenaire, même côté serveur. Un composant serveur qui en aurait besoin passerait par
 * `pageMessages`.
 */
const PAGE_ONLY_NAMESPACES = ["welcome"] as const satisfies readonly PageScopedNamespace[];

type AllMessages = (typeof MESSAGES)[Locale];
type RootClientMessages = Omit<AllMessages, PageScopedNamespace>;
type WelcomeMessages = AllMessages["welcome"];
/** welcome tel qu'une maison le reçoit : les seuls canaux qu'elle ouvre. */
type HouseWelcomeMessages = Omit<WelcomeMessages, "sources"> & { sources: Partial<WelcomeMessages["sources"]> };
type PageScopedMessages = Pick<AllMessages, InternalNamespace> & { welcome: HouseWelcomeMessages };

function without<T extends object, K extends string>(messages: T, namespaces: readonly K[]): Omit<T, K> {
  const drop: readonly string[] = namespaces;
  return Object.fromEntries(Object.entries(messages).filter(([ns]) => !drop.includes(ns))) as Omit<T, K>;
}

/** `obj` sans la clé au bout de `path` ; les branches non touchées gardent leur référence. */
function omitPath(obj: Record<string, unknown>, [head, ...rest]: readonly string[]): Record<string, unknown> {
  if (!Object.hasOwn(obj, head)) return obj;
  if (rest.length === 0) return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== head));
  const child = obj[head];
  if (typeof child !== "object" || child === null) return obj;
  return { ...obj, [head]: omitPath(child as Record<string, unknown>, rest) };
}

/** Un namespace sans les clés à points données (« items.onboardings », « modules.desc.comparatif »). */
function omitKeys<T extends object>(ns: T, dotted: readonly string[]): T {
  let out = ns as Record<string, unknown>;
  for (const key of dotted) out = omitPath(out, key.split("."));
  return out as T;
}

/** nav et settings tels qu'une maison SANS pages internes les reçoit (calculés une fois par langue). */
type CommonLabels = Pick<AllMessages, "nav" | "settings">;
const LABELS_WITHOUT_INTERNAL_PAGES = new Map<Locale, CommonLabels>();

/**
 * Les libellés des pages internes vivent aussi dans des namespaces COMMUNS, partis avec le
 * fournisseur racine sur toutes les pages : leur nom dans la navigation et la palette (nav) et leur
 * description dans Réglages → Modules (settings). Mesuré le 24/10/2026 (curl, HTML de /connexion de
 * la maison universal, 3006) : « Onboardings partenaires » 1, « usage interne » 1. La liste des clés
 * est DÉRIVÉE de nav.ts (`internalPageMessageKeys` : items `internal`, et la section dont toutes
 * les pages le sont), jamais écrite ici. Mémorisé : deux appels rendent les mêmes objets (les
 * messages sont statiques), comme les autres namespaces.
 */
function labelsWithoutInternalPages(locale: Locale): CommonLabels {
  let labels = LABELS_WITHOUT_INTERNAL_PAGES.get(locale);
  if (!labels) {
    const keys = internalPageMessageKeys();
    labels = {
      nav: omitKeys(MESSAGES[locale].nav, keys.nav),
      settings: omitKeys(MESSAGES[locale].settings, keys.settingsDesc.map((k) => `modules.desc.${k}`)),
    };
    LABELS_WITHOUT_INTERNAL_PAGES.set(locale, labels);
  }
  return labels;
}

/**
 * Les messages de la requête (i18n/request.ts) : ce que lisent les composants SERVEUR
 * (`getTranslations`), et la base de tous les fournisseurs. Jamais les namespaces de page
 * « seulement » (PAGE_ONLY_NAMESPACES) ; une maison sans pages internes (`tenant.internalPages`) ne
 * reçoit pas non plus leurs textes : ni leurs namespaces, ni leurs libellés dans nav et settings
 * (aucune de ses listes ne cite ces pages, aucun composant serveur ne lit nav).
 */
export function getMessages(locale: Locale, tenant: Tenant = TENANT) {
  const request = without(MESSAGES[locale], PAGE_ONLY_NAMESPACES);
  if (tenant.internalPages) return request;
  return { ...without(request, INTERNAL_NAMESPACES), ...labelsWithoutInternalPages(locale) };
}

/**
 * Les messages du NextIntlClientProvider RACINE (app/layout.tsx), sérialisés dans CHAQUE page,
 * /connexion et /inscription comprises (publiques, sans porte). Sans prop `messages`, next-intl 4
 * (`NextIntlClientProviderServer`) hérite de tout `getMessages()` : mesuré le 24/10/2026, le pitch
 * « Universal détient la donnée… » et le nom de son contact se lisaient dans le HTML de /connexion
 * de la maison day1 (et de la maison universal avant f12fb51), puis, le même jour, le bloc Believe
 * de welcome dans celui des deux maisons. Dans les deux maisons, la racine n'envoie donc AUCUN
 * namespace de page.
 */
export function rootClientMessages(locale: Locale, tenant: Tenant = TENANT): RootClientMessages {
  return without(getMessages(locale, tenant), PAGE_SCOPED_NAMESPACES) as RootClientMessages;
}

/** welcome d'une maison : ses seuls canaux (`tenant.welcomeSources`), le reste à l'identique. */
function houseWelcome(locale: Locale, tenant: Tenant): HouseWelcomeMessages {
  const { sources, ...rest } = MESSAGES[locale].welcome;
  const open: readonly string[] = tenant.welcomeSources;
  return { ...rest, sources: Object.fromEntries(Object.entries(sources).filter(([id]) => open.includes(id))) };
}

/**
 * Les messages d'un fournisseur IMBRIQUÉ autour de la vue d'une page : les messages racine plus les
 * namespaces de page demandés, tels que la maison les reçoit. Il faut les deux : un IntlProvider
 * imbriqué ne fusionne pas avec le parent (use-intl : `messages` fourni remplace celui du
 * contexte).
 * - page interne : rien dans une maison sans pages internes, même demandé (la page appelle
 *   `notFound()` avant ; ceci est la défense en profondeur) ;
 * - welcome : les seuls canaux de la maison (la maison universal ne reçoit pas le bloc Believe).
 */
export function pageMessages(
  locale: Locale,
  namespaces: readonly PageScopedNamespace[],
  tenant: Tenant = TENANT,
): RootClientMessages & Partial<PageScopedMessages> {
  const scoped: Partial<PageScopedMessages> = {};
  for (const ns of namespaces) {
    if (ns === "welcome") scoped.welcome = houseWelcome(locale, tenant);
    else if (tenant.internalPages) Object.assign(scoped, { [ns]: MESSAGES[locale][ns] });
  }
  return { ...rootClientMessages(locale, tenant), ...scoped };
}

import type { Locale } from "@/i18n/config";

/* ─── Namespaces communs ─── */
import frCommon from "./fr/common.json";
import enCommon from "./en/common.json";
import frNav from "./fr/nav.json";
import enNav from "./en/nav.json";

/* ─── Namespaces modules (un fichier = un module, éditable en parallèle) ─── */
import frPulse from "./fr/pulse.json";
import enPulse from "./en/pulse.json";
import frOverview from "./fr/overview.json";
import enOverview from "./en/overview.json";
import frStreams from "./fr/streams.json";
import enStreams from "./en/streams.json";
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
import enSettings from "./en/settings.json";

const MESSAGES = {
  fr: {
    common: frCommon,
    nav: frNav,
    pulse: frPulse,
    overview: frOverview,
    streams: frStreams,
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
  },
  en: {
    common: enCommon,
    nav: enNav,
    pulse: enPulse,
    overview: enOverview,
    streams: enStreams,
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
  },
} as const;

export function getMessages(locale: Locale) {
  return MESSAGES[locale];
}

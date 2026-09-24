export {
  hasRealData,
  latestSnapshot,
  realCountryBreakdown,
  realDailyEstimates,
  realMonthlyListeners,
  realProvenanceByDsp,
  realStreamSeries,
  realTopTracks,
  spotifyDailyByTrack,
} from "./real-source";
export { ESTIMATE_PERIODS, PERIOD_DAYS, estimateDay, summarize, weakest, type DeclaredShares } from "./estimator";
export { calibrationFromUserData, type Calibration } from "./calibration";
export { auditGap, simulatedStatement } from "./audit-gap";
export { tiktokSignal } from "./tiktok-signal";
export {
  groupOf as marketGroupOf,
  marketDates,
  marketMeta,
  marketSnapshot,
  morningReading,
  rosterTrackCount,
  sharesBy as marketSharesBy,
  type MarketDimension,
  type MarketMeta,
  type MarketMetric,
  type MarketShareRow,
  type MarketWithin,
  type MorningReading,
  type RosterPresence,
  type RosterRef,
} from "./market";
export { INDIES as MARKET_INDIES, MAJORS as MARKET_MAJORS, MARKET_GROUPS, classifyLabel } from "./market/groups";
export type {
  Confidence,
  DailyEstimate,
  EstimatePeriod,
  EstimateSummary,
  MarketGenre,
  MarketGroup,
  MarketSnapshot,
  MarketTrack,
  Provenance,
  Range,
  Snapshot,
  TikTokSignal,
  TikTokSnapshot,
  TikTokSound,
} from "./types";
export { MARKET_GENRES } from "./types";

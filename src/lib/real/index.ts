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
export { ESTIMATE_PERIODS, PERIOD_DAYS, estimateDay, summarize, weakest } from "./estimator";
export { calibrationFromUserData, type Calibration } from "./calibration";
export { auditGap, simulatedStatement } from "./audit-gap";
export { tiktokSignal } from "./tiktok-signal";
export type {
  Confidence,
  DailyEstimate,
  EstimatePeriod,
  EstimateSummary,
  Provenance,
  Range,
  Snapshot,
  TikTokSignal,
  TikTokSnapshot,
  TikTokSound,
} from "./types";

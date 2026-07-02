/**
 * Modèle de domaine Day 1 Dashboard.
 * Ces types sont le CONTRAT : le futur backend exposera les mêmes formes.
 */

export type DSP =
  | "spotify"
  | "apple"
  | "youtube"
  | "deezer"
  | "tiktok"
  | "amazon"
  | "other";

export const DSPS: DSP[] = [
  "spotify",
  "apple",
  "youtube",
  "deezer",
  "tiktok",
  "amazon",
  "other",
];

export type CareerStage = "emerging" | "developing" | "established" | "peak";

export type Artist = {
  id: string;
  name: string;
  genre: string;
  /** Teinte de signature (0-360) — gradient identitaire façon Arc Spaces. */
  hue: number;
  initials: string;
  monthlyListeners: number;
  /** Croissance mensuelle des streams (ex : 0.06 = +6 %/mois). */
  growthRate: number;
  careerStage: CareerStage;
  day1Index: number; // 0-100
  signedSince: string; // ISO date
  dealType: "licence" | "distribution" | "artiste" | "indé";
  country: string;
};

export type Project = {
  id: string;
  artistId: string;
  title: string;
  type: "album" | "ep" | "single";
  releaseDate: string; // ISO
  year: number;
};

export type Track = {
  id: string;
  artistId: string;
  projectId: string;
  title: string;
  isrc: string;
  releaseDate: string;
  durationSec: number;
  /** Poids relatif du titre dans les streams de l'artiste (somme ≈ 1). */
  weight: number;
};

export type StreamPoint = {
  date: string; // ISO day
  dsp: DSP;
  streams: number;
};

export type RevenueSource =
  | "streaming"
  | "sacem"
  | "neighboring" // droits voisins ADAMI/SPEDIDAM
  | "spre"
  | "sync"
  | "live"
  | "merch";

export const REVENUE_SOURCES: RevenueSource[] = [
  "streaming",
  "sacem",
  "neighboring",
  "spre",
  "sync",
  "live",
  "merch",
];

export type RevenuePoint = {
  month: string; // "2026-03"
  source: RevenueSource;
  amount: number; // EUR
  artistId: string;
};

export type ExpenseCategory =
  | "studio"
  | "clip"
  | "marketing"
  | "distribution"
  | "promo"
  | "tour"
  | "other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "studio",
  "clip",
  "marketing",
  "distribution",
  "promo",
  "tour",
  "other",
];

export type Expense = {
  id: string;
  artistId: string;
  projectId?: string;
  trackId?: string;
  category: ExpenseCategory;
  label: string;
  amount: number; // EUR
  date: string; // ISO day
  addedBy: string; // team member id
  source: "manual" | "wavely";
};

export type SplitShare = {
  name: string;
  role: "auteur" | "compositeur" | "interprète" | "producteur" | "feat";
  share: number; // 0-100
  signed: boolean;
};

export type TrackSplit = {
  trackId: string;
  shares: SplitShare[];
  status: "signed" | "pending" | "draft";
  updatedAt: string;
};

export type Contract = {
  id: string;
  artistId: string;
  type: "licence" | "distribution" | "édition" | "management" | "booking";
  counterparty: string;
  startDate: string;
  endDate: string;
  royaltyRate: number; // %
  advance: number; // EUR
  recoupedPct: number; // 0-100
  territory: string;
  exclusive: boolean;
  alerts: ContractAlert[];
};

export type ContractAlert = {
  kind: "expiry" | "option" | "audit-window" | "unusual-clause";
  message: { fr: string; en: string };
  severity: "info" | "warning" | "danger";
  dueDate?: string;
};

export type RightsOrganism = "sacem" | "adami" | "spedidam" | "spre";

export type RightsStatement = {
  id: string;
  artistId: string;
  organism: RightsOrganism;
  period: string; // "2025-T4"
  expected: number; // EUR estimé par Day 1
  received: number; // EUR reçu
  status: "received" | "pending" | "gap-detected";
};

export type AuditFinding = {
  id: string;
  artistId: string;
  source: string; // ex: "Spotify via label" | "SACEM"
  period: string;
  expected: number;
  reported: number;
  confidence: number; // 0-1
  status: "open" | "letter-generated" | "resolved";
};

export type TourDate = {
  id: string;
  artistId: string;
  date: string;
  city: string;
  country: string;
  venue: string;
  capacity: number;
  ticketsSold: number;
  grossRevenue: number;
  status: "past" | "upcoming";
};

export type FanSegment = {
  id: "superfans" | "engaged" | "casual" | "dormant";
  count: number;
  trend: number; // delta 30j en %
};

export type TeamMember = {
  id: string;
  name: string;
  role: "owner" | "manager" | "marketing" | "comptable" | "avocat";
  artistAccess: string[] | "all";
  modules: string[] | "all";
  lastActive: string;
};

export type EmergingArtist = {
  id: string;
  name: string;
  genre: string;
  country: string;
  monthlyListeners: number;
  momentum30d: number; // % growth
  day1Index: number;
  watchlisted: boolean;
  hue: number;
};

export type CountryStreams = {
  /** Code ISO-3166 alpha-3 (pour la carte topojson). */
  iso3: string;
  nameFr: string;
  nameEn: string;
  streams: number;
};

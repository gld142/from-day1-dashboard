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

/**
 * D'où vient un chiffre — affiché dans l'UI, jamais caché.
 * « declared » : saisi par l'utilisateur (pourcentages du contrat, contrat
 * importé) — plus fiable qu'une reconstitution, moins qu'une mesure.
 */
export type Provenance = "measured" | "declared" | "reconstructed" | "estimated" | "simulated";

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
  /**
   * Le métier. Un interprète vit de SES streams ; un auteur-compositeur vit
   * des œuvres qu'il écrit pour d'AUTRES — deux économies, deux lectures.
   *
   * Signature mesurée le 25/09/2026 : Zeg P fait 1 112 230 auditeurs mensuels
   * pour 39 001 abonnés (28 pour 1) quand Dadju fait 6 502 787 pour 8 899 820
   * (0,73 pour 1). On écoute un compositeur sans le suivre, parce qu'on suit
   * l'artiste qu'il produit.
   */
  kind?: "performer" | "composer";
  /** Éditeur qui le représente — null s'il est en auto-édition. */
  publisher?: { name: string; sharePct: number } | null;
  country: string;
  /** Identifiants externes (artistes réels de la démo). */
  spotifyId?: string;
  deezerId?: string;
  youtubeChannelId?: string;
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
  provenance?: Provenance;
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
  /**
   * Identifiant stable du poste (`studioMix`, `tourTransport`…) que la
   * présentation traduit via `finances.register.labels.<id>` — ou le texte
   * saisi par l'utilisateur pour une dépense ajoutée à la main, qui n'a pas de
   * traduction et s'affiche tel quel.
   */
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
  /**
   * D'où vient l'attendu : « estimated » quand il sort de l'estimateur (artistes
   * réels : part auteur de l'édition sur le brut master), « simulated » sinon.
   * Optionnel : l'ancien code qui construit des relevés reste valide.
   */
  expectedProvenance?: Provenance;
  /** Le reçu est un relevé simulé pour la démo — jusqu'à l'import d'un vrai relevé de répartition. */
  receivedProvenance?: Provenance;
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

/* ─────────────────────────── Synchro ─────────────────────────── */

export const SYNC_MOODS = [
  "melancholic",
  "energetic",
  "nocturnal",
  "cinematic",
  "dreamy",
  "dark",
  "uplifting",
  "raw",
] as const;
export type SyncMood = (typeof SYNC_MOODS)[number];

export type SyncBriefType = "tv" | "series" | "game" | "film";

/** Un brief de synchro ouvert : qui cherche, pour quoi, jusqu'à quand. */
export type SyncBrief = {
  id: string;
  brand: string;
  type: SyncBriefType;
  budgetLow: number;
  budgetHigh: number;
  /** ISO, recalculée à chaque build depuis un décalage en jours. */
  deadline: string;
  mood: SyncMood;
};

/* ─────────────────────────── Œuvres & placements ─────────────────────────── */

/**
 * Une œuvre placée chez un autre artiste.
 *
 * `released` : sortie, elle génère des droits.
 * `unreleased` : signée et datée, elle ne rapporte encore rien — c'est le
 *   carnet de commandes, invisible partout ailleurs dans le dashboard.
 * `pitched` : proposée, pas encore retenue. Ne jamais l'additionner aux deux
 *   autres : ce n'est pas un revenu à venir, c'est une chance.
 */
export type PlacementStatus = "released" | "unreleased" | "pitched";

export type Placement = {
  id: string;
  /** L'auteur-compositeur du roster. */
  artistId: string;
  title: string;
  /** L'interprète, qui n'est pas forcément du roster. */
  performer: string;
  roles: Array<"auteur" | "compositeur" | "producteur">;
  /** Sa part d'écriture sur l'œuvre, en % (0-100). */
  writerSharePct: number;
  /** Points de production sur le master, en % (0 s'il n'a pas produit). */
  producerPointsPct: number;
  status: PlacementStatus;
  /** ISO. Date de sortie, ou date visée si l'œuvre n'est pas sortie. */
  date: string;
  /** Déclarée à la SACEM ? Non déclarée = argent jamais perçu. */
  declared: boolean;
  /** Streams cumulés estimés de l'œuvre — 0 tant qu'elle n'est pas sortie. */
  streams: number;
};

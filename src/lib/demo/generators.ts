/**
 * Générateurs de séries temporelles déterministes.
 * Tendance + saisonnalité hebdo + pics de sortie + bruit — le tout seedé :
 * le serveur et le client produisent exactement les mêmes chiffres.
 */
import { ARTISTS, PROJECTS, TRACKS, getArtist } from "./data";
import { daysAgo, isoDay, isoMonth, monthsAgo, rngFor, DEMO_TODAY } from "./seed";
import type {
  AuditFinding,
  CountryStreams,
  DSP,
  Expense,
  ExpenseCategory,
  FanSegment,
  RevenuePoint,
  RevenueSource,
  RightsStatement,
  StreamPoint,
  TourDate,
} from "./types";
import { DSPS } from "./types";

/* ─────────────────────────── Streams ─────────────────────────── */

const DSP_SHARE: Record<DSP, number> = {
  spotify: 0.54,
  apple: 0.14,
  youtube: 0.12,
  deezer: 0.08,
  tiktok: 0.06,
  amazon: 0.035,
  other: 0.025,
};

/** Streams quotidiens de base ≈ auditeurs mensuels × facteur d'écoute. */
function dailyBase(artistId: string): number {
  const a = getArtist(artistId);
  return (a.monthlyListeners * 2.6) / 30;
}

function releaseBoost(artistId: string, date: Date): number {
  let boost = 0;
  for (const p of PROJECTS.filter((p) => p.artistId === artistId)) {
    const rel = new Date(p.releaseDate);
    const diff = (date.getTime() - rel.getTime()) / 86_400_000;
    if (diff >= 0) {
      const scale = p.type === "album" ? 1.9 : p.type === "ep" ? 1.25 : 0.9;
      // Pic à J+2 puis décroissance exponentielle sur ~90 jours.
      boost += scale * Math.exp(-diff / 38) * (diff < 2 ? 0.7 + diff * 0.15 : 1);
    }
  }
  return boost;
}

/** Série quotidienne par DSP sur `days` jours (défaut 365). */
export function streamSeries(artistId: string, days = 365): StreamPoint[] {
  const a = getArtist(artistId);
  const base = dailyBase(artistId);
  const out: StreamPoint[] = [];
  for (const dsp of DSPS) {
    const rand = rngFor(`${artistId}:streams:${dsp}`);
    for (let i = days - 1; i >= 0; i--) {
      const date = daysAgo(i);
      const t = (days - 1 - i) / 365;
      const trend = Math.pow(1 + a.growthRate, t * 12);
      const dow = date.getUTCDay();
      const weekly = dow === 5 || dow === 6 ? 1.14 : dow === 0 ? 1.06 : 1;
      const spike = 1 + releaseBoost(artistId, date);
      const noise = 0.9 + rand() * 0.2;
      out.push({
        date: isoDay(date),
        dsp,
        streams: Math.round(base * DSP_SHARE[dsp] * trend * weekly * spike * noise),
      });
    }
  }
  return out;
}

/** Agrégat quotidien tous DSP confondus. */
export function dailyTotals(artistId: string, days = 365) {
  const byDay = new Map<string, number>();
  for (const p of streamSeries(artistId, days)) {
    byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.streams);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, streams]) => ({ date, streams }));
}

/* ─────────────────────────── Revenus ─────────────────────────── */

const STREAM_RATE = 0.0032; // € / stream moyen pondéré

/** Part relative de chaque source hors streaming, par artiste. */
function sourceProfile(artistId: string): Record<RevenueSource, number> {
  const a = getArtist(artistId);
  const live = a.careerStage === "established" ? 0.55 : a.careerStage === "developing" ? 0.3 : 0.12;
  return {
    streaming: 1, // calculé à part
    sacem: 0.16,
    neighboring: 0.07,
    spre: 0.03,
    sync: 0.05,
    live,
    merch: a.careerStage === "established" ? 0.12 : 0.05,
  };
}

/** Revenus mensuels par source sur `months` mois (défaut 24). */
export function revenueSeries(artistId: string, months = 24): RevenuePoint[] {
  const out: RevenuePoint[] = [];
  const profile = sourceProfile(artistId);
  const rand = rngFor(`${artistId}:revenue`);

  for (let i = months - 1; i >= 0; i--) {
    const m = monthsAgo(i);
    const month = isoMonth(m);
    const a = getArtist(artistId);
    const monthlyStreams = (getArtist(artistId).monthlyListeners * 2.6) *
      Math.pow(1 + a.growthRate, -(i - 0)) ;
    const streaming = monthlyStreams * STREAM_RATE * (0.92 + rand() * 0.16);

    out.push({ month, source: "streaming", amount: Math.round(streaming), artistId });

    // SACEM : versements trimestriels (janv/avr/juil/oct), sinon résiduel.
    const mm = m.getUTCMonth();
    const sacemQuarter = mm % 3 === 0 ? 3.1 : 0.12;
    out.push({
      month,
      source: "sacem",
      amount: Math.round(streaming * profile.sacem * sacemQuarter * (0.85 + rand() * 0.3)),
      artistId,
    });

    // Droits voisins : 2 versements/an (juin, décembre).
    const neighboring = mm === 5 || mm === 11 ? 5.6 : 0.06;
    out.push({
      month,
      source: "neighboring",
      amount: Math.round(streaming * profile.neighboring * neighboring * (0.8 + rand() * 0.4)),
      artistId,
    });

    out.push({
      month,
      source: "spre",
      amount: Math.round(streaming * profile.spre * (mm === 5 || mm === 11 ? 4.2 : 0.05)),
      artistId,
    });

    // Sync : rare et grumeleux.
    const syncHit = rand() < 0.14;
    out.push({
      month,
      source: "sync",
      amount: syncHit ? Math.round(2000 + rand() * 14000) : 0,
      artistId,
    });

    // Live : saison été + tournées.
    const liveSeason = mm >= 4 && mm <= 8 ? 1.8 : mm === 10 || mm === 2 ? 1.1 : 0.35;
    out.push({
      month,
      source: "live",
      amount: Math.round(streaming * profile.live * liveSeason * (0.7 + rand() * 0.6)),
      artistId,
    });

    out.push({
      month,
      source: "merch",
      amount: Math.round(streaming * profile.merch * (0.6 + rand() * 0.9)),
      artistId,
    });
  }
  return out;
}

/* ─────────────────────────── Dépenses ─────────────────────────── */

const EXPENSE_TEMPLATES: Array<{
  category: ExpenseCategory;
  labels: Array<{ fr: string }>;
  range: [number, number];
  monthlyProb: number;
  needsProject?: boolean;
  source?: "wavely";
}> = [
  {
    category: "studio",
    labels: [
      { fr: "Session studio — enregistrement" },
      { fr: "Mix — ingé son" },
      { fr: "Mastering" },
      { fr: "Location studio (journée)" },
    ],
    range: [350, 2800],
    monthlyProb: 0.75,
    needsProject: true,
    source: "wavely",
  },
  {
    category: "clip",
    labels: [
      { fr: "Production clip — réalisateur" },
      { fr: "Étalonnage & post-prod" },
      { fr: "Location matériel caméra" },
      { fr: "Décor & stylisme tournage" },
    ],
    range: [1800, 14000],
    monthlyProb: 0.28,
    needsProject: true,
  },
  {
    category: "marketing",
    labels: [
      { fr: "Campagne Meta Ads" },
      { fr: "Campagne TikTok Ads" },
      { fr: "Influence — activation créateurs" },
      { fr: "Playlist pitching" },
    ],
    range: [400, 6500],
    monthlyProb: 0.95,
  },
  {
    category: "distribution",
    labels: [{ fr: "Frais distribution" }, { fr: "DDEX / livraison DSP" }],
    range: [90, 450],
    monthlyProb: 0.5,
  },
  {
    category: "promo",
    labels: [
      { fr: "Attaché de presse (mensuel)" },
      { fr: "Shooting photo presse" },
      { fr: "Relations radio" },
    ],
    range: [500, 3200],
    monthlyProb: 0.4,
  },
  {
    category: "tour",
    labels: [
      { fr: "Backline & technique" },
      { fr: "Transport tournée" },
      { fr: "Hébergement équipe" },
    ],
    range: [600, 5200],
    monthlyProb: 0.3,
  },
  {
    category: "other",
    labels: [{ fr: "Frais juridiques" }, { fr: "Assurance matériel" }],
    range: [150, 1900],
    monthlyProb: 0.2,
  },
];

const TEAM_SPENDERS = ["omar", "lisa", "ines", "gael"];

export function expensesFor(artistId: string, months = 24): Expense[] {
  const rand = rngFor(`${artistId}:expenses`);
  const a = getArtist(artistId);
  const scale =
    a.careerStage === "established" ? 2.2 : a.careerStage === "developing" ? 1 : 0.55;
  const projects = PROJECTS.filter((p) => p.artistId === artistId);
  const out: Expense[] = [];
  let n = 0;

  for (let i = months - 1; i >= 0; i--) {
    const m = monthsAgo(i);
    for (const tpl of EXPENSE_TEMPLATES) {
      if (rand() > tpl.monthlyProb) continue;
      const count = tpl.category === "marketing" && rand() > 0.5 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const label = tpl.labels[Math.floor(rand() * tpl.labels.length)];
        const day = 1 + Math.floor(rand() * 27);
        const date = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), day));
        if (date > DEMO_TODAY) continue;
        // Rattache à un projet proche dans le temps quand pertinent.
        let projectId: string | undefined;
        if (tpl.needsProject || rand() < 0.6) {
          const candidates = projects.filter(
            (p) =>
              Math.abs(new Date(p.releaseDate).getTime() - date.getTime()) <
              1000 * 86400 * 240,
          );
          projectId = candidates.length
            ? candidates[Math.floor(rand() * candidates.length)].id
            : undefined;
        }
        const trackPool = projectId
          ? TRACKS.filter((t) => t.projectId === projectId)
          : [];
        const trackId =
          trackPool.length && rand() < 0.35
            ? trackPool[Math.floor(rand() * trackPool.length)].id
            : undefined;

        out.push({
          id: `${artistId}-exp-${n++}`,
          artistId,
          projectId,
          trackId,
          category: tpl.category,
          label: label.fr,
          amount: Math.round(
            (tpl.range[0] + rand() * (tpl.range[1] - tpl.range[0])) * scale,
          ),
          date: isoDay(date),
          addedBy: TEAM_SPENDERS[Math.floor(rand() * TEAM_SPENDERS.length)],
          source: tpl.source === "wavely" && rand() < 0.55 ? "wavely" : "manual",
        });
      }
    }
  }
  return out.sort((x, y) => y.date.localeCompare(x.date));
}

/* ─────────────────────────── Territoires ─────────────────────────── */

const COUNTRY_POOL: Array<Omit<CountryStreams, "streams"> & { w: number }> = [
  { iso3: "FRA", nameFr: "France", nameEn: "France", w: 0.42 },
  { iso3: "BEL", nameFr: "Belgique", nameEn: "Belgium", w: 0.09 },
  { iso3: "CHE", nameFr: "Suisse", nameEn: "Switzerland", w: 0.06 },
  { iso3: "CAN", nameFr: "Canada", nameEn: "Canada", w: 0.07 },
  { iso3: "USA", nameFr: "États-Unis", nameEn: "United States", w: 0.08 },
  { iso3: "DEU", nameFr: "Allemagne", nameEn: "Germany", w: 0.05 },
  { iso3: "GBR", nameFr: "Royaume-Uni", nameEn: "United Kingdom", w: 0.04 },
  { iso3: "MAR", nameFr: "Maroc", nameEn: "Morocco", w: 0.045 },
  { iso3: "SEN", nameFr: "Sénégal", nameEn: "Senegal", w: 0.03 },
  { iso3: "CIV", nameFr: "Côte d'Ivoire", nameEn: "Ivory Coast", w: 0.03 },
  { iso3: "ESP", nameFr: "Espagne", nameEn: "Spain", w: 0.025 },
  { iso3: "ITA", nameFr: "Italie", nameEn: "Italy", w: 0.02 },
  { iso3: "NLD", nameFr: "Pays-Bas", nameEn: "Netherlands", w: 0.02 },
  { iso3: "BRA", nameFr: "Brésil", nameEn: "Brazil", w: 0.02 },
  { iso3: "JPN", nameFr: "Japon", nameEn: "Japan", w: 0.015 },
  { iso3: "MEX", nameFr: "Mexique", nameEn: "Mexico", w: 0.015 },
];

export function countryBreakdown(artistId: string, days = 30): CountryStreams[] {
  const rand = rngFor(`${artistId}:geo`);
  const total = dailyTotals(artistId, days).reduce((s, d) => s + d.streams, 0);
  return COUNTRY_POOL.map((c) => ({
    iso3: c.iso3,
    nameFr: c.nameFr,
    nameEn: c.nameEn,
    streams: Math.round(total * c.w * (0.7 + rand() * 0.6)),
  })).sort((a, b) => b.streams - a.streams);
}

/* ─────────────────────────── Droits FR ─────────────────────────── */

export function rightsStatements(artistId: string): RightsStatement[] {
  const rand = rngFor(`${artistId}:rights`);
  const organisms: Array<RightsStatement["organism"]> = [
    "sacem",
    "adami",
    "spedidam",
    "spre",
  ];
  const periods = ["2025-T1", "2025-T2", "2025-T3", "2025-T4", "2026-T1", "2026-T2"];
  const a = getArtist(artistId);
  const base = a.monthlyListeners * 0.0011;
  const out: RightsStatement[] = [];
  let i = 0;
  for (const organism of organisms) {
    const orgScale =
      organism === "sacem" ? 3 : organism === "adami" ? 1 : organism === "spedidam" ? 0.6 : 0.4;
    for (const period of periods) {
      const expected = Math.round(base * orgScale * (0.8 + rand() * 0.5));
      const isPending = period === "2026-T2";
      const hasGap = !isPending && rand() < 0.18;
      const received = isPending
        ? 0
        : hasGap
          ? Math.round(expected * (0.55 + rand() * 0.25))
          : Math.round(expected * (0.93 + rand() * 0.1));
      out.push({
        id: `${artistId}-rs-${i++}`,
        artistId,
        organism,
        period,
        expected,
        received,
        status: isPending ? "pending" : hasGap ? "gap-detected" : "received",
      });
    }
  }
  return out;
}

/* ─────────────────────────── Audit IA ─────────────────────────── */

export function auditFindings(artistId: string): AuditFinding[] {
  const statements = rightsStatements(artistId).filter(
    (s) => s.status === "gap-detected",
  );
  const rand = rngFor(`${artistId}:audit`);
  const fromRights: AuditFinding[] = statements.map((s, i) => ({
    id: `${artistId}-af-${i}`,
    artistId,
    source: s.organism.toUpperCase(),
    period: s.period,
    expected: s.expected,
    reported: s.received,
    confidence: 0.7 + rand() * 0.25,
    status: i === 0 ? "letter-generated" : "open",
  }));
  // Écart label sur le streaming (le "feature killer" du doc stratégie).
  const a = getArtist(artistId);
  if (a.dealType === "licence") {
    const expected = Math.round(a.monthlyListeners * 2.6 * STREAM_RATE * 3 * 0.24);
    fromRights.push({
      id: `${artistId}-af-label`,
      artistId,
      source: "Label — relevé T1 2026",
      period: "2026-T1",
      expected,
      reported: Math.round(expected * 0.82),
      confidence: 0.87,
      status: "open",
    });
  }
  return fromRights;
}

/* ─────────────────────────── Tournée ─────────────────────────── */

const VENUES: Array<[string, string, string, number]> = [
  ["Paris", "FR", "La Cigale", 1400],
  ["Lyon", "FR", "Le Transbordeur", 1800],
  ["Bruxelles", "BE", "Ancienne Belgique", 2000],
  ["Genève", "CH", "L'Usine", 800],
  ["Bordeaux", "FR", "Rock School Barbey", 700],
  ["Lille", "FR", "L'Aéronef", 1200],
  ["Marseille", "FR", "Le Moulin", 900],
  ["Montréal", "CA", "MTELUS", 2300],
  ["Nantes", "FR", "Stereolux", 1200],
  ["Toulouse", "FR", "Le Bikini", 1500],
];

export function tourDates(artistId: string): TourDate[] {
  const rand = rngFor(`${artistId}:tour`);
  const a = getArtist(artistId);
  const nPast = a.careerStage === "established" ? 8 : a.careerStage === "developing" ? 5 : 2;
  const nFuture = a.careerStage === "established" ? 5 : 3;
  const out: TourDate[] = [];
  for (let i = 0; i < nPast + nFuture; i++) {
    const [city, country, venue, capacity] =
      VENUES[Math.floor(rand() * VENUES.length)];
    const isPast = i < nPast;
    const offset = isPast
      ? -(20 + Math.floor(rand() * 300))
      : 12 + Math.floor(rand() * 150);
    const d = daysAgo(-offset);
    const fill = isPast
      ? a.careerStage === "established"
        ? 0.85 + rand() * 0.15
        : 0.55 + rand() * 0.4
      : 0.2 + rand() * 0.5; // prévente en cours
    const ticketsSold = Math.round(capacity * Math.min(1, fill));
    const price = 22 + Math.floor(rand() * 16);
    out.push({
      id: `${artistId}-td-${i}`,
      artistId,
      date: isoDay(d),
      city,
      country,
      venue,
      capacity,
      ticketsSold,
      grossRevenue: ticketsSold * price,
      status: isPast ? "past" : "upcoming",
    });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

/* ─────────────────────────── Fans ─────────────────────────── */

export function fanSegments(artistId: string): FanSegment[] {
  const rand = rngFor(`${artistId}:fans`);
  const a = getArtist(artistId);
  const base = a.monthlyListeners;
  return [
    { id: "superfans", count: Math.round(base * 0.012 * (0.8 + rand() * 0.4)), trend: 4 + rand() * 14 },
    { id: "engaged", count: Math.round(base * 0.07 * (0.8 + rand() * 0.4)), trend: 2 + rand() * 8 },
    { id: "casual", count: Math.round(base * 0.55 * (0.8 + rand() * 0.4)), trend: -2 + rand() * 8 },
    { id: "dormant", count: Math.round(base * 0.16 * (0.8 + rand() * 0.4)), trend: -6 + rand() * 6 },
  ];
}

/* ─────────────────────────── Prévision (Revenue Calculator) ────────── */

export type ForecastPoint = {
  month: string;
  /** Historique réel (null pour le futur). */
  actual: number | null;
  /** Projection médiane. */
  projected: number | null;
  low: number | null;
  high: number | null;
};

/**
 * Projection 12 mois : tendance (croissance composée artiste) ×
 * saisonnalité mensuelle apprise sur l'historique + bande de confiance.
 * `scenario` module la croissance (ex : +0.25 si sortie d'album prévue).
 */
export function revenueForecast(
  artistId: string,
  opts?: { growthDelta?: number; horizon?: number },
): ForecastPoint[] {
  const horizon = opts?.horizon ?? 12;
  const growthDelta = opts?.growthDelta ?? 0;
  const a = getArtist(artistId);
  const history = revenueSeries(artistId, 24);
  const byMonth = new Map<string, number>();
  for (const p of history) {
    byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);
  }
  const months = Array.from(byMonth.keys()).sort();
  // Saisonnalité : moyenne normalisée par mois calendaire.
  const seasonal = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  const avg =
    Array.from(byMonth.values()).reduce((s, v) => s + v, 0) / byMonth.size;
  for (const m of months) {
    const idx = Number(m.slice(5, 7)) - 1;
    seasonal[idx] += (byMonth.get(m) ?? 0) / avg;
    counts[idx]++;
  }
  for (let i = 0; i < 12; i++) seasonal[i] = counts[i] ? seasonal[i] / counts[i] : 1;

  const out: ForecastPoint[] = months.map((m) => ({
    month: m,
    actual: Math.round(byMonth.get(m) ?? 0),
    projected: null,
    low: null,
    high: null,
  }));

  const last3 = months.slice(-3).map((m) => byMonth.get(m) ?? 0);
  const baseLevel = last3.reduce((s, v) => s + v, 0) / 3;
  const g = a.growthRate + growthDelta;

  const lastDate = new Date(`${months[months.length - 1]}-01T00:00:00Z`);
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(lastDate);
    d.setUTCMonth(d.getUTCMonth() + i);
    const idx = d.getUTCMonth();
    const level = baseLevel * Math.pow(1 + g, i) * seasonal[idx];
    const spread = 0.12 + i * 0.018; // l'incertitude grandit avec l'horizon
    out.push({
      month: isoMonth(d),
      actual: null,
      projected: Math.round(level),
      low: Math.round(level * (1 - spread)),
      high: Math.round(level * (1 + spread)),
    });
  }
  return out;
}

export { ARTISTS };

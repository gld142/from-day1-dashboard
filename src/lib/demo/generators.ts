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
  RightsOrganism,
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

/**
 * Rythme de versement des sources encaissées par à-coups.
 *
 * Chaque source arrive par vagues (trimestre SACEM, semestre droits voisins,
 * saison live) et la moyenne annuelle de chaque ligne est ce qui donne son
 * poids réel à la source. On sépare donc les deux : `peak`/`off` portent le
 * RYTHME, et leur moyenne sur douze mois est tenue à la valeur d'origine du
 * générateur, pour qu'aucun total annuel ne bouge en changeant la forme.
 *
 * Les amplitudes d'origine (SACEM ×3,1 contre ×0,12) faisaient du mois de
 * versement 40 % du revenu du mois et du mois suivant un trou : sur un
 * graphique mensuel la ligne ne racontait plus l'activité de l'artiste mais le
 * calendrier des répartiteurs. On garde les vagues — elles sont vraies — en
 * divisant l'écart crête/creux par ~5, ce qui laisse la saisonnalité lisible
 * sans qu'elle écrase la tendance.
 */
const PAYOUT_RHYTHM = {
  /** SACEM : répartition trimestrielle (janv/avr/juil/oct). Moyenne = 1,1133. */
  sacem: { peak: 2.0, off: 0.67 },
  /** Droits voisins (ADAMI/SPEDIDAM) : deux versements, juin et décembre. Moyenne = 0,9833. */
  neighboring: { peak: 3.4, off: 0.5 },
  /** SPRE : même calendrier que les droits voisins. Moyenne = 0,7417. */
  spre: { peak: 2.6, off: 0.37 },
  /** Live : saison mai→sept, épaules mars et novembre, creux l'hiver. Moyenne = 1,0792. */
  live: { season: 1.6, shoulder: 1.0, off: 0.59 },
} as const;

/** Revenus mensuels par source sur `months` mois (défaut 24).
 *  `streamingOverride` (mois → € brut master) remplace le calcul synthétique — artistes réels. */
export function revenueSeries(artistId: string, months = 24, streamingOverride?: Map<string, number>): RevenuePoint[] {
  const out: RevenuePoint[] = [];
  const a = getArtist(artistId);
  const profile = sourceProfile(artistId);
  const rand = rngFor(`${artistId}:revenue`);
  // Un placement sync se négocie à la notoriété : pub nationale pour un artiste
  // à plusieurs millions d'auditeurs, spot local ou court-métrage pour un
  // émergent. Sans cette échelle, le montant est un forfait 2–16 k € qui vaut
  // deux ans de revenus pour un artiste à 24 k auditeurs et fabrique un pic
  // isolé de ×158 sur sa courbe mensuelle. Au-delà du million d'auditeurs le
  // tarif est celui du marché, pas celui de l'audience : le facteur plafonne
  // à 1 et les gros artistes gardent exactement leurs montants.
  const syncScale = Math.min(1, a.monthlyListeners / 1_000_000);

  for (let i = months - 1; i >= 0; i--) {
    const m = monthsAgo(i);
    const month = isoMonth(m);
    // L'historique se lit à rebours : le mois i est i mois avant aujourd'hui,
    // donc i mois de croissance composée EN MOINS que le niveau d'aujourd'hui.
    const monthlyStreams = a.monthlyListeners * 2.6 * Math.pow(1 + a.growthRate, -i);
    // `rand()` est consommé dans les deux cas : le bruit du reste de la série ne bouge pas.
    const synthetic = monthlyStreams * STREAM_RATE * (0.92 + rand() * 0.16);
    const streaming = streamingOverride?.get(month) ?? synthetic;

    out.push({ month, source: "streaming", amount: Math.round(streaming), artistId });

    // SACEM : versements trimestriels (janv/avr/juil/oct), sinon résiduel.
    const mm = m.getUTCMonth();
    const sacemQuarter = mm % 3 === 0 ? PAYOUT_RHYTHM.sacem.peak : PAYOUT_RHYTHM.sacem.off;
    out.push({
      month,
      source: "sacem",
      amount: Math.round(streaming * profile.sacem * sacemQuarter * (0.85 + rand() * 0.3)),
      artistId,
    });

    // Droits voisins : 2 versements/an (juin, décembre).
    const semester = mm === 5 || mm === 11;
    const neighboring = semester ? PAYOUT_RHYTHM.neighboring.peak : PAYOUT_RHYTHM.neighboring.off;
    out.push({
      month,
      source: "neighboring",
      amount: Math.round(streaming * profile.neighboring * neighboring * (0.8 + rand() * 0.4)),
      artistId,
    });

    out.push({
      month,
      source: "spre",
      amount: Math.round(
        streaming * profile.spre * (semester ? PAYOUT_RHYTHM.spre.peak : PAYOUT_RHYTHM.spre.off),
      ),
      artistId,
    });

    // Sync : rare et grumeleux.
    const syncHit = rand() < 0.14;
    out.push({
      month,
      source: "sync",
      amount: syncHit ? Math.round((2000 + rand() * 14000) * syncScale) : 0,
      artistId,
    });

    // Live : saison été + tournées.
    const liveSeason =
      mm >= 4 && mm <= 8
        ? PAYOUT_RHYTHM.live.season
        : mm === 10 || mm === 2
          ? PAYOUT_RHYTHM.live.shoulder
          : PAYOUT_RHYTHM.live.off;
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
  const stageScale =
    a.careerStage === "established" ? 2.2 : a.careerStage === "developing" ? 1 : 0.55;
  // Au-dessus de 300 k auditeurs, les budgets (clips, marketing, tournée) grossissent
  // avec l'artiste ; plafond ×25 pour garder des montants plausibles sur une major.
  //
  // En dessous, une décroissance linéaire ne suffit pas : elle suppose que
  // l'émergent commande les mêmes postes en miniature. Or un artiste à 24 k
  // auditeurs ne tourne pas un clip à 14 k € divisé par douze — il ne le tourne
  // pas du tout, il n'a pas d'attaché de presse et sa tournée tient dans une
  // voiture. Le générateur ne peut pas sauter ces postes (le tirage du RNG est
  // séquentiel : changer le nombre de tirages déplacerait TOUTES les données de
  // démo), alors on reproduit l'effet sur le montant, avec un exposant > 1.
  // 1,4 est calibré sur l'émergent du roster : il ramène sa marge 12 mois de
  // −217 % à une quinzaine de points négatifs, ce qu'on attend d'un artiste qui
  // réinvestit un peu plus qu'il n'encaisse. L'exposant ne touche que les
  // artistes sous le seuil — à 300 k il vaut exactement 1, donc la courbe reste
  // continue et les artistes plus gros gardent leurs montants au centime près.
  const sizeRatio = a.monthlyListeners / 300_000;
  const sizeFactor = sizeRatio >= 1 ? Math.min(25, sizeRatio) : Math.pow(sizeRatio, 1.4);
  const scale = stageScale * sizeFactor;
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

export const RIGHTS_ORGANISMS: RightsOrganism[] = ["sacem", "adami", "spedidam", "spre"];

/** Trimestres affichés ; le dernier est celui dont la répartition est en cours de traitement. */
export const RIGHTS_PERIODS = ["2025-T1", "2025-T2", "2025-T3", "2025-T4", "2026-T1", "2026-T2"];
export const RIGHTS_PENDING_PERIOD = RIGHTS_PERIODS[RIGHTS_PERIODS.length - 1];

/**
 * Échelle relative des organismes — HYPOTHÈSE : ADAMI ≈ SACEM / 3, SPEDIDAM
 * ≈ 0,6 × ADAMI, SPRE ≈ 0,4 × ADAMI. Partagée avec la façade api.ts, qui
 * dérive l'attendu SACEM des artistes réels de l'estimateur et garde ces ratios.
 */
export const RIGHTS_ORG_SCALE: Record<RightsOrganism, number> = {
  sacem: 3,
  adami: 1,
  spedidam: 0.6,
  spre: 0.4,
};

/**
 * Reçu simulé à partir d'un attendu : 18 % des relevés clos sont sous-versés
 * (55–80 % de l'attendu), les autres tombent à 93–103 %. Le trimestre en cours
 * de traitement n'a pas encore de reçu. Seedé par artiste + organisme +
 * période : le motif d'écarts ne bouge pas quand l'attendu est recalculé
 * (nouveau relevé quotidien, recalibrage).
 */
export function simulatedReceipt(
  artistId: string,
  organism: RightsOrganism,
  period: string,
  expected: number,
): Pick<RightsStatement, "received" | "status"> {
  if (period === RIGHTS_PENDING_PERIOD) return { received: 0, status: "pending" };
  const rand = rngFor(`${artistId}:rights:${organism}:${period}`);
  const hasGap = rand() < 0.18;
  const factor = hasGap ? 0.55 + rand() * 0.25 : 0.93 + rand() * 0.1;
  return { received: Math.round(expected * factor), status: hasGap ? "gap-detected" : "received" };
}

/** Relevés entièrement simulés (artistes sans relevé réel) : attendu ∝ auditeurs mensuels. */
export function rightsStatements(artistId: string): RightsStatement[] {
  const rand = rngFor(`${artistId}:rights`);
  const a = getArtist(artistId);
  const base = a.monthlyListeners * 0.0011;
  const out: RightsStatement[] = [];
  let i = 0;
  for (const organism of RIGHTS_ORGANISMS) {
    for (const period of RIGHTS_PERIODS) {
      const expected = Math.round(base * RIGHTS_ORG_SCALE[organism] * (0.8 + rand() * 0.5));
      out.push({
        id: `${artistId}-rs-${i++}`,
        artistId,
        organism,
        period,
        expected,
        ...simulatedReceipt(artistId, organism, period, expected),
        expectedProvenance: "simulated",
        receivedProvenance: "simulated",
      });
    }
  }
  return out;
}

/* ─────────────────────────── Audit IA ─────────────────────────── */

/**
 * Un signalement d'audit par relevé de droits en écart, dans l'ordre des
 * relevés ; le premier a déjà sa lettre. Reçoit les relevés (générés ici, ou
 * ceux de la façade pour les artistes réels) pour que /audit et /rights
 * montrent exactement les mêmes montants.
 */
export function rightsGapFindings(artistId: string, statements: RightsStatement[]): AuditFinding[] {
  const rand = rngFor(`${artistId}:audit`);
  return statements
    .filter((s) => s.status === "gap-detected")
    .map((s, i) => ({
      id: `${artistId}-af-${i}`,
      artistId,
      source: s.organism.toUpperCase(),
      period: s.period,
      expected: s.expected,
      reported: s.received,
      confidence: 0.7 + rand() * 0.25,
      status: i === 0 ? "letter-generated" : "open",
    }));
}

export function auditFindings(artistId: string): AuditFinding[] {
  const fromRights = rightsGapFindings(artistId, rightsStatements(artistId));
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
 * Demi-vie, en mois, de l'effet de croissance d'une sortie (scénario du
 * calculateur + curseur d'ajustement).
 *
 * Une sortie ne change pas le régime de croissance d'un artiste pour toujours :
 * elle fait un pic qui retombe. Ajouté tel quel au taux mensuel composé, un
 * scénario « album » (+18 pts) multipliait la projection à 24 mois par 51 —
 * 342 M € pour un artiste qui en fait 12 par an. Le delta décroît donc
 * géométriquement, et lui seul : le taux organique de l'artiste, lui, continue.
 *
 * 4 mois : le pic de streams d'une sortie est déjà modélisé plus haut
 * (`releaseBoost`) par une exponentielle de constante 38 jours, soit une
 * demi-vie de ~26 jours. L'effet sur la CROISSANCE dure plus longtemps que le
 * pic lui-même — ajouts en playlist, traction sur le back-catalogue, annonce de
 * tournée — sans être permanent : une demi-vie de 4 mois couvre le cycle de
 * promo, puis l'artiste retrouve son rythme (le boost est divisé par 8 au bout
 * d'un an). Le niveau acquis, lui, reste : c'est bien ce qu'une sortie laisse.
 */
export const RELEASE_BOOST_HALF_LIFE_MONTHS = 4;

/**
 * Projection 12 mois : tendance (croissance composée artiste) ×
 * saisonnalité mensuelle apprise sur l'historique + bande de confiance.
 * `growthDelta` module la croissance (ex : +0.18 si sortie d'album prévue) et
 * s'éteint avec `RELEASE_BOOST_HALF_LIFE_MONTHS`.
 * `streamingOverride` : même sens que dans `revenueSeries` — l'historique projeté
 * doit être celui que le dashboard affiche (artistes réels).
 */
export function revenueForecast(
  artistId: string,
  opts?: { growthDelta?: number; horizon?: number },
  streamingOverride?: Map<string, number>,
): ForecastPoint[] {
  const horizon = opts?.horizon ?? 12;
  const growthDelta = opts?.growthDelta ?? 0;
  const a = getArtist(artistId);
  const history = revenueSeries(artistId, 24, streamingOverride);
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

  const lastDate = new Date(`${months[months.length - 1]}-01T00:00:00Z`);
  // La croissance se compose mois par mois au lieu d'une puissance fermée :
  // le taux n'est plus constant, puisque la part « sortie » s'éteint.
  let compound = 1;
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(lastDate);
    d.setUTCMonth(d.getUTCMonth() + i);
    const idx = d.getUTCMonth();
    // Plein effet le premier mois projeté — celui de la sortie — puis moitié
    // moins tous les RELEASE_BOOST_HALF_LIFE_MONTHS.
    const releaseBoost =
      growthDelta * Math.pow(0.5, (i - 1) / RELEASE_BOOST_HALF_LIFE_MONTHS);
    compound *= 1 + a.growthRate + releaseBoost;
    const level = baseLevel * compound * seasonal[idx];
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

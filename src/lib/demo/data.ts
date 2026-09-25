/**
 * Le roster de démo : "Day 1 Dashboard Pro", 3 artistes RÉELS (Dadju,
 * Nono La Grinta, Kiko) dont les chiffres d'audience viennent des
 * snapshots publics committés (src/lib/real/snapshots). Chaque artiste a
 * une identité chromatique (hue) pour que toutes les vues comparatives
 * aient du relief.
 */
import type {
  Artist,
  Contract,
  EmergingArtist,
  Project,
  SyncBrief,
  TeamMember,
  Track,
  TrackSplit,
} from "./types";
import { daysAgo, daysAhead, isoDay } from "./seed";
import { SNAPSHOTS } from "@/lib/real/snapshots";

export const LABEL = {
  id: "day1-dashboard-pro",
  name: "Day 1 Dashboard Pro",
  foundedYear: 2026,
};

/** Auditeurs mensuels du dernier relevé, sinon la valeur de secours. */
function listenersFromSnapshot(artistId: string, fallback: number): number {
  const snaps = SNAPSHOTS[artistId];
  const last = snaps?.[snaps.length - 1];
  return last?.spotify.monthlyListeners ?? fallback;
}

/**
 * Le roster réel de la démo (spec §6). Les chiffres d'audience viennent des
 * snapshots ; hue, initiales, index, dates de signature sont simulés.
 */
export const ARTISTS: Artist[] = [
  {
    id: "dadju",
    name: "Dadju",
    genre: "R&B / Pop urbaine",
    hue: 285,
    initials: "DA",
    monthlyListeners: listenersFromSnapshot("dadju", 6_481_936),
    growthRate: 0.012,
    careerStage: "established",
    day1Index: 88,
    signedSince: "2017-05-19",
    dealType: "artiste",
    country: "FR",
    spotifyId: "4sbXXFzEWJY2zsZjelerjX",
    deezerId: "4803754",
    youtubeChannelId: "UC8HMvOLE0etpO_eVjJ98bHA",
  },
  {
    id: "nono-la-grinta",
    name: "Nono La Grinta",
    genre: "Rap",
    hue: 35,
    initials: "NG",
    monthlyListeners: listenersFromSnapshot("nono-la-grinta", 4_731_080),
    growthRate: 0.045,
    careerStage: "developing",
    day1Index: 74,
    signedSince: "2023-03-10",
    dealType: "artiste",
    country: "FR",
    spotifyId: "4P2HohWBtvSxxwabNDdYXN",
    deezerId: "194146027",
    youtubeChannelId: "UCv3rmdK3RqjN0PNkxJEfBwg",
  },
  {
    id: "kiko",
    name: "Kiko",
    genre: "Afro-pop / Rap",
    hue: 165,
    initials: "KI",
    monthlyListeners: listenersFromSnapshot("kiko", 24_468),
    growthRate: 0.09,
    careerStage: "emerging",
    day1Index: 52,
    signedSince: "2025-01-15",
    dealType: "distribution",
    country: "TG",
    spotifyId: "4P2zZ1OLqeeKDLXc34Yfsv",
    deezerId: "188212297",
    youtubeChannelId: "UClmZnCCKgupJOucmLOvm71A",
  },
  {
    /* Identifiants croisés MusicBrainz × Deezer le 25/09/2026 — pas devinés.
       Le contrat, le stade de carrière et l'index sont des HYPOTHÈSES de
       démonstration, comme pour les trois autres : seules les audiences
       viennent du relevé. */
    id: "elgrandetoto",
    name: "ElGrandeToto",
    genre: "Rap marocain",
    hue: 210,
    initials: "ET",
    monthlyListeners: listenersFromSnapshot("elgrandetoto", 3_000_000),
    growthRate: 0.02,
    careerStage: "established",
    day1Index: 81,
    signedSince: "2019-06-01",
    dealType: "distribution",
    country: "MA",
    spotifyId: "4BFLElxtBEdsdwGA1kHTsx",
    deezerId: "52463032",
    youtubeChannelId: "UCVG705xosVltZb52R0hHr_g",
  },
];

export function getArtist(id: string): Artist {
  return ARTISTS.find((a) => a.id === id) ?? ARTISTS[0];
}

/* ─────────────────────────── Projets & titres ─────────────────────────── */

type ProjectSeed = {
  id: string;
  title: string;
  type: Project["type"];
  releaseDate: string;
  tracks: string[];
};

const PROJECT_SEEDS: Record<string, ProjectSeed[]> = {
  dadju: [
    { id: "da-cullinan", title: "Cullinan", type: "album", releaseDate: "2024-11-15",
      tracks: ["Dieu merci", "Mon soleil", "Oublie-le", "Django", "Bob Marley", "Meleğim"] },
    { id: "da-poison-antidote", title: "Poison ou Antidote", type: "album", releaseDate: "2019-11-08",
      tracks: ["Compliqué", "Grand bain", "Par amour", "I love you", "Jaloux", "DANÇARINA - Remix"] },
    { id: "da-gentleman", title: "Gentleman 2.0", type: "album", releaseDate: "2017-11-24",
      tracks: ["Reine", "Jamais (feat. Dadju)"] },
  ],
  "nono-la-grinta": [
    { id: "ng-paris", title: "PARIS", type: "album", releaseDate: "2025-04-11",
      tracks: ["Paris", "LOVE YOU", "AVEC MOI", "TERRAIN", "FLASH-BACK", "STEPHANIE", "7AM"] },
    { id: "ng-colors", title: "LOVE YOU — A COLORS SHOW", type: "single", releaseDate: "2025-06-20",
      tracks: ["LOVE YOU - A COLORS SHOW"] },
    { id: "ng-grinta", title: "La Grinta", type: "ep", releaseDate: "2024-03-08",
      tracks: ["LA QUOI ? (feat. La Mano 1.9)", "J'tavais dit", "Délit", "Restaurant", "Audrey Kelly", "22%"] },
  ],
  /* Titres RELEVÉS le 25/09/2026 sur sa page Spotify (les cinq plus écoutés,
     avec leurs playcounts). Le regroupement en projets et les dates de sortie
     sont des HYPOTHÈSES de démonstration : le relevé donne les titres, pas la
     discographie. */
  elgrandetoto: [
    { id: "egt-ghalat", title: "GHALAT", type: "single", releaseDate: "2024-10-04",
      tracks: ["GHALAT", "FOTO"] },
    { id: "egt-feats", title: "Featurings", type: "ep", releaseDate: "2023-05-12",
      tracks: [
        "love nwantiti (feat. ElGrande Toto) - North African Remix",
        "Qui sait ? (feat. ElGrandeToto)",
        "Ojos Sin Ver",
      ] },
  ],
  kiko: [
    { id: "ki-golden-boy", title: "Golden Boy", type: "ep", releaseDate: "2025-11-21",
      tracks: ["Odjo", "Business class", "One in a million"] },
    { id: "ki-rayon", title: "Rayon de soleil", type: "single", releaseDate: "2026-05-16", tracks: ["Rayon de soleil"] },
    { id: "ki-ding", title: "Ding Deng Dong", type: "single", releaseDate: "2025-06-06", tracks: ["Ding Deng Dong"] },
  ],
};

export const PROJECTS: Project[] = Object.entries(PROJECT_SEEDS).flatMap(
  ([artistId, seeds]) =>
    seeds.map((s) => ({
      id: s.id,
      artistId,
      title: s.title,
      type: s.type,
      releaseDate: s.releaseDate,
      year: Number(s.releaseDate.slice(0, 4)),
    })),
);

export const TRACKS: Track[] = Object.entries(PROJECT_SEEDS).flatMap(
  ([artistId, seeds]) =>
    seeds.flatMap((s, si) =>
      s.tracks.map((title, ti) => {
        // Poids décroissant : les premiers titres d'un projet récent pèsent plus.
        const recency = 1 / (si + 1);
        const position = 1 / (ti + 1.6);
        return {
          id: `${s.id}-t${ti + 1}`,
          artistId,
          projectId: s.id,
          title,
          isrc: `FR-D${(si + 1) * 10 + ti}-${s.releaseDate.slice(2, 4)}-${String(
            10000 + ti * 137 + si * 911,
          ).slice(1)}`,
          releaseDate: s.releaseDate,
          durationSec: 150 + ((ti * 37 + si * 53) % 130),
          weight: recency * position,
        };
      }),
    ),
);

// Normalise les poids par artiste (somme = 1).
for (const artist of ARTISTS) {
  const tracks = TRACKS.filter((t) => t.artistId === artist.id);
  const total = tracks.reduce((s, t) => s + t.weight, 0);
  for (const t of tracks) t.weight = t.weight / total;
}

/* ─────────────────────────── Splits ─────────────────────────── */

const COLLABORATORS = [
  "Naomi K.",
  "Prod2Nuit",
  "Elias Ferre",
  "Wax Motif",
  "Sarah Line",
  "DJ Comète",
  "M. Volta",
  "Jules Andrade",
];

export const SPLITS: TrackSplit[] = TRACKS.map((t, i) => {
  const artist = getArtist(t.artistId);
  const nCollab = (i % 3) + 1;
  const artistShare = 100 - nCollab * (12 + (i % 3) * 4);
  const shares = [
    {
      name: artist.name,
      role: "interprète" as const,
      share: artistShare,
      signed: true,
    },
    ...Array.from({ length: nCollab }, (_, k) => ({
      name: COLLABORATORS[(i + k * 3) % COLLABORATORS.length],
      role: (k === 0 ? "producteur" : k === 1 ? "auteur" : "compositeur") as
        | "producteur"
        | "auteur"
        | "compositeur",
      share: 12 + (i % 3) * 4,
      signed: (i + k) % 5 !== 0,
    })),
  ];
  const allSigned = shares.every((s) => s.signed);
  return {
    trackId: t.id,
    shares,
    status: allSigned ? "signed" : i % 7 === 0 ? "draft" : "pending",
    updatedAt: t.releaseDate,
  };
});

/* ─────────────────────────── Contrats ─────────────────────────── */

/**
 * `counterparty` s'affiche tel quel dans la colonne « Contrepartie », dans les
 * alertes et dans le bandeau de recoupement : c'est le NOM d'une contrepartie,
 * pas sa description. Les valeurs d'origine — « Label — contrat d'artiste »,
 * « Distributeur numérique » — décrivaient en français ce que la colonne
 * « Type » dit déjà, et restaient en français quand l'interface passe en
 * anglais. Ne restent que des termes de métier identiques dans les deux
 * langues. Même raison pour `territory` : « Monde » s'affichait tel quel dans
 * la colonne « Territoire » d'une interface anglaise — « World » est le terme
 * employé des deux côtés dans les contrats de musique.
 */
export const CONTRACTS: Contract[] = [
  {
    id: "c-da-artiste",
    artistId: "dadju",
    type: "licence",
    counterparty: "Label",
    startDate: "2017-05-19",
    endDate: "2027-05-19",
    royaltyRate: 22,
    advance: 450_000,
    recoupedPct: 100,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "option",
        severity: "warning",
        dueDate: "2026-11-19",
        message: {
          fr: "Option de renouvellement à lever avant le 19/11 — fenêtre de renégociation ouverte",
          en: "Renewal option to exercise before Nov 19 — renegotiation window open",
        },
      },
      {
        kind: "audit-window",
        severity: "info",
        dueDate: "2026-12-31",
        message: {
          fr: "Fenêtre d'audit contractuelle : exercice 2025 auditable jusqu'au 31/12",
          en: "Contractual audit window: FY2025 auditable until Dec 31",
        },
      },
    ],
  },
  {
    id: "c-ng-artiste",
    artistId: "nono-la-grinta",
    type: "licence",
    counterparty: "Label",
    startDate: "2023-03-10",
    endDate: "2027-03-10",
    royaltyRate: 20,
    advance: 90_000,
    recoupedPct: 71,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "unusual-clause",
        severity: "danger",
        message: {
          fr: "Clause de recoupement croisé sur les revenus live — à faire retirer au prochain avenant",
          en: "Cross-collateralization clause on live revenue — to remove at next amendment",
        },
      },
    ],
  },
  {
    id: "c-ki-distribution",
    artistId: "kiko",
    type: "distribution",
    counterparty: "Distro",
    startDate: "2025-01-15",
    endDate: "2027-01-15",
    royaltyRate: 85,
    advance: 0,
    recoupedPct: 100,
    territory: "World",
    exclusive: false,
    alerts: [
      {
        kind: "expiry",
        severity: "info",
        dueDate: "2027-01-15",
        message: {
          fr: "Contrat de distribution : préavis de résiliation 90 jours avant échéance",
          en: "Distribution deal: 90-day termination notice before expiry",
        },
      },
    ],
  },
];

/* ─────────────────────────── Équipe ─────────────────────────── */

/**
 * Dernière activité d'un membre, exprimée en jours avant le « aujourd'hui » du
 * produit.
 *
 * Écrites en dur, ces dates ne vieillissaient pas avec lui : DEMO_TODAY suit
 * LATEST_DATE et avance à chaque relevé, les dates restaient au 2 juillet 2026.
 * L'écart passé la semaine, « actifs sur 7 jours » de /team affichait 0 en
 * permanence — un compteur qui ne bouge jamais, sur une équipe qu'on voit
 * travailler juste à côté. On garde les écarts d'origine, qui racontent
 * quelque chose (deux membres aujourd'hui, la manageuse hier, la comptable en
 * début de semaine, l'avocat il y a une quinzaine) et on les ancre à la date
 * du produit au lieu du calendrier.
 */
export function teamLastActive(daysBefore: number): string {
  return isoDay(daysAgo(daysBefore));
}

export const TEAM: TeamMember[] = [
  {
    id: "gael",
    name: "Gaël C.",
    role: "owner",
    artistAccess: "all",
    modules: "all",
    lastActive: teamLastActive(0),
  },
  {
    id: "lisa",
    name: "Lisa M.",
    role: "manager",
    artistAccess: ["nono-la-grinta", "kiko"],
    modules: "all",
    lastActive: teamLastActive(1),
  },
  {
    id: "omar",
    name: "Omar B.",
    role: "marketing",
    artistAccess: "all",
    modules: ["finances", "streams", "audience", "fans"],
    lastActive: teamLastActive(0),
  },
  {
    id: "ines",
    name: "Inès T.",
    role: "comptable",
    artistAccess: "all",
    modules: ["finances", "revenue", "urssaf", "rights"],
    lastActive: teamLastActive(4),
  },
  {
    id: "marc",
    name: "Me Marc D.",
    role: "avocat",
    artistAccess: "all",
    modules: ["contracts", "splits", "audit"],
    lastActive: teamLastActive(12),
  },
];

/* ─────────────────────────── A&R Watch ─────────────────────────── */

export const EMERGING: EmergingArtist[] = [
  {
    id: "em-1",
    name: "Nayla",
    genre: "R&B alternatif",
    country: "FR",
    monthlyListeners: 145_000,
    momentum30d: 212,
    day1Index: 41,
    watchlisted: true,
    hue: 265,
  },
  {
    id: "em-2",
    name: "Casque d'Or",
    genre: "Rap mélodique",
    country: "FR",
    monthlyListeners: 89_000,
    momentum30d: 165,
    day1Index: 36,
    watchlisted: true,
    hue: 45,
  },
  {
    id: "em-3",
    name: "Softwave",
    genre: "Hyperpop",
    country: "BE",
    monthlyListeners: 220_000,
    momentum30d: 98,
    day1Index: 47,
    watchlisted: false,
    hue: 190,
  },
  {
    id: "em-4",
    name: "Amara Dió",
    genre: "Afro-fusion",
    country: "SN",
    monthlyListeners: 310_000,
    momentum30d: 74,
    day1Index: 52,
    watchlisted: false,
    hue: 25,
  },
  {
    id: "em-5",
    name: "Brume Épaisse",
    genre: "Shoegaze FR",
    country: "FR",
    monthlyListeners: 34_000,
    momentum30d: 301,
    day1Index: 28,
    watchlisted: false,
    hue: 320,
  },
  {
    id: "em-6",
    name: "KILO.WATT",
    genre: "Drill électro",
    country: "CH",
    monthlyListeners: 176_000,
    momentum30d: 122,
    day1Index: 43,
    watchlisted: true,
    hue: 140,
  },
];

/* ─────────────────────────── Briefs de synchro ─────────────────────────── */

/**
 * Les briefs de synchronisation ouverts. Leur échéance est donnée en JOURS à
 * partir d'aujourd'hui, pas en date fixe.
 *
 * Mesuré le 24/09 : les cinq dates étaient figées en juillet-août 2026 et
 * toutes dépassées, sous un titre « Briefs ouverts » — la page annonçait
 * ouvert ce qui était fermé. Une démo dont les dates vieillissent finit par
 * mentir toute seule ; des décalages relatifs restent vrais.
 *
 * Deux briefs ferment à sept jours ou moins : c'est ce que /pulse compte.
 */
export const SYNC_BRIEFS: SyncBrief[] = [
  {
    id: "nova-tv",
    brand: "Nova Motors",
    type: "tv",
    budgetLow: 18_000,
    budgetHigh: 35_000,
    deadline: isoDay(daysAhead(4)),
    mood: "energetic",
  },
  {
    id: "meridien-film",
    brand: "Les Films du Méridien",
    type: "film",
    budgetLow: 3_000,
    budgetHigh: 7_000,
    deadline: isoDay(daysAhead(6)),
    mood: "melancholic",
  },
  {
    id: "palier-series",
    brand: "Studio Palier",
    type: "series",
    budgetLow: 8_000,
    budgetHigh: 15_000,
    deadline: isoDay(daysAhead(15)),
    mood: "nocturnal",
  },
  {
    id: "ondine-tv",
    brand: "Maison Ondine",
    type: "tv",
    budgetLow: 12_000,
    budgetHigh: 20_000,
    deadline: isoDay(daysAhead(27)),
    mood: "dreamy",
  },
  {
    id: "helios-game",
    brand: "Helios Games",
    type: "game",
    budgetLow: 22_000,
    budgetHigh: 45_000,
    deadline: isoDay(daysAhead(41)),
    mood: "cinematic",
  },
];

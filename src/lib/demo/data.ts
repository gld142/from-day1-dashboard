/**
 * Le roster de démo : "Nocturne Records", label indé fictif, 6 artistes.
 * Chaque artiste a une identité chromatique (hue) et un profil de
 * carrière distinct pour que toutes les vues comparatives aient du relief.
 */
import type {
  Artist,
  Contract,
  EmergingArtist,
  Project,
  TeamMember,
  Track,
  TrackSplit,
} from "./types";

export const LABEL = {
  id: "nocturne-records",
  name: "Nocturne Records",
  foundedYear: 2019,
};

export const ARTISTS: Artist[] = [
  {
    id: "sky-lune",
    name: "Sky Lune",
    genre: "Pop / R&B",
    hue: 285,
    initials: "SL",
    monthlyListeners: 4_200_000,
    growthRate: 0.055,
    careerStage: "developing",
    day1Index: 71,
    signedSince: "2023-04-12",
    dealType: "licence",
    country: "FR",
  },
  {
    id: "kayro",
    name: "KAYRO",
    genre: "Rap",
    hue: 215,
    initials: "KA",
    monthlyListeners: 8_500_000,
    growthRate: 0.018,
    careerStage: "established",
    day1Index: 84,
    signedSince: "2020-09-01",
    dealType: "artiste",
    country: "FR",
  },
  {
    id: "vela",
    name: "Vela",
    genre: "Électro",
    hue: 165,
    initials: "VE",
    monthlyListeners: 1_800_000,
    growthRate: 0.031,
    careerStage: "developing",
    day1Index: 62,
    signedSince: "2022-01-20",
    dealType: "licence",
    country: "BE",
  },
  {
    id: "mira-sol",
    name: "Mira Sol",
    genre: "Afro-pop",
    hue: 35,
    initials: "MS",
    monthlyListeners: 950_000,
    growthRate: 0.12,
    careerStage: "emerging",
    day1Index: 58,
    signedSince: "2024-06-05",
    dealType: "distribution",
    country: "FR",
  },
  {
    id: "leon-brume",
    name: "Léon Brume",
    genre: "Chanson / Indie",
    hue: 330,
    initials: "LB",
    monthlyListeners: 320_000,
    growthRate: 0.008,
    careerStage: "developing",
    day1Index: 44,
    signedSince: "2021-11-15",
    dealType: "licence",
    country: "FR",
  },
  {
    id: "orka",
    name: "ORKA",
    genre: "Rock alternatif",
    hue: 10,
    initials: "OR",
    monthlyListeners: 210_000,
    growthRate: -0.015,
    careerStage: "developing",
    day1Index: 37,
    signedSince: "2021-03-08",
    dealType: "licence",
    country: "CH",
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
  "sky-lune": [
    {
      id: "sl-lune-noire",
      title: "Lune Noire",
      type: "album",
      releaseDate: "2025-10-17",
      tracks: [
        "Minuit exactement",
        "Câlin lunaire",
        "Photophobie",
        "Trois heures du matin",
        "Éclipse",
        "Lueur",
        "Satellite",
        "Marée haute",
      ],
    },
    {
      id: "sl-avant-jour",
      title: "Avant le jour",
      type: "ep",
      releaseDate: "2024-05-24",
      tracks: ["Aube", "Fenêtre ouverte", "Rosée", "Premier métro"],
    },
    {
      id: "sl-nova",
      title: "Nova",
      type: "single",
      releaseDate: "2026-05-30",
      tracks: ["Nova"],
    },
  ],
  kayro: [
    {
      id: "ka-zenith",
      title: "Zénith",
      type: "album",
      releaseDate: "2025-03-14",
      tracks: [
        "Intro (Zénith)",
        "Plein soleil",
        "Balafres",
        "Or noir",
        "13e étage",
        "Vertige",
        "Sans filtre",
        "Panorama",
        "Outro (Descente)",
      ],
    },
    {
      id: "ka-brouillon",
      title: "Brouillon d'empire",
      type: "album",
      releaseDate: "2023-09-22",
      tracks: [
        "Empire",
        "Béton armé",
        "La rue compte",
        "Insomnie",
        "Chrome",
        "Mirador",
      ],
    },
    {
      id: "ka-feu-vert",
      title: "Feu vert",
      type: "single",
      releaseDate: "2026-04-10",
      tracks: ["Feu vert"],
    },
  ],
  vela: [
    {
      id: "ve-haute-tension",
      title: "Haute tension",
      type: "ep",
      releaseDate: "2025-06-06",
      tracks: ["220 volts", "Nuit blanche", "Stroboscope", "Afterglow"],
    },
    {
      id: "ve-circuits",
      title: "Circuits",
      type: "album",
      releaseDate: "2023-11-10",
      tracks: [
        "Boot",
        "Cache mémoire",
        "Latence",
        "Overclock",
        "Ventilateur",
        "Veille",
      ],
    },
  ],
  "mira-sol": [
    {
      id: "mi-soleil-13h",
      title: "Soleil à 13h",
      type: "ep",
      releaseDate: "2026-02-13",
      tracks: ["Wax", "Bissap", "Corniche", "Soleil à 13h", "Danse d'abord"],
    },
    {
      id: "mi-alizee",
      title: "Alizés",
      type: "single",
      releaseDate: "2025-07-04",
      tracks: ["Alizés"],
    },
  ],
  "leon-brume": [
    {
      id: "lb-crachin",
      title: "Crachin",
      type: "album",
      releaseDate: "2024-10-04",
      tracks: [
        "Crachin",
        "Novembre",
        "Le port",
        "Sémaphore",
        "Granit",
        "Marées",
        "L'estran",
      ],
    },
  ],
  orka: [
    {
      id: "or-fracture",
      title: "Fracture",
      type: "album",
      releaseDate: "2023-05-19",
      tracks: ["Fracture", "Sonar", "Abysse", "Écume", "Dérive", "Leviathan"],
    },
    {
      id: "or-orage-sec",
      title: "Orage sec",
      type: "single",
      releaseDate: "2025-09-12",
      tracks: ["Orage sec"],
    },
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

export const CONTRACTS: Contract[] = [
  {
    id: "c-sl-licence",
    artistId: "sky-lune",
    type: "licence",
    counterparty: "Nocturne Records",
    startDate: "2023-04-12",
    endDate: "2026-10-12",
    royaltyRate: 24,
    advance: 18_000,
    recoupedPct: 86,
    territory: "Monde",
    exclusive: true,
    alerts: [
      {
        kind: "expiry",
        severity: "warning",
        dueDate: "2026-10-12",
        message: {
          fr: "Fin de contrat dans 3 mois — fenêtre de renégociation ouverte",
          en: "Contract ends in 3 months — renegotiation window open",
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
    id: "c-ka-artiste",
    artistId: "kayro",
    type: "licence",
    counterparty: "Nocturne Records",
    startDate: "2020-09-01",
    endDate: "2027-09-01",
    royaltyRate: 30,
    advance: 120_000,
    recoupedPct: 100,
    territory: "Monde",
    exclusive: true,
    alerts: [
      {
        kind: "option",
        severity: "info",
        dueDate: "2026-09-01",
        message: {
          fr: "Option 3e album à lever avant le 01/09/2026",
          en: "3rd album option to exercise before Sep 1, 2026",
        },
      },
    ],
  },
  {
    id: "c-ka-edition",
    artistId: "kayro",
    type: "édition",
    counterparty: "Éditions Meridian",
    startDate: "2021-01-15",
    endDate: "2029-01-15",
    royaltyRate: 50,
    advance: 35_000,
    recoupedPct: 92,
    territory: "Monde",
    exclusive: true,
    alerts: [
      {
        kind: "unusual-clause",
        severity: "danger",
        message: {
          fr: "Clause de cession étendue aux œuvres futures — au-dessus du marché",
          en: "Assignment clause extends to future works — above market norms",
        },
      },
    ],
  },
  {
    id: "c-ve-licence",
    artistId: "vela",
    type: "licence",
    counterparty: "Nocturne Records",
    startDate: "2022-01-20",
    endDate: "2027-01-20",
    royaltyRate: 26,
    advance: 22_000,
    recoupedPct: 71,
    territory: "Europe",
    exclusive: true,
    alerts: [],
  },
  {
    id: "c-mi-distribution",
    artistId: "mira-sol",
    type: "distribution",
    counterparty: "Nocturne Records",
    startDate: "2024-06-05",
    endDate: "2026-06-05",
    royaltyRate: 72,
    advance: 0,
    recoupedPct: 100,
    territory: "Monde",
    exclusive: false,
    alerts: [
      {
        kind: "expiry",
        severity: "danger",
        dueDate: "2026-06-05",
        message: {
          fr: "Contrat expiré depuis le 05/06 — l'artiste est en négociation active",
          en: "Contract expired on Jun 5 — artist is actively negotiating",
        },
      },
    ],
  },
  {
    id: "c-lb-licence",
    artistId: "leon-brume",
    type: "licence",
    counterparty: "Nocturne Records",
    startDate: "2021-11-15",
    endDate: "2026-11-15",
    royaltyRate: 22,
    advance: 8_000,
    recoupedPct: 100,
    territory: "Francophonie",
    exclusive: true,
    alerts: [],
  },
  {
    id: "c-or-licence",
    artistId: "orka",
    type: "licence",
    counterparty: "Nocturne Records",
    startDate: "2021-03-08",
    endDate: "2026-03-08",
    royaltyRate: 23,
    advance: 15_000,
    recoupedPct: 64,
    territory: "Europe",
    exclusive: true,
    alerts: [
      {
        kind: "expiry",
        severity: "warning",
        message: {
          fr: "Contrat arrivé à terme — tacite reconduction active, préavis 6 mois",
          en: "Contract term reached — auto-renewal active, 6-month notice",
        },
      },
    ],
  },
];

/* ─────────────────────────── Équipe ─────────────────────────── */

export const TEAM: TeamMember[] = [
  {
    id: "gael",
    name: "Gaël C.",
    role: "owner",
    artistAccess: "all",
    modules: "all",
    lastActive: "2026-07-02",
  },
  {
    id: "lisa",
    name: "Lisa M.",
    role: "manager",
    artistAccess: ["sky-lune", "mira-sol"],
    modules: "all",
    lastActive: "2026-07-01",
  },
  {
    id: "omar",
    name: "Omar B.",
    role: "marketing",
    artistAccess: "all",
    modules: ["finances", "streams", "audience", "fans"],
    lastActive: "2026-07-02",
  },
  {
    id: "ines",
    name: "Inès T.",
    role: "comptable",
    artistAccess: "all",
    modules: ["finances", "revenue", "urssaf", "rights"],
    lastActive: "2026-06-28",
  },
  {
    id: "marc",
    name: "Me Marc D.",
    role: "avocat",
    artistAccess: "all",
    modules: ["contracts", "splits", "audit"],
    lastActive: "2026-06-20",
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

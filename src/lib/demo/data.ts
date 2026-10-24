/**
 * Le roster de démo : "Day 1 Dashboard Pro", 12 artistes RÉELS (Dadju, Nono La
 * Grinta, November Ultra, Zeg P, Kiko, ElGrandeToto, Leto, Dakeez, Louane,
 * Wamen, Gustave Rudman, Brice Davoli) ; la maison retire le sien. Les chiffres d'audience viennent des
 * snapshots publics committés (src/lib/real/snapshots). Chaque artiste a
 * une identité chromatique (hue) pour que toutes les vues comparatives
 * aient du relief.
 */
import type {
  Artist,
  DA,
  Placement,
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
import { TENANT, excludeArtists } from "@/lib/tenant";

/** Le label de démo porte le nom de la maison : « Day 1 Dashboard Pro » ou « Day One × Universal ». */
export const LABEL = {
  id: TENANT.id === "universal" ? "day-one-universal" : "day1-dashboard-pro",
  name: TENANT.name,
  foundedYear: 2026,
};

/** Auditeurs mensuels du dernier relevé, sinon la valeur de secours. */
function listenersFromSnapshot(artistId: string, fallback: number): number {
  const snaps = SNAPSHOTS[artistId];
  const last = snaps?.[snaps.length - 1];
  return last?.spotify.monthlyListeners ?? fallback;
}

/**
 * Les DA de démo. Prénoms FICTIFS (à remplacer par les vrais si Gaël les donne) ;
 * chaque artiste est rattaché au DA de sa catégorie.
 */
export const DAS: DA[] = [
  { id: "da-urbain", name: "Inès M.", category: "urbain" },
  { id: "da-variete", name: "Julien R.", category: "variete" },
  { id: "da-compos", name: "Sofia K.", category: "compositeur" },
];

export function getDa(id: string): DA | null {
  return DAS.find((d) => d.id === id) ?? null;
}

/**
 * Le roster réel de la démo (spec §6). Les chiffres d'audience viennent des
 * snapshots ; hue, initiales, index, dates de signature sont simulés.
 */
export const ALL_ARTISTS: Artist[] = [
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
    category: "urbain",
    daId: "da-urbain",
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
    category: "urbain",
    daId: "da-urbain",
    spotifyId: "4P2HohWBtvSxxwabNDdYXN",
    deezerId: "194146027",
    youtubeChannelId: "UCv3rmdK3RqjN0PNkxJEfBwg",
  },
  {
    id: "november-ultra",
    name: "November Ultra",
    genre: "Pop / Soul",
    hue: 330,
    initials: "NU",
    monthlyListeners: listenersFromSnapshot("november-ultra", 396_215),
    growthRate: 0.018,
    careerStage: "developing",
    day1Index: 69,
    signedSince: "2021-09-01",
    dealType: "indé",
    kind: "performer",
    publisher: null,
    country: "FR",
    category: "urbain",
    daId: "da-urbain",
    spotifyId: "0naOCLau0NmL1kdFlbZAfr",
    deezerId: "68625462",
    youtubeChannelId: "UCzteqa2qTb6SqazU1MyHzUA",
  },
  {
    /* Auteur-compositeur-producteur. Sa page Spotify existe, mais l'essentiel
       de ce qu'il gagne ne s'y voit pas : ça se passe sur les disques des
       autres. Voir PLACEMENTS et le champ `kind` dans types.ts. */
    id: "zeg-p",
    name: "Zeg P",
    genre: "Production · Rap / R&B",
    hue: 255,
    initials: "ZP",
    monthlyListeners: listenersFromSnapshot("zeg-p", 1_112_230),
    growthRate: 0.03,
    careerStage: "established",
    day1Index: 77,
    signedSince: "2020-02-17",
    dealType: "indé",
    kind: "composer",
    publisher: { name: "Day 1 Édition", sharePct: 25 },
    country: "FR",
    category: "compositeur",
    daId: "da-compos",
    spotifyId: "1rpxM2mBJnWdfPeieLDYOc",
    deezerId: "11809227",
    youtubeChannelId: "UC03zElk3Y0AQAuIJZ3GhnAw",
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
    category: "urbain",
    daId: "da-urbain",
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
    category: "urbain",
    daId: "da-urbain",
    spotifyId: "4BFLElxtBEdsdwGA1kHTsx",
    deezerId: "52463032",
    youtubeChannelId: "UCVG705xosVltZb52R0hHr_g",
  },
  {
    /* Rap, PSO Thug. Ids vérifiés le 23/10/2026. Auditeurs de secours ~2 M (ordre de grandeur,
       remplacé par le premier relevé). */
    id: "leto",
    name: "Leto",
    genre: "Rap",
    hue: 15,
    initials: "LE",
    monthlyListeners: listenersFromSnapshot("leto", 2_000_000),
    growthRate: 0.02,
    careerStage: "established",
    day1Index: 79,
    signedSince: "2018-09-14",
    dealType: "licence",
    country: "FR",
    category: "urbain",
    daId: "da-urbain",
    spotifyId: "6HCBnyTBSLdb3TFn2ayulY",
    deezerId: "455796",
    youtubeChannelId: "UCP9zhgBhlIwgF5UEf3Pmj8Q",
  },
  {
    /* R&B / trapsoul, Lyon. Pas de chaîne YouTube identifiée : le relevé passe la source. */
    id: "dakeez",
    name: "Dakeez",
    genre: "R&B / trapsoul",
    hue: 300,
    initials: "DK",
    monthlyListeners: listenersFromSnapshot("dakeez", 150_000),
    growthRate: 0.07,
    careerStage: "emerging",
    day1Index: 48,
    signedSince: "2025-03-01",
    dealType: "distribution",
    country: "FR",
    category: "urbain",
    daId: "da-urbain",
    spotifyId: "63TYAXPLsZ7A3AFeGiGGGu",
    deezerId: "53565962",
  },
  {
    /* Pop / variété. La chaîne YouTube est INCERTAINE (recherche du 23/10, non confirmée par
       une page officielle) : vérifier le titre de chaîne dans le premier relevé (Task 4, Step 3)
       et vider le champ si ce n'est pas elle. */
    id: "louane",
    name: "Louane",
    genre: "Pop / variété",
    hue: 345,
    initials: "LO",
    monthlyListeners: listenersFromSnapshot("louane", 3_000_000),
    growthRate: 0.015,
    careerStage: "established",
    day1Index: 84,
    signedSince: "2015-03-02",
    dealType: "artiste",
    country: "FR",
    category: "variete",
    daId: "da-variete",
    spotifyId: "7wjeXCtRND2ZdKfMJFu6JC",
    deezerId: "4453455",
    youtubeChannelId: "UCxROfILs1ORiiUWCDdkfqaA",
  },
  {
    /* R&B / soul, Paris. Pas de chaîne YouTube identifiée. */
    id: "wamen",
    name: "Wamen",
    genre: "R&B / soul",
    hue: 190,
    initials: "WA",
    monthlyListeners: listenersFromSnapshot("wamen", 170_000),
    growthRate: 0.06,
    careerStage: "developing",
    day1Index: 51,
    signedSince: "2024-06-01",
    dealType: "distribution",
    country: "FR",
    category: "variete",
    daId: "da-variete",
    spotifyId: "3IrNp8pf0ugwmIEiGJCRse",
    deezerId: "182945357",
  },
  {
    /* Compositeur-producteur (orthographe : Gustave). Comme Zeg P : ce qu'il gagne se passe sur
       les disques des autres (PLACEMENTS). Contrat d'édition « reçu, relecture en cours » dans
       le fil : il n'a donc PAS encore de contrat dans CONTRACTS. */
    id: "gustave-rudman",
    name: "Gustave Rudman",
    genre: "Composition · Pop / variété",
    hue: 60,
    initials: "GR",
    monthlyListeners: listenersFromSnapshot("gustave-rudman", 100_000),
    growthRate: 0.02,
    careerStage: "established",
    day1Index: 66,
    signedSince: "2019-01-15",
    dealType: "indé",
    kind: "composer",
    publisher: { name: "Day 1 Édition", sharePct: 25 },
    country: "FR",
    category: "compositeur",
    daId: "da-compos",
    spotifyId: "2yGaqlHUHvNEpdRlmQCMEC",
    deezerId: "4722593",
  },
  {
    /* Compositeur-arrangeur, musique à l'image. « Grand catalogue Sacem » selon Gaël, NON vérifié.
       Page Spotify lue dans le navigateur le 23/10 : le relevé peut la lire ; les auditeurs de
       secours (~5 k) ne servent qu'avant lui. */
    id: "brice-davoli",
    name: "Brice Davoli",
    genre: "Composition · musique à l'image",
    hue: 120,
    initials: "BD",
    monthlyListeners: listenersFromSnapshot("brice-davoli", 5_000),
    growthRate: 0.005,
    careerStage: "established",
    day1Index: 58,
    signedSince: "2016-05-10",
    dealType: "indé",
    kind: "composer",
    publisher: { name: "Day 1 Édition", sharePct: 25 },
    country: "FR",
    category: "compositeur",
    daId: "da-compos",
    spotifyId: "27kwwOnjG09lmLHv3zle84",
    deezerId: "1570143",
  },
];

/**
 * Le roster de LA MAISON : le roster complet moins ses exclus (day1 : Kiko ;
 * universal : Dadju). Tout ce qui dérive du roster (projets, titres, splits,
 * contrats, accès de l'équipe, placements) est filtré par `inRoster` : un
 * artiste exclu n'apparaît nulle part, ses fichiers de relevés restent.
 */
export const ARTISTS: Artist[] = excludeArtists(ALL_ARTISTS);
const inRoster = (artistId: string) => ARTISTS.some((a) => a.id === artistId);

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
  /* Titres relevés le 25/09/2026 sur sa page Spotify. */
  "november-ultra": [
    { id: "nu-bedroom", title: "bedroom walls", type: "album", releaseDate: "2022-04-01",
      tracks: ["come into my arms", "the end.", "soft & tender"] },
    { id: "nu-silencio", title: "Silencio", type: "single", releaseDate: "2023-09-15",
      tracks: ["Silencio", "Parfois"] },
  ],
  /* Ce que Zeg P sort SOUS SON NOM. L'essentiel de son activité est ailleurs :
     voir PLACEMENTS. */
  "zeg-p": [
    { id: "zp-fade", title: "FADE UP", type: "single", releaseDate: "2020-02-17",
      tracks: ["FADE UP", "Avion de chasse"] },
    { id: "zp-cites", title: "Cités de France", type: "ep", releaseDate: "2022-06-10",
      tracks: ["Cités de France", "Juste une minute", "Blood"] },
  ],
  kiko: [
    { id: "ki-golden-boy", title: "Golden Boy", type: "ep", releaseDate: "2025-11-21",
      tracks: ["Odjo", "Business class", "One in a million"] },
    { id: "ki-rayon", title: "Rayon de soleil", type: "single", releaseDate: "2026-05-16", tracks: ["Rayon de soleil"] },
    { id: "ki-ding", title: "Ding Deng Dong", type: "single", releaseDate: "2025-06-06", tracks: ["Ding Deng Dong"] },
  ],
};

export const PROJECTS: Project[] = Object.entries(PROJECT_SEEDS).filter(([artistId]) => inRoster(artistId)).flatMap(
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

export const TRACKS: Track[] = Object.entries(PROJECT_SEEDS).filter(([artistId]) => inRoster(artistId)).flatMap(
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
const ALL_CONTRACTS: Contract[] = [
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
    /* Distribution : il garde l'essentiel du master, le distributeur prend sa
       commission. Le taux du contrat (88 %) est volontairement proche de
       l'hypothèse du modèle pour son type de deal (DEAL_SHARE.distribution,
       90 %) : deux chiffres voisins se lisent comme « le contrat dit 88, le
       modèle suppose 90 », pas comme une contradiction. */
    id: "c-egt-distribution",
    artistId: "elgrandetoto",
    type: "distribution",
    counterparty: "Universal Music MENA",
    startDate: "2023-03-01",
    endDate: "2027-03-01",
    royaltyRate: 88,
    advance: 180_000,
    recoupedPct: 64,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "option",
        severity: "warning",
        dueDate: "2026-12-01",
        message: {
          fr: "Option de renouvellement à lever avant le 01/12 — fenêtre de renégociation ouverte",
          en: "Renewal option to exercise before 01/12 — renegotiation window open",
        },
      },
    ],
  },
  {
    /* Indépendante : elle garde son master et ne paie qu'une commission de
       distribution. 93 %, soit 7 % de frais — le cas d'un DistroKid ou d'un
       Believe en pur service. */
    id: "c-nu-distribution",
    artistId: "november-ultra",
    type: "distribution",
    counterparty: "Believe Digital",
    startDate: "2022-01-10",
    endDate: "2026-12-31",
    royaltyRate: 93,
    advance: 0,
    recoupedPct: 100,
    territory: "World",
    exclusive: false,
    alerts: [
      {
        kind: "expiry",
        severity: "warning",
        dueDate: "2026-12-31",
        message: {
          fr: "Contrat de distribution à échéance le 31/12 — préavis de 90 jours, soit avant le 02/10",
          en: "Distribution deal expires on 31/12 — 90-day notice, i.e. before 02/10",
        },
      },
    ],
  },
  {
    /* Le contrat qui compte pour un auteur-compositeur n'est pas un contrat
       de master : c'est son contrat d'ÉDITION. Les 25 % qu'il cède ici sont
       exactement le `publisher.sharePct` déclaré sur l'artiste, et ce que la
       page /placements déduit de chaque œuvre. Un seul fait, deux endroits. */
    id: "c-zp-edition",
    artistId: "zeg-p",
    type: "édition",
    counterparty: "Day 1 Édition",
    startDate: "2020-02-17",
    endDate: "2028-02-17",
    royaltyRate: 75,
    advance: 60_000,
    recoupedPct: 41,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "audit-window",
        severity: "info",
        dueDate: "2027-02-17",
        message: {
          fr: "Fenêtre d'audit ouverte jusqu'au 17/02/2027 — dernier moment pour vérifier les relevés d'édition",
          en: "Audit window open until 17/02/2027 — last chance to check publishing statements",
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
  {
    /* Avance recoupée à 80 % : c'est la note « finance → DA urbain » du fil (feed-store). */
    id: "c-le-licence",
    artistId: "leto",
    type: "licence",
    counterparty: "Label",
    startDate: "2022-09-14",
    endDate: "2027-09-14",
    royaltyRate: 21,
    advance: 300_000,
    recoupedPct: 80,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "audit-window",
        severity: "info",
        dueDate: "2027-03-31",
        message: {
          fr: "Fenêtre d'audit contractuelle : exercice 2026 auditable jusqu'au 31/03/2027",
          en: "Contractual audit window: FY2026 auditable until 31/03/2027",
        },
      },
    ],
  },
  {
    id: "c-dk-distribution",
    artistId: "dakeez",
    type: "distribution",
    counterparty: "Believe Digital",
    startDate: "2025-03-01",
    endDate: "2027-03-01",
    royaltyRate: 85,
    advance: 15_000,
    recoupedPct: 35,
    territory: "World",
    exclusive: false,
    alerts: [],
  },
  {
    /* Option à lever avant le 30 : c'est la note « DA variété → juridique » du fil. */
    id: "c-lo-artiste",
    artistId: "louane",
    type: "licence",
    counterparty: "Label",
    startDate: "2020-03-02",
    endDate: "2027-03-02",
    royaltyRate: 24,
    advance: 600_000,
    recoupedPct: 100,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "option",
        severity: "warning",
        dueDate: "2026-11-30",
        message: {
          fr: "Option de prolongation à lever avant le 30/11 — sinon le contrat court jusqu'à son terme sans album supplémentaire",
          en: "Extension option to exercise before Nov 30 — otherwise the deal runs to term with no extra album",
        },
      },
    ],
  },
  {
    id: "c-wa-distribution",
    artistId: "wamen",
    type: "distribution",
    counterparty: "Distro",
    startDate: "2024-06-01",
    endDate: "2027-02-01",
    royaltyRate: 85,
    advance: 0,
    recoupedPct: 100,
    territory: "World",
    exclusive: false,
    alerts: [
      {
        kind: "expiry",
        severity: "warning",
        dueDate: "2027-02-01",
        message: {
          fr: "Contrat de distribution à échéance le 01/02/2027 — préavis de 60 jours, soit avant le 03/12/2026",
          en: "Distribution deal expires on 01/02/2027 — 60-day notice, i.e. before 03/12/2026",
        },
      },
    ],
  },
  {
    /* Édition : le même 25 % que `publisher.sharePct` (un seul fait, deux endroits — comme Zeg P). */
    id: "c-bd-edition",
    artistId: "brice-davoli",
    type: "édition",
    counterparty: "Day 1 Édition",
    startDate: "2016-05-10",
    endDate: "2028-05-10",
    royaltyRate: 75,
    advance: 0,
    recoupedPct: 100,
    territory: "World",
    exclusive: true,
    alerts: [],
  },
];

/** Les contrats des artistes de la maison. */
export const CONTRACTS: Contract[] = ALL_CONTRACTS.filter((c) => inRoster(c.artistId));

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
    artistAccess: ["nono-la-grinta", "kiko", "dakeez"].filter(inRoster),
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

/* ─────────────────────────── Œuvres & placements ─────────────────────────── */

/**
 * Les œuvres d'un auteur-compositeur, placées chez d'autres artistes.
 *
 * Les cinq premières sont SORTIES : leurs titres et leurs écoutes cumulées
 * viennent du relevé Spotify du 25/09/2026 (page de Zeg P, cinq titres les
 * plus écoutés avec leurs playcounts). Les parts d'écriture, les points de
 * production et l'état des déclarations SACEM sont en revanche des
 * HYPOTHÈSES : aucune source publique ne donne les crédits d'écriture.
 *
 * Les quatre suivantes — non sorties ou proposées — sont entièrement
 * SIMULÉES. Sans elles, le carnet de commandes serait vide et la page ne
 * montrerait pas ce qu'elle sert à montrer.
 */
const ALL_PLACEMENTS: Placement[] = [
  { id: "pl-fadeup", artistId: "zeg-p", title: "FADE UP", performer: "Hamza, SCH",
    roles: ["compositeur", "producteur"], writerSharePct: 25, producerPointsPct: 4,
    status: "released", date: "2020-02-17", declared: true, streams: 148_817_745 },
  { id: "pl-avion", artistId: "zeg-p", title: "Avion de chasse", performer: "Hamza",
    roles: ["compositeur", "producteur"], writerSharePct: 20, producerPointsPct: 3,
    status: "released", date: "2021-03-12", declared: true, streams: 9_295_310 },
  { id: "pl-cites", artistId: "zeg-p", title: "Cités de France", performer: "Zeg P, Hamza",
    roles: ["auteur", "compositeur", "producteur"], writerSharePct: 40, producerPointsPct: 5,
    status: "released", date: "2022-06-10", declared: true, streams: 7_160_506 },
  { id: "pl-minute", artistId: "zeg-p", title: "Juste une minute", performer: "Zeg P",
    roles: ["auteur", "compositeur"], writerSharePct: 50, producerPointsPct: 0,
    status: "released", date: "2022-09-02", declared: false, streams: 5_816_104 },
  { id: "pl-blood", artistId: "zeg-p", title: "Blood", performer: "Zeg P",
    roles: ["compositeur", "producteur"], writerSharePct: 35, producerPointsPct: 4,
    status: "released", date: "2023-01-20", declared: false, streams: 633_492 },

  { id: "pl-nuit", artistId: "zeg-p", title: "Nuit blanche", performer: "Nono La Grinta",
    roles: ["compositeur", "producteur"], writerSharePct: 30, producerPointsPct: 4,
    status: "unreleased", date: "2026-11-14", declared: false, streams: 0 },
  { id: "pl-loin", artistId: "zeg-p", title: "Trop loin", performer: "Dadju",
    roles: ["compositeur"], writerSharePct: 15, producerPointsPct: 0,
    status: "unreleased", date: "2026-10-30", declared: true, streams: 0 },
  { id: "pl-sahara", artistId: "zeg-p", title: "Sahara", performer: "ElGrandeToto",
    roles: ["compositeur", "producteur"], writerSharePct: 25, producerPointsPct: 3,
    status: "pitched", date: "2027-01-15", declared: false, streams: 0 },
  { id: "pl-encore", artistId: "zeg-p", title: "Encore une fois", performer: "November Ultra",
    roles: ["auteur", "compositeur"], writerSharePct: 45, producerPointsPct: 0,
    status: "pitched", date: "2027-02-20", declared: false, streams: 0 },

  /* Gustave Rudman et Brice Davoli : œuvres SIMULÉES (aucune source publique ne donne les crédits
     d'écriture). Les interprètes sont ceux du roster pour que le dashboard se recoupe. */
  { id: "pl-gr-rivage", artistId: "gustave-rudman", title: "Rivage", performer: "Louane",
    roles: ["auteur", "compositeur"], writerSharePct: 50, producerPointsPct: 0,
    status: "released", date: "2025-02-14", declared: true, streams: 12_400_000 },
  { id: "pl-gr-lumiere", artistId: "gustave-rudman", title: "Lumière basse", performer: "Wamen",
    roles: ["compositeur", "producteur"], writerSharePct: 35, producerPointsPct: 3,
    status: "released", date: "2025-10-03", declared: false, streams: 1_850_000 },
  { id: "pl-gr-hiver", artistId: "gustave-rudman", title: "Hiver", performer: "Louane",
    roles: ["auteur", "compositeur"], writerSharePct: 50, producerPointsPct: 0,
    status: "unreleased", date: "2026-11-21", declared: false, streams: 0 },
  { id: "pl-bd-generique", artistId: "brice-davoli", title: "Générique — Les Heures claires", performer: "Orchestre de studio",
    roles: ["compositeur", "producteur"], writerSharePct: 100, producerPointsPct: 0,
    status: "released", date: "2024-09-06", declared: true, streams: 420_000 },
  { id: "pl-bd-theme", artistId: "brice-davoli", title: "Thème principal — Nuit sur la ville", performer: "Orchestre de studio",
    roles: ["compositeur"], writerSharePct: 100, producerPointsPct: 0,
    status: "released", date: "2025-05-16", declared: true, streams: 95_000 },
  { id: "pl-bd-serie", artistId: "brice-davoli", title: "Habillage — série (saison 2)", performer: "Studio Palier",
    roles: ["compositeur", "producteur"], writerSharePct: 100, producerPointsPct: 0,
    status: "unreleased", date: "2027-01-10", declared: false, streams: 0 },
];

/** Les œuvres des compositeurs de la maison. */
export const PLACEMENTS: Placement[] = ALL_PLACEMENTS.filter((p) => inRoster(p.artistId));

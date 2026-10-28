/**
 * Les six notes d'exemple du fil (spec Universal v2, §5), avec leur vie : réponses, prises en
 * charge, statuts. Chaque histoire est REJOUÉE par les actions du modèle (feed-model.ts) — les
 * mêmes que l'interface —, donc l'historique d'un exemple est exactement celui qu'un clic aurait
 * produit.
 *
 * Aucun chiffre écrit à la main : avances, recoupements, options, part éditeur et œuvres non
 * déclarées sont lus dans data.ts au moment de poser l'exemple. feed-seed.test.ts vérifie en plus
 * ce que data.ts ne porte pas (l'écart d'audit d'ElGrandeToto, lu dans api.ts).
 *
 * Destinataires : les mentions et prises en charge des exemples ne visent que des services DÉJÀ
 * destinataires — le « à traiter » de chaque rôle reste celui de la spec (feed-store.test.ts).
 * L'ajout d'un service par mention se montre en direct.
 *
 * Textes en français, figés comme toute note dans la langue de sa création (fromName compris).
 */
import { ALL_ARTISTS, ALL_CONTRACTS, ALL_PLACEMENTS } from "@/lib/demo/data";
import { getDa } from "@/lib/demo/das";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import {
  addReply,
  assignNote,
  changeStatus,
  createNote,
  type Actor,
  type DaOf,
  type FeedLink,
  type FeedNote,
  type FeedStatus,
  type Urgency,
} from "./feed-model";

/** Artiste → DA sur TOUT le catalogue (une note garde son DA même pour un artiste hors maison). */
export const seedDaOf: DaOf = (artistId) => ALL_ARTISTS.find((a) => a.id === artistId)?.daId ?? null;

/* ─── Faits lus dans data.ts ─── */

function contract(id: string) {
  const c = ALL_CONTRACTS.find((x) => x.id === id);
  if (!c) throw new Error(`feed-seed : contrat ${id} introuvable dans data.ts`);
  return c;
}
const NBSP = " ";
const eur = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)}${NBSP}€`;
const pct = (n: number) => `${n}${NBSP}%`;
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ddmmyyyy = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;

/** Les chiffres que citent les exemples, tous dérivés de data.ts (exportés pour le test). */
export function seedFacts() {
  const nono = contract("c-ng-artiste");
  const leto = contract("c-le-licence");
  const louane = contract("c-lo-artiste");
  const louaneOption = louane.alerts.find((a) => a.kind === "option")?.dueDate;
  if (!louaneOption) throw new Error("feed-seed : l'option de Louane (c-lo-artiste) n'a plus d'échéance");
  const gustave = ALL_ARTISTS.find((a) => a.id === "gustave-rudman");
  const undeclared = ALL_PLACEMENTS.filter((p) => p.artistId === "gustave-rudman" && p.status === "released" && !p.declared);
  return {
    nono: { advance: nono.advance, recoupedPct: nono.recoupedPct },
    leto: { advance: leto.advance, recoupedPct: leto.recoupedPct, remaining: Math.round(leto.advance * (1 - leto.recoupedPct / 100)) },
    louane: { optionDue: louaneOption, endDate: louane.endDate },
    gustave: { publisherPct: gustave?.publisher?.sharePct ?? null, undeclared: undeclared.map((p) => ({ title: p.title, performer: p.performer })) },
  };
}

/* ─── Qui parle ─── */

const daActor = (daId: string, label: string): Actor => ({ role: "da", daId, name: `DA ${label} · ${getDa(daId)?.name ?? ""}` });
const CAMILLE: Actor = { role: "juridique", daId: null, name: "Juridique · Camille" };
const THOMAS: Actor = { role: "finance", daId: null, name: "Finance · Thomas" };
const GAEL: Actor = { role: "direction", daId: null, name: "Direction · Gaël" };
const INES = daActor("da-urbain", "urbain");
const JULIEN = daActor("da-variete", "variété");
const SOFIA = daActor("da-compos", "compositeurs");

/* ─── Dates ─── */

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const shift = (today: Date, days: number) => new Date(today.getTime() + days * DAY);
/** Le prochain « 30 » du calendrier : ce mois-ci s'il n'est pas passé, sinon le mois suivant. */
function nextDay30(today: Date): string {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  return isoDay(today.getUTCDate() < 30 ? new Date(Date.UTC(y, m, 30)) : new Date(Date.UTC(y, m + 1, 30)));
}
/** Le prochain vendredi (aujourd'hui si c'en est un). */
function nextFriday(today: Date): string {
  return isoDay(shift(today, (5 - today.getUTCDay() + 7) % 7));
}
/** Le dernier trimestre clos (« T3 » le 24/10) : celui des écarts d'audit (api.ts, quarterOf). */
function lastClosedQuarter(today: Date): string {
  return `T${((Math.ceil((today.getUTCMonth() + 1) / 3) + 2) % 4) + 1}`;
}

/* ─── Les histoires ─── */

type SeedStep = { after: number; by: Actor } & ({ reply: string } | { status: FeedStatus } | { assign: string });

type SeedSpec = {
  id: string;
  daysAgo: number;
  /** Heure de création (UTC). */
  time: [number, number];
  from: JobRole;
  fromName: string;
  to: JobRole[];
  artistId: string | null;
  urgency: Urgency;
  due: (today: Date) => string | null;
  text: string;
  link: FeedLink;
  /** Les étapes, en minutes après la création ; elles lisent la note (échéance réellement posée). */
  steps: (note: FeedNote, today: Date) => SeedStep[];
};

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

const SPECS: SeedSpec[] = [
  {
    id: "seed-recoupement-nono",
    daysAgo: 1,
    time: [9, 40],
    from: "juridique",
    fromName: "Juridique · Camille",
    to: ["finance"],
    artistId: "nono-la-grinta",
    urgency: "urgent",
    due: (t) => isoDay(shift(t, 15)),
    text: "Clause de recoupement croisé de l'avance de Nono La Grinta : à faire retirer au prochain avenant. Échéance 15 jours.",
    link: { kind: "contract", href: "/contracts" },
    steps: () => {
      const { nono } = seedFacts();
      return [
        { after: 25, by: THOMAS, assign: "thomas" },
        { after: 26, by: THOMAS, status: "doing" },
        {
          after: 32,
          by: THOMAS,
          reply: `Je prends. Avance de ${eur(nono.advance)}, recoupée à ${pct(nono.recoupedPct)} : je chiffre ce que les revenus live apportent au recoupement avant qu'on retire la clause.`,
        },
        { after: h(5, 10), by: CAMILLE, reply: "@Finance il me faut ton chiffrage avant le comité de vendredi pour rédiger l'avenant." },
      ];
    },
  },
  {
    id: "seed-avance-leto",
    daysAgo: 2,
    time: [14, 5],
    from: "finance",
    fromName: "Finance · Thomas",
    to: ["da"],
    artistId: "leto",
    urgency: "important",
    due: (t) => isoDay(shift(t, 30)),
    text: "Avance de Leto recoupée à 80 % : prévoir la renégociation avant la prochaine sortie.",
    link: { kind: "contract", href: "/contracts" },
    steps: () => {
      const { leto } = seedFacts();
      return [
        { after: h(2), by: INES, reply: "Vu. Je vois son management avant la prochaine sortie : il me faut le reste à recouper." },
        {
          after: h(2, 40),
          by: THOMAS,
          reply: `Reste ${eur(leto.remaining)} à recouper sur une avance de ${eur(leto.advance)} (${pct(leto.recoupedPct)} recoupés).`,
        },
      ];
    },
  },
  {
    id: "seed-option-louane",
    daysAgo: 0,
    time: [7, 10],
    from: "da",
    fromName: "DA variété · Julien R.",
    to: ["juridique"],
    artistId: "louane",
    urgency: "urgent",
    due: nextDay30,
    text: "Option sur Louane à lever avant le 30.",
    link: { kind: "contract", href: "/contracts" },
    steps: (note) => {
      const { louane } = seedFacts();
      const margin =
        note.dueDate && note.dueDate < louane.optionDue
          ? ` On garde le ${ddmm(note.dueDate)} comme échéance interne, pour avoir de la marge.`
          : "";
      return [
        { after: 20, by: CAMILLE, assign: "camille" },
        { after: 21, by: CAMILLE, status: "doing" },
        {
          after: 35,
          by: CAMILLE,
          reply: `Vérifié au contrat : l'option de prolongation est à lever avant le ${ddmm(louane.optionDue)} ; sans levée, le contrat court jusqu'au ${ddmmyyyy(louane.endDate)} sans album supplémentaire.${margin}`,
        },
        { after: h(1, 5), by: JULIEN, reply: "Côté artiste, accord pour l'album supplémentaire." },
        { after: h(1, 50), by: GAEL, status: "decided" },
        { after: h(1, 51), by: GAEL, reply: "Décidé : on lève l'option. Camille, prépare la lettre de levée pour signature." },
      ];
    },
  },
  {
    id: "seed-comite-catalogue",
    daysAgo: 3,
    time: [16, 30],
    from: "direction",
    fromName: "Direction · Gaël",
    to: [...JOB_ROLES],
    artistId: null,
    urgency: "info",
    due: nextFriday,
    text: "Comité catalogue vendredi : remonter les œuvres sans split signé.",
    link: { kind: "page", href: "/splits" },
    steps: () => [
      { after: 5, by: GAEL, assign: "gael" },
      {
        after: h(16),
        by: CAMILLE,
        reply: "La liste des œuvres sans split signé est dans Splits (filtres « En attente » et « Brouillons ») ; je la reprends la veille du comité.",
      },
      { after: h(17), by: SOFIA, reply: "Côté compositeurs, je vérifie les œuvres de Gustave Rudman et de Brice Davoli." },
      { after: h(40), by: THOMAS, reply: "@Direction j'ajoute l'écart d'audit d'ElGrandeToto à l'ordre du jour (voir la note Finance → Direction)." },
    ],
  },
  {
    id: "seed-edition-gustave",
    daysAgo: 4,
    time: [10, 15],
    from: "juridique",
    fromName: "Juridique · Camille",
    to: ["da"],
    artistId: "gustave-rudman",
    urgency: "info",
    due: () => null,
    text: "Contrat d'édition de Gustave Rudman reçu, relecture en cours.",
    link: { kind: "page", href: "/placements" },
    steps: () => {
      const { gustave } = seedFacts();
      const share = gustave.publisherPct === null ? "" : ` à ${pct(gustave.publisherPct)}`;
      const works = gustave.undeclared.map((w) => `« ${w.title} » (${w.performer})`);
      const undeclared =
        works.length === 0
          ? ""
          : works.length === 1
            ? ` Et ${works[0]} n'est toujours pas déclarée à la Sacem.`
            : ` Et ${works.join(", ")} ne sont toujours pas déclarées à la Sacem.`;
      return [
        { after: h(23, 45), by: SOFIA, assign: "da-compos" },
        { after: h(23, 46), by: SOFIA, status: "doing" },
        { after: h(23, 50), by: SOFIA, reply: `Merci. À vérifier : la part éditeur${share}, comme sur ses œuvres déjà placées.${undeclared}` },
        {
          after: h(26, 50),
          by: CAMILLE,
          reply: `${gustave.publisherPct === null ? "C'est bien la même part" : `C'est bien ${pct(gustave.publisherPct)}`} dans le projet reçu. Retour de relecture sous huit jours.`,
        },
      ];
    },
  },
  {
    id: "seed-deezer-q3",
    daysAgo: 1,
    time: [15, 20],
    from: "finance",
    fromName: "Finance · Thomas",
    to: ["direction"],
    artistId: "elgrandetoto",
    urgency: "important",
    due: (t) => isoDay(shift(t, 7)),
    text: "Relevé Deezer Q3 reçu : écart d'audit sur ElGrandeToto, à arbitrer.",
    link: { kind: "audit", href: "/audit" },
    steps: (_note, today) => {
      const q = lastClosedQuarter(today);
      return [
        { after: 40, by: GAEL, assign: "gael" },
        {
          after: 45,
          by: GAEL,
          reply: `Rapprochement fait dans Audit : l'écart du ${q} porte sur Spotify, pas sur Deezer. La lettre de réclamation Spotify est déjà générée.`,
        },
        { after: 70, by: THOMAS, reply: "Exact, je corrige : c'est le relevé Spotify. Je pars sur la réclamation." },
        { after: 75, by: GAEL, status: "decided" },
      ];
    },
  },
];

export const SEED_IDS: readonly string[] = SPECS.map((s) => s.id);

/** Rejoue les étapes d'un exemple. `until` : s'arrêter avant (note traitée en v1) ; `clamp` : pas après. */
function play(base: FeedNote, steps: SeedStep[], opts: { until?: string; clamp?: string } = {}): FeedNote {
  let n = base;
  let k = 0;
  const t0 = Date.parse(base.createdAt);
  for (const s of steps) {
    let at = new Date(t0 + s.after * 60_000).toISOString();
    if (opts.until && at > opts.until) break;
    if (opts.clamp && at > opts.clamp) at = opts.clamp;
    if ("reply" in s) n = addReply(n, s.reply, { id: `${base.id}-r${++k}`, at, by: s.by, daOf: seedDaOf });
    else if ("status" in s) n = changeStatus(n, s.status, s.by, at);
    else n = assignNote(n, s.assign, { at, by: s.by, daOf: seedDaOf });
  }
  return n;
}

function lastAt(n: FeedNote): number {
  return Math.max(Date.parse(n.createdAt), ...n.history.map((e) => Date.parse(e.at)), ...n.replies.map((r) => Date.parse(r.at)));
}

/** Toute la chronologie d'une note décalée de `ms` (l'échéance, une date, ne bouge pas). */
function shiftNote(n: FeedNote, ms: number): FeedNote {
  const move = (iso: string) => new Date(Date.parse(iso) - ms).toISOString();
  return {
    ...n,
    createdAt: move(n.createdAt),
    doneAt: n.doneAt && move(n.doneAt),
    history: n.history.map((e) => ({ ...e, at: move(e.at) })),
    replies: n.replies.map((r) => ({ ...r, at: move(r.at) })),
  };
}

function baseNote(spec: SeedSpec, createdAt: string, dueDate: string | null): FeedNote {
  return createNote(
    {
      from: spec.from,
      fromName: spec.fromName,
      to: spec.to,
      artistId: spec.artistId,
      urgency: spec.urgency,
      dueDate,
      text: spec.text,
      link: spec.link,
      fromDaId: spec.from === "da" ? (spec.artistId ? seedDaOf(spec.artistId) : null) : null,
    },
    { id: spec.id, at: createdAt, daOf: seedDaOf },
  );
}

/**
 * Les exemples, datés par rapport à `today` (le jour de la démo, DEMO_TODAY, côté appli). Si la
 * dernière étape tombait après `now` (démo au jour même, tôt le matin), toute l'histoire est
 * avancée d'autant : jamais d'événement dans le futur.
 */
export function seedNotes(today: Date, now: Date = new Date()): FeedNote[] {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  return SPECS.map((spec) => {
    const createdAt = new Date(Date.UTC(y, m, d - spec.daysAgo, spec.time[0], spec.time[1])).toISOString();
    const base = baseNote(spec, createdAt, spec.due(today));
    const played = play(base, spec.steps(base, today));
    const late = lastAt(played) - now.getTime();
    return late > 0 ? shiftNote(played, late) : played;
  });
}

/**
 * Un exemple posé AVANT cette version (stockage v1 : ni réponse, ni prise en charge) reçoit sa vie
 * sans rien perdre : création, texte, échéance et statut gardés tels que stockés. Les étapes sont
 * rejouées depuis SA date de création ; une note déjà traitée garde sa date de traitement, et ne
 * reçoit que les étapes qui la précèdent. Une note qui n'est pas un exemple est rendue telle quelle.
 */
export function enrichLegacySeed(migrated: FeedNote, now: Date = new Date()): FeedNote {
  const spec = SPECS.find((s) => s.id === migrated.id);
  if (!spec) return migrated;
  const fresh: FeedNote = {
    ...migrated,
    status: "open",
    doneAt: null,
    stage: "todo",
    link: migrated.link ?? spec.link,
    history: migrated.history.slice(0, 1),
  };
  const anchor = new Date(Date.parse(migrated.createdAt) + spec.daysAgo * DAY);
  const doneAt = migrated.status === "done" ? (migrated.doneAt ?? migrated.createdAt) : undefined;
  const played = play(fresh, spec.steps(fresh, anchor), { until: doneAt, clamp: now.toISOString() });
  return doneAt ? changeStatus(played, "done", null, doneAt) : played;
}

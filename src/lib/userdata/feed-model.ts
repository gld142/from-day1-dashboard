/**
 * Fil entre services — le MODÈLE, pur (aucun stockage, aucun DOM, aucune horloge : l'appelant
 * passe les dates). Le stockage local vit dans feed-store.ts, les exemples dans feed-seed.ts.
 *
 * Ce qu'une note porte en plus de la forme de la spec (§5, « v1 ») :
 * - un STATUT à quatre valeurs (à faire, en cours, décidé, traité). Le champ `status` de la spec
 *   reste « open » / « done » (Pulse, le roster et la pastille comptent les notes « open ») ;
 *   l'étape d'une note ouverte vit dans `stage`. `statusOf` lit les deux.
 * - un historique daté et signé (création, statut, réponse, prise en charge) ;
 * - des réponses en fil ; des mentions (@Finance, @DA Inès…) qui ajoutent des destinataires ;
 * - une prise en charge par une personne (liste fictive) ; un lien vers l'objet (contrat, relevé,
 *   écart d'audit, artiste, page).
 *
 * Périmètre des DA (spec §4) : un DA ne reçoit une note d'artiste que si c'est SON artiste. Ni une
 * mention, ni une prise en charge ne l'élargissent : `@DA Julien` sur une note de Leto (DA urbain)
 * n'envoie rien à Julien (`outOfScope`), et Julien ne peut pas la prendre en charge.
 */
import { DAS } from "@/lib/demo/das";
import { JOB_ROLES, isJobRole, type JobRole } from "@/lib/roles";

export const FEED_TEXT_MAX = 500;

export type Urgency = "info" | "important" | "urgent";
export const URGENCIES: Urgency[] = ["urgent", "important", "info"];
const isUrgency = (v: unknown): v is Urgency => v === "info" || v === "important" || v === "urgent";

/** Étape d'une note ouverte ; « done » est le `status` de la spec. */
export type FeedStage = "todo" | "doing" | "decided";
export type FeedStatus = FeedStage | "done";
export const FEED_STATUSES: readonly FeedStatus[] = ["todo", "doing", "decided", "done"];
const isStage = (v: unknown): v is FeedStage => v === "todo" || v === "doing" || v === "decided";
const isStatus = (v: unknown): v is FeedStatus => isStage(v) || v === "done";

/** Qui agit : le métier courant (et son DA), avec le libellé figé à l'action, comme `fromName`. */
export type Actor = { role: JobRole | null; daId: string | null; name: string };

/** Un destinataire ajouté par une mention ou une prise en charge : un service, ou un DA précis. */
export type Recipient = { kind: "role"; role: JobRole } | { kind: "da"; daId: string };

export type FeedReply = { id: string; at: string; by: Actor; text: string };

export type FeedEvent =
  | { type: "created"; at: string; by: Actor | null }
  | { type: "status"; at: string; by: Actor | null; from: FeedStatus; to: FeedStatus }
  | { type: "reply"; at: string; by: Actor; replyId: string; added: Recipient[] }
  | { type: "assign"; at: string; by: Actor | null; personId: string | null; added: Recipient[] };

export const LINK_KINDS = ["contract", "statement", "audit", "artist", "page"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export type FeedLink = { kind: LinkKind; href: string };

export type FeedNote = {
  id: string;
  createdAt: string;
  from: JobRole;
  /** « Juridique · Camille » — le service et la personne, tel qu'affiché, figé à la création. */
  fromName: string;
  /** Services visés (« da » : le DA de l'artiste, ou tous les DA pour une note sans artiste). */
  to: JobRole[];
  artistId: string | null;
  urgency: Urgency;
  /** AAAA-MM-JJ, ou null. */
  dueDate: string | null;
  /** 500 caractères max. */
  text: string;
  status: "open" | "done";
  doneAt: string | null;
  /** Étape tant que la note est ouverte (gardée quand elle est traitée). */
  stage: FeedStage;
  /** DA visés nommément (@DA Inès, prise en charge), quand le service « da » n'est pas visé. */
  toDas: string[];
  assigneeId: string | null;
  link: FeedLink | null;
  replies: FeedReply[];
  history: FeedEvent[];
};

export type NewNote = Pick<FeedNote, "from" | "fromName" | "to" | "artistId" | "urgency" | "dueDate" | "text"> & {
  link?: FeedLink | null;
  /** Le DA auteur, pour l'historique (facultatif). */
  fromDaId?: string | null;
};

/** artistId → DA (data.ts) ; passé par l'appelant pour garder ce module pur. */
export type DaOf = (artistId: string) => string | null;

export function statusOf(n: Pick<FeedNote, "status" | "stage">): FeedStatus {
  return n.status === "done" ? "done" : n.stage;
}

/* ─── Personnes (fictives) ─── */

export type FeedPerson = { id: string; name: string; role: JobRole; daId: string | null };

/** Prénoms FICTIFS, cohérents avec les auteurs des exemples ; les DA sont ceux de das.ts. */
export const FEED_PEOPLE: readonly FeedPerson[] = [
  { id: "camille", name: "Camille", role: "juridique", daId: null },
  { id: "thomas", name: "Thomas", role: "finance", daId: null },
  { id: "gael", name: "Gaël", role: "direction", daId: null },
  ...DAS.map((d) => ({ id: d.id, name: d.name, role: "da" as const, daId: d.id })),
];

export function getPerson(id: string): FeedPerson | null {
  return FEED_PEOPLE.find((p) => p.id === id) ?? null;
}

/* ─── Périmètre ─── */

/** Le DA suit-il l'artiste de la note ? Une note sans artiste est dans le périmètre de tous. */
export function inPerimeter(note: Pick<FeedNote, "artistId">, daId: string, daOf: DaOf): boolean {
  return !note.artistId || daOf(note.artistId) === daId;
}

/** Statut, réponse, prise en charge : un DA seulement sur son périmètre ; les autres métiers partout. */
export function canActOn(note: Pick<FeedNote, "artistId">, role: JobRole | null, daId: string | null, daOf: DaOf): boolean {
  if (role !== "da") return true;
  return daId !== null && inPerimeter(note, daId, daOf);
}

/* ─── Mentions ─── */

export type Mention = { kind: "role"; role: JobRole } | { kind: "da"; daId: string };
export type TextSegment = { type: "text"; text: string } | { type: "mention"; text: string; mention: Mention };

/** Sans accents ni casse : « Présidence » = « presidence ». Un caractère NFC reste un caractère. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c);

/* Libellés des services en français ET en anglais (interface anglaise : Legal, Management…). */
const ROLE_ALIASES: Array<[string, JobRole]> = (
  [
    ["finance", "finance"],
    ["juridique", "juridique"],
    ["legal", "juridique"],
    ["direction", "direction"],
    ["management", "direction"],
    ["presidence", "presidence"],
    ["chairman", "presidence"],
    ["da", "da"],
    ["a&r", "da"],
  ] as Array<[string, JobRole]>
).sort((a, b) => b[0].length - a[0].length);

const CATEGORY_ALIASES: Record<string, string[]> = {
  urbain: ["urbain", "urban"],
  variete: ["variete"],
  compositeur: ["compositeurs", "compositeur", "compos", "composers"],
};

/** « @DA Inès M. », « @DA Inès », « @DA urbain » : le nom complet, le prénom, la catégorie. */
const DA_ALIASES: Array<[string, string]> = DAS.flatMap((d) =>
  [fold(d.name), fold(d.name.split(" ")[0]), ...(CATEGORY_ALIASES[d.category] ?? [])].map((a) => [a, d.id] as [string, string]),
).sort((a, b) => b[0].length - a[0].length);

function matchAt(s: string, at: number, alias: string): boolean {
  return fold(s.slice(at, at + alias.length)) === alias && !isWordChar(s[at + alias.length]);
}

/** Une mention qui commence juste après « @ » en `at` : sa longueur et ce qu'elle vise. */
function mentionAt(s: string, at: number): { length: number; mention: Mention } | null {
  for (const [alias, role] of ROLE_ALIASES) {
    if (!matchAt(s, at, alias)) continue;
    if (role === "da") {
      let k = at + alias.length;
      while (s[k] === " " || s[k] === " ") k++;
      if (k > at + alias.length) {
        for (const [daAlias, daId] of DA_ALIASES) {
          if (matchAt(s, k, daAlias)) return { length: k + daAlias.length - at, mention: { kind: "da", daId } };
        }
      }
    }
    return { length: alias.length, mention: { kind: "role", role } };
  }
  return null;
}

/** Le texte en morceaux, pour l'afficher avec les mentions en pastilles. Rien n'est perdu. */
export function splitMentions(text: string): TextSegment[] {
  const s = text.normalize("NFC");
  const out: TextSegment[] = [];
  let buf = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "@" && !isWordChar(s[i - 1])) {
      const m = mentionAt(s, i + 1);
      if (m) {
        if (buf) out.push({ type: "text", text: buf });
        buf = "";
        out.push({ type: "mention", text: s.slice(i, i + 1 + m.length), mention: m.mention });
        i += 1 + m.length;
        continue;
      }
    }
    buf += s[i];
    i++;
  }
  if (buf) out.push({ type: "text", text: buf });
  return out;
}

const mentionKey = (m: Mention) => (m.kind === "role" ? `r:${m.role}` : `d:${m.daId}`);

/** Les mentions d'un texte, dans l'ordre, sans doublon. */
export function parseMentions(text: string): Mention[] {
  const seen = new Set<string>();
  const out: Mention[] = [];
  for (const seg of splitMentions(text)) {
    if (seg.type !== "mention" || seen.has(mentionKey(seg.mention))) continue;
    seen.add(mentionKey(seg.mention));
    out.push(seg.mention);
  }
  return out;
}

type Recipients = Pick<FeedNote, "to" | "toDas" | "artistId">;

/** Ajoute des destinataires ; renvoie la note (même référence si rien ne change) et ceux ajoutés. */
function addRecipients<T extends Recipients>(note: T, list: Recipient[]): { note: T; added: Recipient[] } {
  const to = [...note.to];
  const toDas = [...note.toDas];
  const added: Recipient[] = [];
  for (const r of list) {
    if (r.kind === "role") {
      if (to.includes(r.role)) continue;
      to.push(r.role);
      added.push(r);
    } else {
      // « da » visé couvre déjà le DA de l'artiste (ou tous les DA sans artiste).
      if (to.includes("da") || toDas.includes(r.daId)) continue;
      toDas.push(r.daId);
      added.push(r);
    }
  }
  return added.length === 0 ? { note, added } : { note: { ...note, to, toDas }, added };
}

/**
 * Ce que les mentions d'un texte feraient à la note : les destinataires ajoutés, et les DA nommés
 * qui ne suivent pas l'artiste (ignorés : pas de fuite hors périmètre). Sert aussi à l'aperçu.
 */
export function mentionEffects(note: Recipients, text: string, daOf: DaOf): { added: Recipient[]; outOfScope: string[] } {
  const wanted: Recipient[] = [];
  const outOfScope: string[] = [];
  for (const m of parseMentions(text)) {
    if (m.kind === "role") wanted.push({ kind: "role", role: m.role });
    else if (inPerimeter(note, m.daId, daOf)) wanted.push({ kind: "da", daId: m.daId });
    else outOfScope.push(m.daId);
  }
  return { added: addRecipients(note, wanted).added, outOfScope };
}

function withMentions<T extends Recipients>(note: T, text: string, daOf: DaOf): { note: T; added: Recipient[] } {
  return addRecipients(note, mentionEffects(note, text, daOf).added);
}

const cleanText = (text: string) => text.normalize("NFC").trim().slice(0, FEED_TEXT_MAX);

/* ─── Actions (pures : chacune rend une NOUVELLE note, ou la même si rien ne change) ─── */

export function createNote(input: NewNote, opts: { id: string; at: string; daOf: DaOf; by?: Actor }): FeedNote {
  const text = cleanText(input.text);
  const base: FeedNote = {
    id: opts.id,
    createdAt: opts.at,
    from: input.from,
    fromName: input.fromName,
    to: [...new Set(input.to)],
    artistId: input.artistId,
    urgency: input.urgency,
    dueDate: input.dueDate,
    text,
    status: "open",
    doneAt: null,
    stage: "todo",
    toDas: [],
    assigneeId: null,
    link: input.link ?? null,
    replies: [],
    history: [
      { type: "created", at: opts.at, by: opts.by ?? { role: input.from, daId: input.fromDaId ?? null, name: input.fromName } },
    ],
  };
  return withMentions(base, text, opts.daOf).note;
}

export function changeStatus(note: FeedNote, to: FeedStatus, by: Actor | null, at: string): FeedNote {
  const from = statusOf(note);
  if (from === to) return note;
  const next: FeedNote =
    to === "done" ? { ...note, status: "done", doneAt: at } : { ...note, status: "open", stage: to, doneAt: null };
  return { ...next, history: [...note.history, { type: "status", at, by, from, to }] };
}

export function addReply(note: FeedNote, text: string, opts: { id: string; at: string; by: Actor; daOf: DaOf }): FeedNote {
  const clean = cleanText(text);
  if (!clean) return note;
  const { note: addressed, added } = withMentions(note, clean, opts.daOf);
  return {
    ...addressed,
    replies: [...note.replies, { id: opts.id, at: opts.at, by: opts.by, text: clean }],
    history: [...note.history, { type: "reply", at: opts.at, by: opts.by, replyId: opts.id, added }],
  };
}

/** Les personnes qui peuvent prendre la note : tout le monde, sauf les DA qui ne suivent pas l'artiste. */
export function assignableFor(note: Pick<FeedNote, "artistId">, daOf: DaOf): FeedPerson[] {
  return FEED_PEOPLE.filter((p) => p.daId === null || inPerimeter(note, p.daId, daOf));
}

export function assignNote(note: FeedNote, personId: string | null, opts: { at: string; by: Actor | null; daOf: DaOf }): FeedNote {
  if (note.assigneeId === personId) return note;
  let addressed = note;
  let added: Recipient[] = [];
  if (personId !== null) {
    const person = getPerson(personId);
    if (!person || !assignableFor(note, opts.daOf).includes(person)) return note;
    ({ note: addressed, added } = addRecipients(
      note,
      person.daId ? [{ kind: "da", daId: person.daId }] : [{ kind: "role", role: person.role }],
    ));
  }
  return {
    ...addressed,
    assigneeId: personId,
    history: [...note.history, { type: "assign", at: opts.at, by: opts.by, personId, added }],
  };
}

/* ─── Lectures ─── */

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, important: 1, info: 2 };

/** Urgence, puis échéance croissante (sans échéance en dernier), puis la plus récente d'abord. */
export function sortNotes<T extends Pick<FeedNote, "urgency" | "dueDate" | "createdAt">>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/**
 * Les notes OUVERTES à traiter par un rôle : adressées à son service (mentions et prises en charge
 * comprises) ; pour un DA, seulement celles de ses artistes (une note sans artiste s'adresse à
 * tous les DA, ou aux seuls DA nommés). Sans rôle (maison day1) : tout ce qui est ouvert.
 */
export function notesForRole<T extends Pick<FeedNote, "status" | "to" | "artistId"> & { toDas?: string[] }>(
  notes: T[],
  role: JobRole | null,
  daId: string | null,
  daOf: DaOf,
): T[] {
  return notes.filter((n) => {
    if (n.status !== "open") return false;
    if (!role) return true;
    if (role !== "da") return n.to.includes(role);
    const addressed = n.to.includes("da") || (daId !== null && (n.toDas ?? []).includes(daId));
    if (!addressed) return false;
    if (daId && n.artistId) return daOf(n.artistId) === daId;
    return true;
  });
}

export function openCountByArtist(notes: Array<Pick<FeedNote, "status" | "artistId">>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of notes) if (n.status === "open" && n.artistId) out[n.artistId] = (out[n.artistId] ?? 0) + 1;
  return out;
}

/* ─── Échéances ─── */

export type DueState = "overdue" | "soon";
/** « Cette semaine » : du jour même à J+6 (sept jours glissants). */
export const DUE_SOON_DAYS = 6;

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

/** `today` = le jour de la DÉMO (DEMO_TODAY, AAAA-MM-JJ), passé par l'appelant, jamais l'horloge. */
export function dueState(note: Pick<FeedNote, "dueDate" | "status">, today: string): DueState | null {
  if (note.status === "done" || !note.dueDate) return null;
  const days = dayNumber(note.dueDate) - dayNumber(today);
  if (days < 0) return "overdue";
  return days <= DUE_SOON_DAYS ? "soon" : null;
}

/* ─── Ordre du jour du comité ─── */

export type AgendaService = JobRole | "several";
export type AgendaGroup = { urgency: Urgency; services: Array<{ service: AgendaService; notes: FeedNote[] }> };
const AGENDA_SERVICES: readonly AgendaService[] = [...JOB_ROLES, "several"];

/** Le service en charge : celui de la personne qui a pris la note, sinon le service visé s'il est seul. */
export function agendaService(note: Pick<FeedNote, "assigneeId" | "to" | "toDas">): AgendaService {
  const person = note.assigneeId ? getPerson(note.assigneeId) : null;
  if (person) return person.role;
  const roles = new Set<JobRole>(note.to);
  if (note.toDas.length > 0) roles.add("da");
  return roles.size === 1 ? [...roles][0] : "several";
}

/** Les notes NON traitées, par urgence puis par service en charge ; groupes vides omis. */
export function committeeAgenda(notes: FeedNote[]): AgendaGroup[] {
  const open = notes.filter((n) => n.status === "open");
  return URGENCIES.map((urgency) => {
    const ofUrgency = open.filter((n) => n.urgency === urgency);
    const services = AGENDA_SERVICES.map((service) => ({
      service,
      notes: sortNotes(ofUrgency.filter((n) => agendaService(n) === service)),
    })).filter((s) => s.notes.length > 0);
    return { urgency, services };
  }).filter((g) => g.services.length > 0);
}

/* ─── Lien vers l'objet ─── */

/**
 * Les cibles proposées dans « Nouvelle note ». Toutes existent dans les deux maisons (aucune page
 * interne, testé par feed-links.test.ts contre les dossiers de app/(dashboard)).
 */
export const LINK_TARGETS: readonly FeedLink[] = [
  { kind: "contract", href: "/contracts" },
  { kind: "statement", href: "/rights" },
  { kind: "audit", href: "/audit" },
  { kind: "artist", href: "/pulse" },
  { kind: "page", href: "/splits" },
  { kind: "page", href: "/placements" },
];

/** Pages qui suivent le zoom artiste (`focusedArtistId`, role.tsx) : « Ouvrir » y zoome. */
export const ZOOM_PAGES: ReadonlySet<string> = new Set(["/contracts", "/rights", "/audit", "/splits", "/placements", "/pulse"]);

export type OpenPlan = { href: string; focus: { artistId: string | null } | null };

/**
 * Où mène « Ouvrir » : la page, et le zoom à poser (l'artiste de la note ; aucun pour une note sans
 * artiste, pour voir tout le roster). `canSeeArtist` faux (artiste hors du périmètre du DA) : pas de
 * bouton — sinon un DA se retrouverait zoomé sur l'artiste d'un autre.
 */
export function openPlan(note: Pick<FeedNote, "artistId" | "link">, canSeeArtist: boolean): OpenPlan | null {
  const link = note.link;
  if (!link) return null;
  if (note.artistId && !canSeeArtist) return null;
  if (link.kind === "artist" && !note.artistId) return null;
  return { href: link.href, focus: ZOOM_PAGES.has(link.href) ? { artistId: note.artistId } : null };
}

/* ─── Lecture du stockage : ancienne forme (v1) et forme courante (v2) ─── */

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function isActor(v: unknown): v is Actor {
  return isRecord(v) && typeof v.name === "string" && (v.role === null || isJobRole(v.role)) && (v.daId === null || typeof v.daId === "string");
}
function isRecipient(v: unknown): v is Recipient {
  return isRecord(v) && ((v.kind === "role" && isJobRole(v.role)) || (v.kind === "da" && typeof v.daId === "string"));
}
function isEvent(v: unknown): v is FeedEvent {
  if (!isRecord(v) || typeof v.at !== "string") return false;
  const byOrNull = v.by === null || isActor(v.by);
  const recipients = Array.isArray(v.added) && v.added.every(isRecipient);
  switch (v.type) {
    case "created":
      return byOrNull;
    case "status":
      return byOrNull && isStatus(v.from) && isStatus(v.to);
    case "reply":
      return isActor(v.by) && typeof v.replyId === "string" && recipients;
    case "assign":
      return byOrNull && (v.personId === null || typeof v.personId === "string") && recipients;
    default:
      return false;
  }
}
function isReply(v: unknown): v is FeedReply {
  return isRecord(v) && typeof v.id === "string" && typeof v.at === "string" && typeof v.text === "string" && isActor(v.by);
}
function isLink(v: unknown): v is FeedLink {
  return isRecord(v) && (LINK_KINDS as readonly unknown[]).includes(v.kind) && typeof v.href === "string" && v.href.startsWith("/");
}

/** Les champs de la spec (v1), validés comme avant ; null si ce n'est pas une note. */
function v1Fields(raw: unknown): Omit<FeedNote, "stage" | "toDas" | "assigneeId" | "link" | "replies" | "history"> | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.text !== "string" || !Array.isArray(raw.to)) return null;
  if (raw.status !== "open" && raw.status !== "done") return null;
  const createdAt = str(raw.createdAt) ?? "1970-01-01T00:00:00.000Z";
  return {
    id: raw.id,
    createdAt,
    from: isJobRole(raw.from) ? raw.from : "direction",
    fromName: str(raw.fromName) ?? "",
    to: raw.to.filter(isJobRole),
    artistId: str(raw.artistId),
    urgency: isUrgency(raw.urgency) ? raw.urgency : "info",
    dueDate: str(raw.dueDate),
    text: raw.text,
    status: raw.status,
    doneAt: str(raw.doneAt),
  };
}

function createdEvent(n: Pick<FeedNote, "createdAt" | "from" | "fromName">): FeedEvent {
  return { type: "created", at: n.createdAt, by: { role: n.from, daId: null, name: n.fromName } };
}

/**
 * Une note de l'ancienne forme (v1 : « open » / « done », « Traité » seul) dans la forme courante,
 * SANS PERTE : chaque champ v1 est gardé tel quel. À faire, sans réponse ni prise en charge ;
 * l'historique dit la création et, si elle est traitée, le passage à « traité » (auteur inconnu en
 * v1). Ce qui n'est pas une note : null, jamais une erreur.
 */
export function migrateNote(raw: unknown): FeedNote | null {
  const v1 = v1Fields(raw);
  if (!v1) return null;
  const history: FeedEvent[] = [createdEvent(v1)];
  if (v1.status === "done") history.push({ type: "status", at: v1.doneAt ?? v1.createdAt, by: null, from: "todo", to: "done" });
  return { ...v1, stage: "todo", toDas: [], assigneeId: null, link: null, replies: [], history };
}

/** Relecture d'une note v2 : les champs v2 abîmés sont remis à zéro, la note n'est jamais perdue. */
export function normalizeNote(raw: unknown): FeedNote | null {
  const v1 = v1Fields(raw);
  if (!v1 || !isRecord(raw)) return null;
  const history = Array.isArray(raw.history) ? raw.history.filter(isEvent) : [];
  return {
    ...v1,
    stage: isStage(raw.stage) ? raw.stage : "todo",
    toDas: Array.isArray(raw.toDas) ? raw.toDas.filter((d): d is string => typeof d === "string") : [],
    assigneeId: str(raw.assigneeId),
    link: isLink(raw.link) ? raw.link : null,
    replies: Array.isArray(raw.replies) ? raw.replies.filter(isReply) : [],
    history: history.length > 0 ? history : [createdEvent(v1)],
  };
}

/**
 * Organisation modulable de la maison (démo) : des PÔLES (départements internes), les
 * CATÉGORIES existantes, des PERSONNES (DA, chefs de projet, marketing, juriste référent) et,
 * pour chaque artiste, son attribution (pôle, catégorie, DA principal, équipe).
 *
 * Module PUR et LÉGER : il n'importe que `das.ts` et `types.ts` — `role.tsx` (fournisseur
 * racine, donc /connexion et /inscription) passe par org-store.ts, qui l'importe. Jamais
 * `data.ts` ici : les attributions se résolvent contre la liste d'artistes que l'appelant passe.
 *
 * L'état stocké ne garde que les ÉCARTS au défaut (`assignments`, champ par champ) : sans
 * écart, chaque artiste garde la catégorie et le DA de data.ts — l'état d'avant, à l'identique.
 *
 * Noms FICTIFS (prénom + initiale) et pôles GÉNÉRIQUES : aucun vrai label ni organigramme
 * Universal — on ne les connaît pas.
 */
import { DAS } from "./das";
import { ARTIST_CATEGORIES, isArtistCategory, type Artist, type ArtistCategory } from "./types";

export const ORG_KINDS = ["da", "projet", "marketing", "juridique"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];
export function isOrgKind(v: unknown): v is OrgKind {
  return typeof v === "string" && (ORG_KINDS as readonly string[]).includes(v);
}

export type OrgPerson = { id: string; name: string; kind: OrgKind };
/** `name: null` = nom par défaut, traduit (`organisation.poles.<id>`) ; un pôle ajouté porte son nom. */
export type OrgPole = { id: string; name: string | null };

export type ArtistAssignment = {
  poleId: string;
  category: ArtistCategory;
  daId: string;
  projectLeadId: string;
  marketingId: string;
  legalId: string;
};
export const ASSIGNMENT_FIELDS = ["poleId", "category", "daId", "projectLeadId", "marketingId", "legalId"] as const;
export type AssignmentField = (typeof ASSIGNMENT_FIELDS)[number];
/** Le métier attendu derrière chaque champ « personne » de l'attribution. */
export const FIELD_KIND: Record<Exclude<AssignmentField, "poleId" | "category">, OrgKind> = {
  daId: "da",
  projectLeadId: "projet",
  marketingId: "marketing",
  legalId: "juridique",
};

export type OrgState = {
  version: 1;
  people: OrgPerson[];
  poles: OrgPole[];
  /** Écarts au défaut, par artiste et par champ. Absent = l'attribution par défaut. */
  assignments: Record<string, Partial<ArtistAssignment>>;
};

/** Regroupements du roster (`?groupe=`) : catégorie (défaut, absent de l'URL), DA, pôle. */
export const ORG_GROUPINGS = ["categorie", "da", "pole"] as const;
export type OrgGrouping = (typeof ORG_GROUPINGS)[number];

/* ─────────────────────────── Valeurs par défaut ─────────────────────────── */

export const DEFAULT_POLES: OrgPole[] = [
  { id: "pole-urbain", name: null },
  { id: "pole-pop", name: null },
  { id: "pole-edition", name: null },
];

const POLE_OF_CATEGORY: Record<ArtistCategory, string> = {
  urbain: "pole-urbain",
  variete: "pole-pop",
  compositeur: "pole-edition",
};
const PROJECT_LEAD_OF_CATEGORY: Record<ArtistCategory, string> = {
  urbain: "cp-urbain",
  variete: "cp-variete",
  compositeur: "cp-compos",
};
const MARKETING_OF_CATEGORY: Record<ArtistCategory, string> = {
  urbain: "mk-urbain",
  variete: "mk-pop",
  compositeur: "mk-pop",
};
/** « Camille », la juriste que le fil de démo cite déjà (« Juridique · Camille »). */
const DEFAULT_LEGAL_ID = "jur-camille";

export const DEFAULT_PEOPLE: OrgPerson[] = [
  ...DAS.map((d) => ({ id: d.id, name: d.name, kind: "da" as const })),
  { id: "cp-urbain", name: "Karim B.", kind: "projet" },
  { id: "cp-variete", name: "Léa D.", kind: "projet" },
  { id: "cp-compos", name: "Hugo T.", kind: "projet" },
  { id: "mk-urbain", name: "Sarah L.", kind: "marketing" },
  { id: "mk-pop", name: "Thomas V.", kind: "marketing" },
  { id: DEFAULT_LEGAL_ID, name: "Camille", kind: "juridique" },
];

/** UNE référence : `parseOrgState` la rend pour toute entrée invalide (stabilité de useSyncExternalStore). */
export const DEFAULT_ORG: OrgState = { version: 1, people: DEFAULT_PEOPLE, poles: DEFAULT_POLES, assignments: {} };

/** L'attribution d'un artiste sans écart : celle que data.ts décrit (catégorie, DA) et l'équipe de sa catégorie. */
export function defaultAssignment(artist: Pick<Artist, "category" | "daId">): ArtistAssignment {
  return {
    poleId: POLE_OF_CATEGORY[artist.category],
    category: artist.category,
    daId: artist.daId,
    projectLeadId: PROJECT_LEAD_OF_CATEGORY[artist.category],
    marketingId: MARKETING_OF_CATEGORY[artist.category],
    legalId: DEFAULT_LEGAL_ID,
  };
}

/* ─────────────────────────── Lecture ─────────────────────────── */

export function peopleOf(org: OrgState, kind: OrgKind): OrgPerson[] {
  return org.people.filter((p) => p.kind === kind);
}
export function orgDas(org: OrgState): OrgPerson[] {
  return peopleOf(org, "da");
}
export function hasPerson(org: OrgState, id: string, kind: OrgKind): boolean {
  return org.people.some((p) => p.id === id && p.kind === kind);
}
export function hasDa(org: OrgState, id: string | null): boolean {
  return !!id && hasPerson(org, id, "da");
}
export function personName(org: OrgState, id: string | null): string | null {
  return id ? (org.people.find((p) => p.id === id)?.name ?? null) : null;
}

/** Un écart n'est retenu que s'il désigne quelque chose qui existe (pôle, catégorie, personne du bon métier). */
function validField(org: OrgState, field: AssignmentField, value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (field === "poleId") return org.poles.some((p) => p.id === value);
  if (field === "category") return isArtistCategory(value);
  return hasPerson(org, value, FIELD_KIND[field]);
}

/** L'attribution effective : les écarts valides par-dessus le défaut de l'artiste. */
export function resolveAssignment(artist: Pick<Artist, "id" | "category" | "daId">, org: OrgState): ArtistAssignment {
  const base = defaultAssignment(artist);
  const over = org.assignments[artist.id];
  if (!over) return base;
  const out = { ...base };
  for (const f of ASSIGNMENT_FIELDS) {
    const v = over[f];
    if (v !== undefined && validField(org, f, v)) (out as Record<AssignmentField, string>)[f] = v;
  }
  return out;
}

/**
 * Les artistes tels que l'organisation les voit : des COPIES dont la catégorie et le DA suivent
 * l'attribution. Tout ce qui lit `a.daId` / `a.category` en aval (périmètre DA, regroupements,
 * lignes du roster) suit donc une réattribution sans autre changement.
 */
export function applyOrg<A extends Pick<Artist, "id" | "category" | "daId">>(artists: readonly A[], org: OrgState): A[] {
  return artists.map((a) => {
    const r = resolveAssignment(a, org);
    return r.category === a.category && r.daId === a.daId ? { ...a } : { ...a, category: r.category, daId: r.daId };
  });
}

/** Les catégories que suit un DA : celles de SES artistes (attribution réelle), dans l'ordre fixe. */
export function daCategories(
  org: OrgState,
  artists: readonly Pick<Artist, "id" | "category" | "daId">[],
  daId: string,
): ArtistCategory[] {
  const mine = new Set(
    artists.map((a) => resolveAssignment(a, org)).filter((r) => r.daId === daId).map((r) => r.category),
  );
  return ARTIST_CATEGORIES.filter((c) => mine.has(c));
}

/** Combien d'artistes chaque personne / pôle porte (Réglages : « 4 artistes »). */
export function countBy(
  org: OrgState,
  artists: readonly Pick<Artist, "id" | "category" | "daId">[],
  field: AssignmentField,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of artists) {
    const v = resolveAssignment(a, org)[field];
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

/* ─────────────────────────── Regroupements ─────────────────────────── */

export type GroupableRow = Pick<Artist, "id" | "category" | "daId"> & { streams30d: number; revenue12m: number };
export type RowGroup<R> = { key: string; rows: R[]; count: number; streams30d: number; revenue12m: number };

/** La clé de groupe d'un artiste : sa catégorie, son DA ou son pôle (attribution effective). */
export function groupKey(row: Pick<Artist, "id" | "category" | "daId">, by: OrgGrouping, org: OrgState): string {
  const r = resolveAssignment(row, org);
  return by === "da" ? r.daId : by === "pole" ? r.poleId : r.category;
}

/**
 * Les groupes du tableau roster, dans un ordre fixe (catégories ; DA puis pôles dans l'ordre de
 * l'organisation), groupes vides retirés. Les lignes gardent l'ordre reçu (le tri courant du
 * tableau). Sous-totaux : nombre, streams 30 j et revenus 12 m — les mêmes sommes que l'en-tête
 * de groupe par catégorie d'avant.
 */
export function groupRows<R extends GroupableRow>(rows: readonly R[], by: OrgGrouping, org: OrgState): RowGroup<R>[] {
  const order: string[] =
    by === "da" ? orgDas(org).map((p) => p.id) : by === "pole" ? org.poles.map((p) => p.id) : [...ARTIST_CATEGORIES];
  const buckets = new Map<string, R[]>(order.map((k) => [k, []]));
  for (const row of rows) {
    const k = groupKey(row, by, org);
    const bucket = buckets.get(k);
    if (bucket) bucket.push(row);
    else buckets.set(k, [row]);
  }
  return [...buckets.entries()]
    .filter(([, rs]) => rs.length > 0)
    .map(([key, rs]) => ({
      key,
      rows: rs,
      count: rs.length,
      streams30d: rs.reduce((s, r) => s + r.streams30d, 0),
      revenue12m: rs.reduce((s, r) => s + r.revenue12m, 0),
    }));
}

/** `?groupe=da` / `?groupe=pole` ; toute autre valeur (ou rien) : par catégorie. */
export function parseGrouping(params: { get(name: string): string | null }): OrgGrouping {
  const g = params.get("groupe");
  return g === "da" || g === "pole" ? g : "categorie";
}

/* ─────────────────────────── Écritures (pures) ─────────────────────────── */

const MAX_NAME = 40;
const cleanName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);

/** Renomme une personne ; un nom vide ou inchangé laisse l'état tel quel (même référence). */
export function renamePerson(org: OrgState, id: string, name: string): OrgState {
  const next = cleanName(name);
  const p = org.people.find((x) => x.id === id);
  if (!p || !next || p.name === next) return org;
  return { ...org, people: org.people.map((x) => (x.id === id ? { ...x, name: next } : x)) };
}

function freshId(prefix: string, taken: readonly string[]): string {
  let n = 1;
  while (taken.includes(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

/** Ajoute une personne (id « <métier>-org-<n> ») ; un nom vide n'ajoute rien (`id: null`). */
export function addPerson(org: OrgState, kind: OrgKind, name: string): { org: OrgState; id: string | null } {
  const clean = cleanName(name);
  if (!clean) return { org, id: null };
  const id = freshId(`${kind}-org`, org.people.map((p) => p.id));
  return { org: { ...org, people: [...org.people, { id, name: clean, kind }] }, id };
}

/** Ajoute un pôle (id « pole-org-<n> ») ; un nom vide n'ajoute rien. */
export function addPole(org: OrgState, name: string): { org: OrgState; id: string | null } {
  const clean = cleanName(name);
  if (!clean) return { org, id: null };
  const id = freshId("pole-org", org.poles.map((p) => p.id));
  return { org: { ...org, poles: [...org.poles, { id, name: clean }] }, id };
}

/**
 * Attribue un champ à un artiste. Une valeur égale au défaut de l'artiste efface l'écart (l'état
 * revient au défaut au lieu d'empiler des écarts nuls) ; une valeur qui ne désigne rien est ignorée.
 */
export function assignArtist(
  org: OrgState,
  artist: Pick<Artist, "id" | "category" | "daId">,
  field: AssignmentField,
  value: string,
): OrgState {
  /* Valeur invalide, ou déjà la valeur effective : même référence (aucune notification inutile). */
  if (!validField(org, field, value) || resolveAssignment(artist, org)[field] === value) return org;
  const current = { ...org.assignments[artist.id] };
  if (defaultAssignment(artist)[field] === value) delete current[field];
  else (current as Record<AssignmentField, string>)[field] = value;
  const assignments = { ...org.assignments };
  if (Object.keys(current).length === 0) delete assignments[artist.id];
  else assignments[artist.id] = current;
  return { ...org, assignments };
}

/** L'organisation s'écarte-t-elle du défaut ? (« Réinitialiser » n'apparaît qu'alors.) */
export function isOrgChanged(org: OrgState): boolean {
  return org !== DEFAULT_ORG && JSON.stringify(org) !== JSON.stringify(DEFAULT_ORG);
}

/* ─────────────────────────── Lecture du stockage ─────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Pur : l'organisation depuis la chaîne stockée. Ne lève jamais : JSON invalide, « null », un
 * tableau, une autre version → `DEFAULT_ORG` (la même référence). Champ par champ, ce qui est
 * mal formé est écarté : une personne ou un pôle sans id ni nom, un métier inconnu, une
 * attribution vers ce qui n'existe pas. Les personnes et pôles par défaut sont toujours là
 * (renommés si le stockage le dit) : un stockage tronqué ne fait pas disparaître un DA.
 */
export function parseOrgState(raw: string | null): OrgState {
  if (!raw) return DEFAULT_ORG;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return DEFAULT_ORG;
  }
  if (!isObj(saved) || saved.version !== 1) return DEFAULT_ORG;

  const storedPeople = Array.isArray(saved.people) ? saved.people.filter(isObj) : [];
  const people: OrgPerson[] = DEFAULT_PEOPLE.map((d) => {
    const s = storedPeople.find((p) => p.id === d.id);
    const name = typeof s?.name === "string" ? cleanName(s.name) : "";
    return name ? { ...d, name } : d;
  });
  for (const p of storedPeople) {
    if (typeof p.id !== "string" || !p.id || people.some((x) => x.id === p.id)) continue;
    const name = typeof p.name === "string" ? cleanName(p.name) : "";
    if (name && isOrgKind(p.kind)) people.push({ id: p.id, name, kind: p.kind });
  }

  const storedPoles = Array.isArray(saved.poles) ? saved.poles.filter(isObj) : [];
  const poles: OrgPole[] = DEFAULT_POLES.map((d) => {
    const s = storedPoles.find((p) => p.id === d.id);
    const name = typeof s?.name === "string" ? cleanName(s.name) : "";
    return name ? { ...d, name } : d;
  });
  for (const p of storedPoles) {
    if (typeof p.id !== "string" || !p.id || poles.some((x) => x.id === p.id)) continue;
    const name = typeof p.name === "string" ? cleanName(p.name) : "";
    if (name) poles.push({ id: p.id, name });
  }

  const draft: OrgState = { version: 1, people, poles, assignments: {} };
  const assignments: Record<string, Partial<ArtistAssignment>> = {};
  if (isObj(saved.assignments)) {
    for (const [artistId, over] of Object.entries(saved.assignments)) {
      if (!isObj(over)) continue;
      const kept: Partial<ArtistAssignment> = {};
      for (const f of ASSIGNMENT_FIELDS) {
        if (validField(draft, f, over[f])) (kept as Record<AssignmentField, string>)[f] = over[f] as string;
      }
      if (Object.keys(kept).length > 0) assignments[artistId] = kept;
    }
  }
  const out: OrgState = { ...draft, assignments };
  return isOrgChanged(out) ? out : DEFAULT_ORG;
}

/**
 * La lead du parcours d'achat : créée dès l'étape « identité », complétée à
 * chaque étape — si la personne s'arrête avant de payer, on peut la rappeler.
 */
export const PROFILES = ["artist", "label", "management", "publisher", "distributor", "other"] as const;
export const TEAM_SIZES = ["solo", "2-5", "6-20", "21-50", "50+"] as const;
export const ROLES = ["artist", "manager", "ar", "label-head", "accountant", "lawyer", "other"] as const;
export const NEEDS = ["streams", "revenue", "rights", "audit", "splits", "roster", "contracts"] as const;
/** Étapes que le navigateur peut déclarer. « paid » n'en fait pas partie : seul le paiement confirmé (webhook Stripe) le posera. */
export const CLIENT_STAGES = ["identity", "structure", "needs", "offer", "checkout"] as const;
export const STAGES = [...CLIENT_STAGES, "paid"] as const;

export type Lead = {
  id: string;
  createdAt: string;
  updatedAt: string;
  stage: (typeof STAGES)[number];
  profile?: (typeof PROFILES)[number];
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  teamSize?: (typeof TEAM_SIZES)[number];
  artistCount?: number;
  roles?: (typeof ROLES)[number][];
  needs?: (typeof NEEDS)[number][];
  notes?: string;
  consent?: boolean;
};

const oneOf = <T extends readonly string[]>(list: T, v: unknown): T[number] | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;
const manyOf = <T extends readonly string[]>(list: T, v: unknown): T[number][] | undefined =>
  Array.isArray(v) ? (v.filter((x) => oneOf(list, x)) as T[number][]) : undefined;
const text = (v: unknown, max = 160) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** Ne garde que les champs connus, bornés, du bon type — jamais l'objet brut du client. */
export function sanitize(input: Record<string, unknown>): Partial<Lead> {
  const email = text(input.email, 200)?.toLowerCase();
  const n = Number(input.artistCount);
  const out: Partial<Lead> = {
    stage: oneOf(CLIENT_STAGES, input.stage),
    profile: oneOf(PROFILES, input.profile),
    firstName: text(input.firstName, 80),
    lastName: text(input.lastName, 80),
    email: email && isEmail(email) ? email : undefined,
    phone: text(input.phone, 40),
    company: text(input.company, 120),
    teamSize: oneOf(TEAM_SIZES, input.teamSize),
    artistCount: Number.isFinite(n) && n >= 1 ? Math.min(500, Math.floor(n)) : undefined,
    roles: manyOf(ROLES, input.roles),
    needs: manyOf(NEEDS, input.needs),
    notes: text(input.notes, 1000),
    consent: typeof input.consent === "boolean" ? input.consent : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Partial<Lead>;
}

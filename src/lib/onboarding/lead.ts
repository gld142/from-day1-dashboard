/**
 * La lead du parcours d'achat : créée dès l'étape « identité », complétée à
 * chaque étape — si la personne s'arrête avant de payer, on peut la rappeler.
 */
import { WORKSPACE_KINDS } from "@/lib/accounts/view";

/** Même liste que les types d'espace (`workspaces.kind`) : une seule source, `accounts/view.ts`. */
export const PROFILES = WORKSPACE_KINDS;
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
  /** 14 chiffres, clé de contrôle vérifiée (facultatif : une société étrangère n'en a pas). */
  siret?: string;
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

/**
 * SIRET valide : 14 chiffres dont la clé de contrôle (algorithme de Luhn) est
 * juste — sauf La Poste (SIREN 356000000), dont la somme des chiffres est un
 * multiple de 5. Espaces tolérés.
 */
export function isSiret(v: string): boolean {
  const s = v.replace(/\s/g, "");
  if (!/^\d{14}$/.test(s)) return false;
  if (s.startsWith("356000000")) return [...s].reduce((t, c) => t + Number(c), 0) % 5 === 0;
  let total = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(s[13 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  return total % 10 === 0;
}

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
    siret: typeof input.siret === "string" && isSiret(input.siret) ? input.siret.replace(/\s/g, "") : undefined,
    teamSize: oneOf(TEAM_SIZES, input.teamSize),
    artistCount: Number.isFinite(n) && n >= 1 ? Math.min(500, Math.floor(n)) : undefined,
    roles: manyOf(ROLES, input.roles),
    needs: manyOf(NEEDS, input.needs),
    notes: text(input.notes, 1000),
    consent: typeof input.consent === "boolean" ? input.consent : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Partial<Lead>;
}

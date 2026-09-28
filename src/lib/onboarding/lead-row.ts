import type { Lead } from "./lead";

/** Champ de la lead → colonne de la table Supabase `public.leads` (voir supabase/migrations). */
const COLUMNS = {
  stage: "stage",
  profile: "profile",
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
  phone: "phone",
  company: "company",
  siret: "siret",
  teamSize: "team_size",
  artistCount: "artist_count",
  roles: "roles",
  needs: "needs",
  notes: "notes",
  consent: "consent",
} as const satisfies Partial<Record<keyof Lead, string>>;

/** Les champs absents ne sont pas envoyés : une étape ne peut pas effacer ce qu'une autre a rempli. */
export function toRow(patch: Partial<Lead>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(COLUMNS)) {
    const value = patch[field as keyof typeof COLUMNS];
    if (value !== undefined) row[column] = value;
  }
  return row;
}

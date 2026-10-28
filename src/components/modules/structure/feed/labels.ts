/**
 * Libellés du fil partagés par les composants de /fil : services, DA nommés, personnes,
 * destinataires. Les textes viennent des namespaces `fil` (racine) et `filpage` (page).
 */
import { getDa } from "@/lib/demo/das";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import { getPerson, type FeedNote, type Recipient } from "@/lib/userdata/feed-model";

type T = (key: string, values?: Record<string, string | number>) => string;

export const roleLabel = (tf: T, r: JobRole) => tf(`roles.${r}`);
export const daLabel = (tf: T, daId: string) => `${tf("roles.da")} · ${getDa(daId)?.name ?? daId}`;
export const recipientLabel = (tf: T, r: Recipient) => (r.kind === "role" ? roleLabel(tf, r.role) : daLabel(tf, r.daId));

/** « Camille (Juridique) », « Inès M. (DA) ». */
export function personLabel(tf: T, tp: T, personId: string): string {
  const p = getPerson(personId);
  return p ? tp("person", { name: p.name, role: roleLabel(tf, p.role) }) : personId;
}

/** Les destinataires d'une note : « tous les services », sinon les services puis les DA nommés. */
export function toLabel(tf: T, note: Pick<FeedNote, "to" | "toDas">): string {
  if (note.to.length === JOB_ROLES.length) return tf("note.everyone");
  return [...note.to.map((r) => roleLabel(tf, r)), ...note.toDas.map((d) => daLabel(tf, d))].join(", ");
}

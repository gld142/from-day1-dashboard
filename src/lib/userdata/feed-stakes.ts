/**
 * Ce qu'une note du fil met en jeu, en chiffres, et chez qui elle attend.
 *
 * L'enjeu vient des données de la maison, pas du texte de la note : un lien « contrat » montre
 * l'avance et où en est le recoupement (sinon la valorisation du catalogue) ; un lien « audit »
 * ou « relevés », ce qui reste à réclamer (attendu − déclaré, constats non résolus). Rien
 * d'inventé : sans donnée, pas d'enjeu affiché.
 */
import { CONTRACTS } from "@/lib/demo/data";
import { auditFindings, catalogValuation } from "@/lib/demo/api";
import type { FeedNote } from "./feed-model";

export type Stake =
  | { kind: "advance"; amount: number; pct: number }
  | { kind: "claim"; amount: number }
  | { kind: "valuation"; amount: number };

export function stakeFor(note: Pick<FeedNote, "artistId" | "link">): Stake | null {
  if (!note.artistId || !note.link) return null;
  if (note.link.kind === "audit" || note.link.kind === "statement") {
    const gap = auditFindings(note.artistId)
      .filter((f) => f.status !== "resolved")
      .reduce((s, f) => s + Math.max(0, f.expected - f.reported), 0);
    return gap > 0 ? { kind: "claim", amount: Math.round(gap) } : null;
  }
  if (note.link.kind === "contract") {
    const contract = CONTRACTS.filter((c) => c.artistId === note.artistId).sort((a, b) => b.advance - a.advance)[0];
    if (contract && contract.advance > 0) return { kind: "advance", amount: contract.advance, pct: contract.recoupedPct };
    const mid = catalogValuation(note.artistId).mid;
    return mid > 0 ? { kind: "valuation", amount: mid } : null;
  }
  return null;
}

export type Waiting = { personId: string | null; days: number };

/**
 * Chez qui la note attend, et depuis combien de jours : depuis la prise en charge actuelle, sinon
 * depuis la création (« à attribuer »). Rien pour une note traitée.
 */
export function waitingFor(
  note: Pick<FeedNote, "status" | "assigneeId" | "createdAt" | "history">,
  now: number,
): Waiting | null {
  if (note.status === "done") return null;
  let since = Date.parse(note.createdAt);
  if (note.assigneeId) {
    for (const e of note.history) {
      if (e.type === "assign" && e.personId === note.assigneeId) since = Date.parse(e.at);
    }
  }
  return { personId: note.assigneeId, days: Math.max(0, Math.floor((now - since) / 86_400_000)) };
}

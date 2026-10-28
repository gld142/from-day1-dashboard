/**
 * La conversation d'une note, dans l'ordre où elle s'est passée : la note elle-même, les réponses,
 * les gestes (prise en charge, statut) et les pièces jointes traduites, sur une seule ligne de
 * temps — comme un fil de discussion, pas un commentaire et un historique rangés à part.
 *
 * Et « Vu par » : les services (lecteurs de feed-seen) passés sur la note après le dernier message.
 */
import type { FeedAttachment } from "./feed-attachment";
import type { FeedEvent, FeedNote, FeedReply, Recipient } from "./feed-model";

export type ThreadItem =
  | { kind: "note"; at: string; note: FeedNote }
  | { kind: "reply"; at: string; reply: FeedReply; added: Recipient[] }
  | { kind: "event"; at: string; event: Exclude<FeedEvent, { type: "created" } | { type: "reply" }> }
  | { kind: "attachment"; at: string; attachment: FeedAttachment };

export function threadItems(note: FeedNote, attachments: FeedAttachment[] = []): ThreadItem[] {
  // Qui une réponse a ajouté aux destinataires (mentions) : porté par son événement « reply ».
  const addedByReply = new Map<string, Recipient[]>();
  for (const e of note.history) if (e.type === "reply") addedByReply.set(e.replyId, e.added);

  const items: ThreadItem[] = [{ kind: "note", at: note.createdAt, note }];
  for (const r of note.replies) items.push({ kind: "reply", at: r.at, reply: r, added: addedByReply.get(r.id) ?? [] });
  for (const e of note.history) {
    if (e.type === "created" || e.type === "reply") continue;
    items.push({ kind: "event", at: e.at, event: e });
  }
  for (const a of attachments) items.push({ kind: "attachment", at: a.addedAt, attachment: a });
  // Tri stable par date ; la note reste en tête à égalité.
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.at.localeCompare(b.item.at) || a.i - b.i)
    .map((x) => x.item);
}

/** Date du dernier message de la conversation (note, réponse ou pièce). */
export function lastMessageAt(note: FeedNote, attachments: FeedAttachment[] = []): string {
  let last = note.createdAt;
  for (const r of note.replies) if (r.at > last) last = r.at;
  for (const a of attachments) if (a.addedAt > last) last = a.addedAt;
  return last;
}

/**
 * Les lecteurs (clés feed-seen : « finance », « da:da-urbain »…) passés sur la note après `at`,
 * moi excepté. Le point de départ commun (`__since`) n'est pas un passage.
 */
export function seenBy(state: Record<string, Record<string, string>>, noteId: string, at: string, me: string): string[] {
  return Object.entries(state)
    .filter(([viewer, notes]) => viewer !== me && (notes[noteId] ?? "") >= at && notes[noteId] !== undefined)
    .map(([viewer]) => viewer)
    .sort();
}

/**
 * Fil entre services — le modèle pur (feed-model.ts) : statuts, historique, réponses, mentions
 * → destinataires, prise en charge, périmètre des DA, échéances, ordre du jour du comité, lien
 * vers l'objet, migration de l'ancienne forme (v1, avant le 28/10/2026).
 */
import { describe, expect, it } from "vitest";
import {
  FEED_PEOPLE,
  addReply,
  agendaService,
  assignNote,
  assignableFor,
  canActOn,
  changeStatus,
  committeeAgenda,
  createNote,
  dueState,
  mentionEffects,
  migrateNote,
  normalizeNote,
  notesForRole,
  openPlan,
  parseMentions,
  splitMentions,
  statusOf,
  type Actor,
  type FeedNote,
  type NewNote,
} from "@/lib/userdata/feed-model";

/** Même table que feed-store.test.ts : Leto et Nono → urbain ; Louane → variété ; Gustave → compositeurs. */
const daOf = (id: string) =>
  ({ leto: "da-urbain", "nono-la-grinta": "da-urbain", elgrandetoto: "da-urbain", louane: "da-variete", "gustave-rudman": "da-compos" })[id] ??
  null;

const FINANCE: Actor = { role: "finance", daId: null, name: "Finance" };
const JURIDIQUE: Actor = { role: "juridique", daId: null, name: "Juridique" };
const INES: Actor = { role: "da", daId: "da-urbain", name: "DA · Inès M." };
const T0 = "2026-10-24T09:00:00.000Z";
const T1 = "2026-10-24T10:00:00.000Z";
const T2 = "2026-10-24T11:00:00.000Z";

function note(over: Partial<NewNote> = {}, id = "n1"): FeedNote {
  return createNote(
    { from: "finance", fromName: "Finance · Thomas", to: ["da"], artistId: "leto", urgency: "important", dueDate: null, text: "Avance de Leto.", ...over },
    { id, at: T0, daOf },
  );
}

describe("createNote", () => {
  it("à faire, aucune réponse, un historique « créée » daté et signé, texte borné à 500", () => {
    const n = note({ text: `  ${"x".repeat(600)}  ` });
    expect(statusOf(n)).toBe("todo");
    expect(n.status).toBe("open");
    expect(n.text).toHaveLength(500);
    expect(n.replies).toEqual([]);
    expect(n.assigneeId).toBeNull();
    expect(n.link).toBeNull();
    expect(n.history).toEqual([{ type: "created", at: T0, by: { role: "finance", daId: null, name: "Finance · Thomas" } }]);
  });

  it("les mentions du texte s'ajoutent aux services visés, sans doublon", () => {
    const n = note({ to: ["finance"], text: "@Juridique et @Finance : à voir. @Direction aussi." });
    expect(n.to).toEqual(["finance", "juridique", "direction"]);
  });

  it("le lien vers l'objet est gardé tel quel", () => {
    expect(note({ link: { kind: "contract", href: "/contracts" } }).link).toEqual({ kind: "contract", href: "/contracts" });
  });
});

describe("statuts : à faire → en cours → décidé → traité, et retour", () => {
  it("chaque changement est daté, signé, et garde le champ status open/done de la spec", () => {
    const a = changeStatus(note(), "doing", FINANCE, T1);
    expect(statusOf(a)).toBe("doing");
    expect(a.status).toBe("open");
    const b = changeStatus(a, "decided", JURIDIQUE, T2);
    expect(statusOf(b)).toBe("decided");
    const c = changeStatus(b, "done", FINANCE, "2026-10-25T08:00:00.000Z");
    expect(c.status).toBe("done");
    expect(c.doneAt).toBe("2026-10-25T08:00:00.000Z");
    expect(c.history.slice(1)).toEqual([
      { type: "status", at: T1, by: FINANCE, from: "todo", to: "doing" },
      { type: "status", at: T2, by: JURIDIQUE, from: "doing", to: "decided" },
      { type: "status", at: "2026-10-25T08:00:00.000Z", by: FINANCE, from: "decided", to: "done" },
    ]);
  });

  it("« Traité » reste un clic direct depuis n'importe quel statut", () => {
    const done = changeStatus(note(), "done", FINANCE, T1);
    expect(statusOf(done)).toBe("done");
    expect(done.history.at(-1)).toMatchObject({ from: "todo", to: "done" });
  });

  it("rouvrir une note traitée : status open, doneAt effacé", () => {
    const reopened = changeStatus(changeStatus(note(), "done", FINANCE, T1), "doing", FINANCE, T2);
    expect(reopened.status).toBe("open");
    expect(reopened.doneAt).toBeNull();
    expect(statusOf(reopened)).toBe("doing");
  });

  it("le même statut ne change rien (même référence, aucun événement)", () => {
    const n = note();
    expect(changeStatus(n, "todo", FINANCE, T1)).toBe(n);
  });
});

describe("réponses en fil", () => {
  it("auteur = le métier courant, texte nettoyé et borné, compteur, événement d'historique", () => {
    const r = addReply(note(), `  Vu, je cale un point.  `, { id: "r1", at: T1, by: INES, daOf });
    expect(r.replies).toEqual([{ id: "r1", at: T1, by: INES, text: "Vu, je cale un point." }]);
    expect(r.history.at(-1)).toEqual({ type: "reply", at: T1, by: INES, replyId: "r1", added: [] });
    expect(addReply(r, "x".repeat(700), { id: "r2", at: T2, by: FINANCE, daOf }).replies[1].text).toHaveLength(500);
  });

  it("une réponse vide ne change rien", () => {
    const n = note();
    expect(addReply(n, "   ", { id: "r1", at: T1, by: FINANCE, daOf })).toBe(n);
  });
});

describe("mentions", () => {
  it("reconnaît @Finance, @Juridique, @Direction, @Présidence (avec ou sans accent), @DA, @DA <prénom>, @DA <catégorie>", () => {
    expect(parseMentions("@Finance @juridique @DIRECTION @Présidence @Presidence")).toEqual([
      { kind: "role", role: "finance" },
      { kind: "role", role: "juridique" },
      { kind: "role", role: "direction" },
      { kind: "role", role: "presidence" },
    ]);
    expect(parseMentions("@DA tu regardes ? @DA Inès M. et @DA variété, @DA Sofia")).toEqual([
      { kind: "role", role: "da" },
      { kind: "da", daId: "da-urbain" },
      { kind: "da", daId: "da-variete" },
      { kind: "da", daId: "da-compos" },
    ]);
    // Les libellés anglais des services (interface en anglais).
    expect(parseMentions("@Legal @Management")).toEqual([
      { kind: "role", role: "juridique" },
      { kind: "role", role: "direction" },
    ]);
  });

  it("n'invente pas de mention : adresse email, mot plus long, artiste dont le nom commence par DA", () => {
    expect(parseMentions("ecrire a compta@finance.fr")).toEqual([]);
    expect(parseMentions("@Financement du clip")).toEqual([]);
    expect(parseMentions("@Dakeez sort vendredi")).toEqual([]);
  });

  it("splitMentions découpe le texte pour l'affichage en pastilles, sans rien perdre", () => {
    const parts = splitMentions("Vu avec @Juridique, @DA Inès M. suit.");
    expect(parts).toEqual([
      { type: "text", text: "Vu avec " },
      { type: "mention", text: "@Juridique", mention: { kind: "role", role: "juridique" } },
      { type: "text", text: ", " },
      { type: "mention", text: "@DA Inès M.", mention: { kind: "da", daId: "da-urbain" } },
      { type: "text", text: " suit." },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe("Vu avec @Juridique, @DA Inès M. suit.");
  });

  it("une mention de service dans une réponse l'ajoute aux destinataires : son « à traiter » et sa pastille la comptent", () => {
    const n = note({ to: ["finance"], artistId: "nono-la-grinta" });
    expect(notesForRole([n], "juridique", null, daOf)).toHaveLength(0); // témoin AVANT
    const r = addReply(n, "@Juridique il faut l'avenant.", { id: "r1", at: T1, by: FINANCE, daOf });
    expect(r.to).toEqual(["finance", "juridique"]);
    expect(r.history.at(-1)).toMatchObject({ type: "reply", added: [{ kind: "role", role: "juridique" }] });
    expect(notesForRole([r], "juridique", null, daOf)).toHaveLength(1);
    // Déjà destinataire : rien n'est ajouté.
    expect(addReply(r, "@Finance merci", { id: "r2", at: T2, by: JURIDIQUE, daOf }).history.at(-1)).toMatchObject({ added: [] });
  });

  it("@DA <prénom> sur une note d'artiste : seulement le DA de CET artiste ; un autre DA ne la reçoit pas (pas de fuite)", () => {
    const n = note({ to: ["finance"], artistId: "leto" }); // Leto : DA urbain (Inès)
    expect(mentionEffects(n, "@DA Julien tu peux voir ?", daOf)).toEqual({ added: [], outOfScope: ["da-variete"] });
    const julien = addReply(n, "@DA Julien tu peux voir ?", { id: "r1", at: T1, by: FINANCE, daOf });
    expect(julien.toDas).toEqual([]);
    expect(notesForRole([julien], "da", "da-variete", daOf)).toHaveLength(0);
    expect(notesForRole([julien], "da", "da-urbain", daOf)).toHaveLength(0); // personne n'a écrit à Inès

    const ines = addReply(n, "@DA Inès à toi", { id: "r2", at: T1, by: FINANCE, daOf });
    expect(ines.toDas).toEqual(["da-urbain"]);
    expect(notesForRole([ines], "da", "da-urbain", daOf)).toHaveLength(1);
    expect(notesForRole([ines], "da", "da-variete", daOf)).toHaveLength(0);
    expect(notesForRole([ines], "da", "da-compos", daOf)).toHaveLength(0);
  });

  it("note sans artiste : @DA <prénom> vise ce seul DA, @DA tous les DA", () => {
    const n = note({ to: ["direction"], artistId: null });
    const sofia = addReply(n, "@DA Sofia", { id: "r1", at: T1, by: FINANCE, daOf });
    expect(["da-urbain", "da-variete", "da-compos"].map((d) => notesForRole([sofia], "da", d, daOf).length)).toEqual([0, 0, 1]);
    const all = addReply(n, "@DA", { id: "r2", at: T1, by: FINANCE, daOf });
    expect(all.to).toContain("da");
    expect(["da-urbain", "da-variete", "da-compos"].map((d) => notesForRole([all], "da", d, daOf).length)).toEqual([1, 1, 1]);
  });

  it("une mention à la création suit les mêmes règles que dans une réponse", () => {
    const n = note({ to: ["finance"], artistId: "louane", text: "@DA Inès @DA Julien" }); // Louane : variété
    expect(n.toDas).toEqual(["da-variete"]);
  });
});

describe("prise en charge par une personne", () => {
  it("la liste fictive : Camille (Juridique), Thomas (Finance), Gaël (Direction) et les trois DA", () => {
    expect(FEED_PEOPLE.map((p) => `${p.name}:${p.role}`)).toEqual([
      "Camille:juridique",
      "Thomas:finance",
      "Gaël:direction",
      "Inès M.:da",
      "Julien R.:da",
      "Sofia K.:da",
    ]);
  });

  it("assigner : qui, quand, par qui ; son service rejoint les destinataires ; réassigner la même personne ne change rien", () => {
    const n = note({ to: ["direction"], artistId: "elgrandetoto" });
    const a = assignNote(n, "thomas", { at: T1, by: JURIDIQUE, daOf });
    expect(a.assigneeId).toBe("thomas");
    expect(a.to).toEqual(["direction", "finance"]);
    expect(a.history.at(-1)).toEqual({ type: "assign", at: T1, by: JURIDIQUE, personId: "thomas", added: [{ kind: "role", role: "finance" }] });
    expect(notesForRole([a], "finance", null, daOf)).toHaveLength(1);
    expect(assignNote(a, "thomas", { at: T2, by: JURIDIQUE, daOf })).toBe(a);
    const none = assignNote(a, null, { at: T2, by: JURIDIQUE, daOf });
    expect(none.assigneeId).toBeNull();
    expect(none.history.at(-1)).toMatchObject({ type: "assign", personId: null, added: [] });
  });

  it("un DA hors du périmètre de l'artiste ne peut pas prendre la note ; une personne inconnue non plus", () => {
    const n = note({ artistId: "leto" });
    expect(assignNote(n, "da-variete", { at: T1, by: FINANCE, daOf })).toBe(n);
    expect(assignNote(n, "inconnu", { at: T1, by: FINANCE, daOf })).toBe(n);
    expect(assignableFor(n, daOf).map((p) => p.id)).toEqual(["camille", "thomas", "gael", "da-urbain"]);
    expect(assignableFor(note({ artistId: null }), daOf).map((p) => p.id)).toHaveLength(6);
    const ines = assignNote(note({ to: ["finance"], artistId: "leto" }), "da-urbain", { at: T1, by: FINANCE, daOf });
    expect(ines.toDas).toEqual(["da-urbain"]);
    expect(notesForRole([ines], "da", "da-urbain", daOf)).toHaveLength(1);
  });

  it("un DA n'agit (statut, réponse, prise en charge) que sur les notes de son périmètre ; les autres métiers sur toutes", () => {
    expect(canActOn(note({ artistId: "leto" }), "da", "da-urbain", daOf)).toBe(true);
    expect(canActOn(note({ artistId: "louane" }), "da", "da-urbain", daOf)).toBe(false);
    expect(canActOn(note({ artistId: null }), "da", "da-urbain", daOf)).toBe(true);
    expect(canActOn(note({ artistId: "louane" }), "finance", null, daOf)).toBe(true);
    expect(canActOn(note({ artistId: "louane" }), null, null, daOf)).toBe(true);
  });
});

describe("échéances : par rapport au jour de la démo (AAAA-MM-JJ passé par l'appelant)", () => {
  const due = (dueDate: string | null, status: "open" | "done" = "open") => dueState({ dueDate, status }, "2026-10-24");
  it("en retard la veille ; cette semaine du jour même à J+6 ; rien au-delà, sans échéance, ou traitée", () => {
    expect(due("2026-10-23")).toBe("overdue");
    expect(due("2026-10-24")).toBe("soon");
    expect(due("2026-10-30")).toBe("soon");
    expect(due("2026-10-31")).toBeNull();
    expect(due(null)).toBeNull();
    expect(due("2026-10-01", "done")).toBeNull();
  });
  it("traverse les changements de mois et d'heure (passage à l'heure d'hiver le 25/10)", () => {
    expect(dueState({ dueDate: "2026-11-02", status: "open" }, "2026-10-28")).toBe("soon");
    expect(dueState({ dueDate: "2026-10-31", status: "open" }, "2026-11-01")).toBe("overdue");
  });
});

describe("ordre du jour du comité", () => {
  const base = { artistId: null, dueDate: null } as const;
  const notes = [
    note({ ...base, urgency: "info", to: ["da", "finance", "juridique", "direction", "presidence"] }, "comite"),
    note({ ...base, urgency: "urgent", to: ["finance"], dueDate: "2026-11-08" }, "u-finance"),
    note({ ...base, urgency: "urgent", to: ["juridique"], dueDate: "2026-10-30" }, "u-juridique"),
    note({ ...base, urgency: "urgent", to: ["finance"], dueDate: "2026-10-26" }, "u-finance-tot"),
    changeStatus(note({ ...base, urgency: "urgent", to: ["finance"] }, "u-traitee"), "done", FINANCE, T1),
    assignNote(note({ ...base, urgency: "important", to: ["direction"] }, "i-thomas"), "thomas", { at: T1, by: FINANCE, daOf }),
    note({ ...base, urgency: "important", to: ["juridique", "finance"] }, "i-deux"),
  ];

  it("service en charge : la personne qui a pris la note, sinon le service visé s'il est seul, sinon « plusieurs »", () => {
    const byId = Object.fromEntries(notes.map((n) => [n.id, agendaService(n)]));
    expect(byId).toMatchObject({ "u-finance": "finance", "i-thomas": "finance", "i-deux": "several", comite: "several" });
  });

  it("non traitées seulement, regroupées par urgence puis par service, échéance la plus proche d'abord", () => {
    const agenda = committeeAgenda(notes);
    expect(agenda.map((g) => g.urgency)).toEqual(["urgent", "important", "info"]);
    expect(agenda[0].services.map((s) => [s.service, s.notes.map((n) => n.id)])).toEqual([
      ["finance", ["u-finance-tot", "u-finance"]],
      ["juridique", ["u-juridique"]],
    ]);
    expect(agenda[1].services.map((s) => [s.service, s.notes.map((n) => n.id)])).toEqual([
      ["finance", ["i-thomas"]],
      ["several", ["i-deux"]],
    ]);
    expect(agenda.flatMap((g) => g.services.flatMap((s) => s.notes.map((n) => n.id)))).not.toContain("u-traitee");
  });

  it("tout traité : ordre du jour vide", () => {
    expect(committeeAgenda([changeStatus(note(), "done", FINANCE, T1)])).toEqual([]);
  });
});

describe("lien vers l'objet : « Ouvrir »", () => {
  it("note d'artiste dans mon périmètre : la page, zoomée sur l'artiste si elle sait le faire", () => {
    expect(openPlan(note({ link: { kind: "contract", href: "/contracts" } }), true)).toEqual({ href: "/contracts", focus: { artistId: "leto" } });
  });
  it("note d'artiste hors de mon périmètre : pas de bouton (on ne zoome pas un DA sur l'artiste d'un autre)", () => {
    expect(openPlan(note({ link: { kind: "contract", href: "/contracts" } }), false)).toBeNull();
  });
  it("note sans artiste : la page sur tout le roster (le zoom en cours est retiré)", () => {
    expect(openPlan(note({ artistId: null, link: { kind: "page", href: "/splits" } }), true)).toEqual({ href: "/splits", focus: { artistId: null } });
  });
  it("sans lien, ou fiche artiste sans artiste : rien", () => {
    expect(openPlan(note(), true)).toBeNull();
    expect(openPlan(note({ artistId: null, link: { kind: "artist", href: "/pulse" } }), true)).toBeNull();
  });
});

describe("migration de l'ancienne forme (v1 : status open/done et « Traité » seul)", () => {
  const v1 = {
    id: "note-abc",
    createdAt: "2026-10-27T15:12:00.000Z",
    from: "finance",
    fromName: "Finance",
    to: ["juridique", "direction"],
    artistId: "louane",
    urgency: "urgent",
    dueDate: "2026-11-02",
    text: "Note écrite avant la mise à jour.",
    status: "open",
    doneAt: null,
  };

  it("note ouverte : chaque champ v1 identique ; à faire, sans réponse ni prise en charge ; historique « créée »", () => {
    const n = migrateNote(v1)!;
    for (const [k, v] of Object.entries(v1)) expect(n[k as keyof FeedNote], k).toEqual(v);
    expect(statusOf(n)).toBe("todo");
    expect([n.toDas, n.replies, n.assigneeId, n.link]).toEqual([[], [], null, null]);
    expect(n.history).toEqual([{ type: "created", at: v1.createdAt, by: { role: "finance", daId: null, name: "Finance" } }]);
  });

  it("note traitée : reste traitée à sa date, l'historique le dit (auteur inconnu en v1)", () => {
    const n = migrateNote({ ...v1, status: "done", doneAt: "2026-10-28T08:00:00.000Z" })!;
    expect(statusOf(n)).toBe("done");
    expect(n.doneAt).toBe("2026-10-28T08:00:00.000Z");
    expect(n.history.at(-1)).toEqual({ type: "status", at: "2026-10-28T08:00:00.000Z", by: null, from: "todo", to: "done" });
  });

  it("ce qui n'est pas une note est écarté, jamais une erreur", () => {
    for (const bad of [null, 3, "x", [], {}, { ...v1, id: 1 }, { ...v1, status: "archived" }, { ...v1, to: "finance" }]) {
      expect(migrateNote(bad)).toBeNull();
    }
  });

  it("relecture d'une note v2 : identique ; champs v2 absents ou abîmés remis à zéro sans perdre la note", () => {
    const n = addReply(note(), "@Juridique vu", { id: "r1", at: T1, by: FINANCE, daOf });
    expect(normalizeNote(JSON.parse(JSON.stringify(n)))).toEqual(n);
    const damaged = { ...JSON.parse(JSON.stringify(n)), replies: "?", history: null, stage: "bizarre", toDas: [3] };
    const fixed = normalizeNote(damaged)!;
    expect(fixed.text).toBe(n.text);
    expect([fixed.replies, fixed.stage, fixed.toDas]).toEqual([[], "todo", []]);
    expect(fixed.history[0]).toMatchObject({ type: "created", at: n.createdAt });
  });
});

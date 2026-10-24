/**
 * Fil entre services : store local (localStorage simulé), tri, filtres par rôle
 * et DA, exemples posés une fois, « traité », compteurs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

type Store = typeof import("@/lib/userdata/feed-store");
const TODAY = new Date("2026-10-24T09:00:00Z");
/** DA de démo : Leto et Nono → urbain ; Louane → variété ; Gustave Rudman → compositeurs ; ElGrandeToto → urbain. */
const daOf = (id: string) =>
  ({ leto: "da-urbain", "nono-la-grinta": "da-urbain", elgrandetoto: "da-urbain", louane: "da-variete", "gustave-rudman": "da-compos" })[id] ?? null;

describe("feed-store", () => {
  let store: Store;
  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    vi.resetModules();
    store = await import("@/lib/userdata/feed-store");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fil vide au premier chargement : six exemples, datés par rapport à aujourd'hui", () => {
    store.hydrateFeed(TODAY);
    const notes = store.getNotes();
    expect(notes).toHaveLength(6);
    expect(notes.every((n) => n.status === "open")).toBe(true);
    expect(notes.find((n) => n.artistId === "nono-la-grinta")?.dueDate).toBe("2026-11-08"); // +15 jours
    expect(notes.find((n) => n.artistId === "louane")?.dueDate).toBe("2026-10-30"); // le 30 à venir
    expect(notes.find((n) => n.from === "direction")?.to).toEqual(["da", "finance", "juridique", "direction", "presidence"]);
    expect(JSON.parse(window.localStorage.getItem("day1-feed")!).notes).toHaveLength(6);
  });

  it("les exemples ne sont posés qu'une fois, même si tout est traité", () => {
    store.hydrateFeed(TODAY);
    for (const n of store.getNotes()) store.markDone(n.id, TODAY);
    vi.resetModules();
    return import("@/lib/userdata/feed-store").then((again) => {
      again.hydrateFeed(TODAY);
      expect(again.getNotes()).toHaveLength(6);
      expect(again.getNotes().every((n) => n.status === "done")).toBe(true);
    });
  });

  it("addNote : identifiant, date, texte borné à 500 caractères, persisté", () => {
    store.hydrateFeed(TODAY);
    const n = store.addNote(
      { from: "finance", fromName: "Finance · Thomas", to: ["direction"], artistId: null, urgency: "info", dueDate: null, text: "x".repeat(600) },
      TODAY,
    );
    expect(n.text).toHaveLength(500);
    expect(n.status).toBe("open");
    expect(n.createdAt).toBe(TODAY.toISOString());
    expect(store.getNotes()).toHaveLength(7);
    expect(store.feedSnapshot()).toContain(n.id);
  });

  it("markDone : statut et date ; une note inconnue ne change rien", () => {
    store.hydrateFeed(TODAY);
    const id = store.getNotes()[0].id;
    const before = store.feedSnapshot();
    store.markDone("nulle-part", TODAY);
    expect(store.feedSnapshot()).toBe(before);
    store.markDone(id, TODAY);
    const n = store.getNotes().find((x) => x.id === id)!;
    expect(n.status).toBe("done");
    expect(n.doneAt).toBe(TODAY.toISOString());
  });

  it("sortNotes : urgence, puis échéance (sans échéance en dernier), puis plus récente d'abord", () => {
    store.hydrateFeed(TODAY);
    const sorted = store.sortNotes(store.getNotes());
    expect(sorted.map((n) => n.urgency)).toEqual(["urgent", "urgent", "important", "important", "info", "info"]);
    expect(sorted[0].dueDate! <= sorted[1].dueDate!).toBe(true);
    expect(sorted.at(-1)!.dueDate).toBeNull();
  });

  it("notesForRole : ce qui est adressé à mon service ; le DA ne voit que ses artistes (et les notes sans artiste)", () => {
    store.hydrateFeed(TODAY);
    const all = store.getNotes();
    const texts = (list: typeof all) => list.map((n) => n.artistId ?? "—").sort();
    expect(texts(store.notesForRole(all, "finance", null, daOf))).toEqual(["nono-la-grinta", "—"]);
    expect(texts(store.notesForRole(all, "da", "da-urbain", daOf))).toEqual(["leto", "—"]);
    expect(texts(store.notesForRole(all, "da", "da-compos", daOf))).toEqual(["gustave-rudman", "—"]);
    expect(texts(store.notesForRole(all, "da", "da-variete", daOf))).toEqual(["—"]);
    expect(texts(store.notesForRole(all, "juridique", null, daOf))).toEqual(["louane", "—"]);
    expect(texts(store.notesForRole(all, "direction", null, daOf))).toEqual(["elgrandetoto", "—"]);
    expect(texts(store.notesForRole(all, "presidence", null, daOf))).toEqual(["—"]);
    // Sans rôle (maison day1) : tout ce qui est ouvert.
    expect(store.notesForRole(all, null, null, daOf)).toHaveLength(6);
    // Une note traitée sort du « à traiter ».
    store.markDone(all.find((n) => n.artistId === "louane")!.id, TODAY);
    expect(store.notesForRole(store.getNotes(), "juridique", null, daOf)).toHaveLength(1);
  });

  it("openCountByArtist : notes ouvertes par artiste", () => {
    store.hydrateFeed(TODAY);
    expect(store.openCountByArtist(store.getNotes())).toEqual({ "nono-la-grinta": 1, leto: 1, louane: 1, "gustave-rudman": 1, elgrandetoto: 1 });
  });

  it("côté serveur (pas de window) : hydrateFeed est un no-op, le snapshot vaut []", async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    const ssr = await import("@/lib/userdata/feed-store");
    ssr.hydrateFeed(TODAY);
    expect(ssr.getNotes()).toEqual([]);
    expect(ssr.feedSnapshot()).toBe("[]");
  });
});

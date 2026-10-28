/**
 * Store de l'organisation (localStorage simulé) : persistance, réinitialisation, stockage
 * corrompu, reconnaissance d'un DA ajouté (role.tsx), et rôle DA qui suit la réattribution.
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

type Store = typeof import("@/lib/userdata/org-store");
type Model = typeof import("@/lib/demo/org");
const LOUANE = { id: "louane", category: "variete", daId: "da-variete" } as const;

describe("org-store", () => {
  let store: Store;
  let model: Model;
  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    vi.resetModules();
    store = await import("@/lib/userdata/org-store");
    model = await import("@/lib/demo/org");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("stockage vide : organisation par défaut, rien d'écrit", () => {
    store.hydrateOrg();
    expect(store.getOrg()).toBe(model.DEFAULT_ORG);
    expect(window.localStorage.getItem("day1-org")).toBeNull();
  });

  it("persistance : une réattribution et un DA ajouté survivent à un rechargement", async () => {
    store.hydrateOrg();
    const id = store.addOrgPerson("da", "Nadia P.");
    store.assignOrgArtist(LOUANE, "daId", id!);
    store.renameOrgPerson("da-urbain", "Inès Martin");
    expect(JSON.parse(window.localStorage.getItem("day1-org")!).assignments).toEqual({ louane: { daId: id } });

    vi.resetModules();
    const again = await import("@/lib/userdata/org-store");
    const m = await import("@/lib/demo/org");
    again.hydrateOrg();
    expect(m.resolveAssignment(LOUANE, again.getOrg()).daId).toBe(id);
    expect(m.personName(again.getOrg(), "da-urbain")).toBe("Inès Martin");
  });

  it("notifie les abonnés à chaque écriture, pas pour une écriture sans effet", () => {
    store.hydrateOrg();
    const spy = vi.fn();
    const off = store.subscribeOrg(spy);
    store.assignOrgArtist(LOUANE, "daId", "da-urbain");
    expect(spy).toHaveBeenCalledTimes(1);
    store.assignOrgArtist(LOUANE, "daId", "da-urbain"); // même valeur
    store.renameOrgPerson("da-urbain", "   "); // nom vide
    expect(spy).toHaveBeenCalledTimes(1);
    off();
  });

  it("référence stable entre deux écritures (useSyncExternalStore)", () => {
    store.hydrateOrg();
    store.assignOrgArtist(LOUANE, "daId", "da-urbain");
    expect(store.getOrg()).toBe(store.getOrg());
  });

  it("réinitialiser : retour au défaut (même référence), clé retirée du stockage", () => {
    store.hydrateOrg();
    store.addOrgPole("Pôle Nouveaux talents");
    store.assignOrgArtist(LOUANE, "daId", "da-urbain");
    store.resetOrg();
    expect(store.getOrg()).toBe(model.DEFAULT_ORG);
    expect(window.localStorage.getItem("day1-org")).toBeNull();
  });

  it("stockage corrompu : défaut, sans erreur, et la première écriture le remplace proprement", () => {
    window.localStorage.setItem("day1-org", "{pas du json");
    expect(() => store.hydrateOrg()).not.toThrow();
    expect(store.getOrg()).toBe(model.DEFAULT_ORG);
    store.assignOrgArtist(LOUANE, "daId", "da-urbain");
    expect(model.parseOrgState(window.localStorage.getItem("day1-org")).assignments).toEqual({ louane: { daId: "da-urbain" } });
  });

  it("stockage indisponible (getItem lève) : défaut, sans erreur", async () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("bloqué"); }, setItem: () => { throw new Error("bloqué"); }, removeItem: () => {} } });
    vi.resetModules();
    const s = await import("@/lib/userdata/org-store");
    const m = await import("@/lib/demo/org");
    expect(() => s.hydrateOrg()).not.toThrow();
    expect(s.getOrg()).toBe(m.DEFAULT_ORG);
    expect(() => s.assignOrgArtist(LOUANE, "daId", "da-urbain")).not.toThrow();
    expect(m.resolveAssignment(LOUANE, s.getOrg()).daId).toBe("da-urbain"); // en mémoire pour la session
  });

  it("isOrgDa : un DA ajouté est reconnu, même avant l'hydratation (lecture sans effet)", async () => {
    store.hydrateOrg();
    const id = store.addOrgPerson("da", "Nadia P.")!;
    vi.resetModules();
    const fresh = await import("@/lib/userdata/org-store");
    expect(fresh.isOrgDa(id)).toBe(true); // non hydraté : lit le stockage
    expect(fresh.getOrg()).toBe((await import("@/lib/demo/org")).DEFAULT_ORG); // … sans toucher au cache
    expect(fresh.isOrgDa("da-urbain")).toBe(true);
    expect(fresh.isOrgDa("da-inconnu")).toBe(false);
    expect(fresh.isOrgDa(null)).toBe(false);
  });

  it("rôle DA : withDa accepte un DA ajouté, refuse toujours un DA inconnu", async () => {
    store.hydrateOrg();
    const id = store.addOrgPerson("da", "Nadia P.")!;
    const { withDa, parseRoleState } = await import("@/lib/role");
    expect(withDa("da", id)).toEqual({ jobRole: "da", daId: id });
    expect(withDa("da", "da-inconnu")).toEqual({ jobRole: null, daId: null });
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "da", daId: id })).daId).toBe(id);
  });
});

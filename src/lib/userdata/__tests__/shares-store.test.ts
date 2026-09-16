/**
 * Store local des parts de l'artiste (pourcentages du contrat).
 * Environnement node : on simule `window.localStorage` avec un shim mémoire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** localStorage minimal en mémoire — l'API utilisée par le store, rien de plus. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, String(v));
    },
  };
}

type Store = typeof import("@/lib/userdata/shares-store");

async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("@/lib/userdata/shares-store");
}

describe("shares-store (navigateur)", () => {
  let store: Store;

  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    store = await freshStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aucune part au départ", () => {
    expect(store.getShares("dadju")).toBeNull();
    expect(store.sharesSnapshot()).toBe("{}");
  });

  it("aller-retour save → get, avec version et updatedAt", () => {
    const saved = store.saveShares({
      artistId: "dadju",
      masterSharePct: 18,
      isAuthor: true,
      authorSharePct: 50,
      contractFileName: null,
    });
    expect(saved.version).toBe(1);
    expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.getShares("dadju")).toEqual(saved);
    // Persisté dans localStorage, clé unique, map artistId → parts.
    const raw = JSON.parse(window.localStorage.getItem("day1-shares") ?? "{}");
    expect(raw.dadju.masterSharePct).toBe(18);
  });

  it("borne les pourcentages à [0, 100] et transforme NaN en null", () => {
    const saved = store.saveShares({
      artistId: "dadju",
      masterSharePct: 140,
      isAuthor: true,
      authorSharePct: -5,
      contractFileName: "contrat.pdf",
    });
    expect(saved.masterSharePct).toBe(100);
    expect(saved.authorSharePct).toBe(0);
    const nan = store.saveShares({
      artistId: "kiko",
      masterSharePct: Number.NaN,
      isAuthor: false,
      authorSharePct: Number.NaN,
      contractFileName: null,
    });
    expect(nan.masterSharePct).toBeNull();
    expect(nan.authorSharePct).toBeNull();
  });

  it("les parts sont propres à chaque artiste", () => {
    store.saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: false, authorSharePct: null, contractFileName: null });
    store.saveShares({ artistId: "kiko", masterSharePct: 90, isAuthor: true, authorSharePct: 100, contractFileName: null });
    expect(store.getShares("dadju")?.masterSharePct).toBe(18);
    expect(store.getShares("kiko")?.masterSharePct).toBe(90);
  });

  it("clear supprime les parts d'un seul artiste", () => {
    store.saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: false, authorSharePct: null, contractFileName: null });
    store.saveShares({ artistId: "kiko", masterSharePct: 90, isAuthor: false, authorSharePct: null, contractFileName: null });
    store.clearShares("dadju");
    expect(store.getShares("dadju")).toBeNull();
    expect(store.getShares("kiko")).not.toBeNull();
  });

  it("subscribe : notifié à chaque save et clear, plus après désabonnement", () => {
    const fn = vi.fn();
    const unsub = store.subscribeShares(fn);
    store.saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: false, authorSharePct: null, contractFileName: null });
    store.clearShares("dadju");
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    store.saveShares({ artistId: "dadju", masterSharePct: 20, isAuthor: false, authorSharePct: null, contractFileName: null });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("sharesSnapshot change quand les parts changent (clé de memo)", () => {
    const before = store.sharesSnapshot();
    store.saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: false, authorSharePct: null, contractFileName: null });
    const after = store.sharesSnapshot();
    expect(after).not.toBe(before);
    // Stable tant que rien ne change (même référence → pas de re-rendu inutile).
    expect(store.sharesSnapshot()).toBe(after);
  });

  it("avant hydrateShares, un module frais ne lit pas localStorage (rendu d'hydratation = serveur)", async () => {
    store.saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: true, authorSharePct: 50, contractFileName: null });
    const reloaded = await freshStore();
    expect(reloaded.getShares("dadju")).toBeNull();
    expect(reloaded.sharesSnapshot()).toBe("{}");
  });

  it("hydrateShares relit localStorage une fois et notifie (persistance entre rechargements)", async () => {
    store.saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: true, authorSharePct: 50, contractFileName: null });
    const reloaded = await freshStore();
    const fn = vi.fn();
    reloaded.subscribeShares(fn);
    reloaded.hydrateShares();
    expect(reloaded.getShares("dadju")?.masterSharePct).toBe(18);
    expect(fn).toHaveBeenCalledTimes(1);
    reloaded.hydrateShares();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("hydrateShares sur un stockage vide ne notifie pas", async () => {
    const reloaded = await freshStore();
    const fn = vi.fn();
    reloaded.subscribeShares(fn);
    reloaded.hydrateShares();
    expect(fn).not.toHaveBeenCalled();
  });

  it("saveShares hydrate d'abord : n'écrase pas les parts d'un autre artiste", async () => {
    store.saveShares({ artistId: "kiko", masterSharePct: 90, isAuthor: false, authorSharePct: null, contractFileName: null });
    const reloaded = await freshStore();
    reloaded.saveShares({ artistId: "dadju", masterSharePct: 18, isAuthor: false, authorSharePct: null, contractFileName: null });
    expect(reloaded.getShares("kiko")?.masterSharePct).toBe(90);
  });

  it("un localStorage corrompu est ignoré sans lever", async () => {
    window.localStorage.setItem("day1-shares", "{not json");
    const reloaded = await freshStore();
    expect(() => reloaded.hydrateShares()).not.toThrow();
    expect(reloaded.getShares("dadju")).toBeNull();
  });
});

describe("shares-store (serveur, sans window)", () => {
  it("getShares renvoie null et sharesSnapshot une chaîne, sans lever", async () => {
    vi.unstubAllGlobals();
    const store = await freshStore();
    expect(typeof window).toBe("undefined");
    expect(() => store.hydrateShares()).not.toThrow();
    expect(store.getShares("dadju")).toBeNull();
    expect(store.sharesSnapshot()).toBe("{}");
  });
});

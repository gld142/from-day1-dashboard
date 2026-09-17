/**
 * Store local des relevés de répartition importés (nom de fichier + date, par périmètre).
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

type Store = typeof import("@/lib/userdata/rights-store");

async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("@/lib/userdata/rights-store");
}

const FILE = "releve-repartition-sacem-2026-T1.pdf";

describe("rights-store (navigateur)", () => {
  let store: Store;

  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    store = await freshStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aucun import au départ", () => {
    expect(store.getRightsImport("dadju")).toBeNull();
    expect(store.rightsImportsSnapshot()).toBe("{}");
  });

  it("aller-retour save → get, avec version, date ISO et nom de fichier", () => {
    const saved = store.saveRightsImport({ scopeId: "dadju", fileName: FILE });
    expect(saved.version).toBe(1);
    expect(saved.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved.fileName).toBe(FILE);
    expect(store.getRightsImport("dadju")).toEqual(saved);
    // Persisté dans localStorage, clé unique, map scopeId → import.
    const raw = JSON.parse(window.localStorage.getItem("day1-rights-imports") ?? "{}");
    expect(raw.dadju.fileName).toBe(FILE);
  });

  it("les imports sont propres à chaque périmètre (artiste, roster) ; clear n'en retire qu'un", () => {
    store.saveRightsImport({ scopeId: "dadju", fileName: FILE });
    store.saveRightsImport({ scopeId: store.ROSTER_SCOPE, fileName: "roster.csv" });
    store.clearRightsImport("dadju");
    expect(store.getRightsImport("dadju")).toBeNull();
    expect(store.getRightsImport(store.ROSTER_SCOPE)?.fileName).toBe("roster.csv");
  });

  it("subscribe : notifié à chaque save et clear, plus après désabonnement", () => {
    const fn = vi.fn();
    const unsub = store.subscribeRightsImports(fn);
    store.saveRightsImport({ scopeId: "a", fileName: FILE });
    store.clearRightsImport("a");
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    store.saveRightsImport({ scopeId: "a", fileName: FILE });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rightsImportsSnapshot change quand un import arrive, stable sinon (clé de memo)", () => {
    const before = store.rightsImportsSnapshot();
    store.saveRightsImport({ scopeId: "a", fileName: FILE });
    const after = store.rightsImportsSnapshot();
    expect(after).not.toBe(before);
    expect(store.rightsImportsSnapshot()).toBe(after);
  });

  it("avant hydrateRightsImports, un module frais ne lit pas localStorage (rendu d'hydratation = serveur)", async () => {
    store.saveRightsImport({ scopeId: "a", fileName: FILE });
    const reloaded = await freshStore();
    expect(reloaded.getRightsImport("a")).toBeNull();
    expect(reloaded.rightsImportsSnapshot()).toBe("{}");
  });

  it("hydrateRightsImports relit localStorage une fois et notifie (persistance entre rechargements)", async () => {
    store.saveRightsImport({ scopeId: "a", fileName: FILE });
    const reloaded = await freshStore();
    const fn = vi.fn();
    reloaded.subscribeRightsImports(fn);
    reloaded.hydrateRightsImports();
    expect(reloaded.getRightsImport("a")?.fileName).toBe(FILE);
    expect(fn).toHaveBeenCalledTimes(1);
    reloaded.hydrateRightsImports();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("saveRightsImport hydrate d'abord : n'écrase pas l'import d'un autre périmètre", async () => {
    store.saveRightsImport({ scopeId: "a", fileName: FILE });
    const reloaded = await freshStore();
    reloaded.saveRightsImport({ scopeId: "b", fileName: "b.csv" });
    expect(reloaded.getRightsImport("a")?.fileName).toBe(FILE);
  });

  it("un localStorage corrompu ou mal formé est ignoré sans lever", async () => {
    window.localStorage.setItem("day1-rights-imports", "{not json");
    let reloaded = await freshStore();
    expect(() => reloaded.hydrateRightsImports()).not.toThrow();
    expect(reloaded.getRightsImport("a")).toBeNull();
    // Entrée sans nom de fichier : écartée, les autres conservées.
    window.localStorage.setItem(
      "day1-rights-imports",
      JSON.stringify({
        a: { scopeId: "a", importedAt: "2026-09-17T00:00:00Z" },
        b: { scopeId: "b", importedAt: "2026-09-17T00:00:00Z", fileName: FILE },
      }),
    );
    reloaded = await freshStore();
    reloaded.hydrateRightsImports();
    expect(reloaded.getRightsImport("a")).toBeNull();
    expect(reloaded.getRightsImport("b")?.fileName).toBe(FILE);
  });
});

describe("rights-store (serveur, sans window)", () => {
  it("getRightsImport renvoie null et rightsImportsSnapshot une chaîne, sans lever", async () => {
    vi.unstubAllGlobals();
    const store = await freshStore();
    expect(typeof window).toBe("undefined");
    expect(() => store.hydrateRightsImports()).not.toThrow();
    expect(store.getRightsImport("a")).toBeNull();
    expect(store.rightsImportsSnapshot()).toBe("{}");
  });
});

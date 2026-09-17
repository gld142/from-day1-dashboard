/**
 * Store local des modules (pages affichées dans la navigation).
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

type Store = typeof import("@/lib/userdata/modules-store");

async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("@/lib/userdata/modules-store");
}

describe("modules-store (navigateur)", () => {
  let store: Store;

  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    store = await freshStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aucun choix au départ : les défauts du persona s'appliquent", () => {
    expect(store.getModuleOverrides()).toEqual({});
    expect(store.modulesSnapshot()).toBe("{}");
    // La valorisation est réservée à la structure : masquée par défaut pour l'artiste.
    expect(store.getModuleVisibility("/valuation", "artist")).toBe(false);
    expect(store.getModuleVisibility("/valuation", "label")).toBe(true);
    // Pages internes : masquées pour tous.
    expect(store.getModuleVisibility("/comparatif", "label")).toBe(false);
    expect(store.getModuleVisibility("/onboardings", "label")).toBe(false);
    // Page ordinaire : visible.
    expect(store.getModuleVisibility("/streams", "label")).toBe(true);
    // Href inconnu de la navigation : rien ne le masque.
    expect(store.getModuleVisibility("/nulle-part", "label")).toBe(true);
  });

  it("aller-retour set → get, persisté sous la clé versionnée", () => {
    store.setModuleVisibility("/valuation", true);
    expect(store.getModuleOverride("/valuation")).toBe(true);
    expect(store.getModuleVisibility("/valuation", "label")).toBe(true);
    const raw = JSON.parse(window.localStorage.getItem("day1-modules") ?? "{}");
    expect(raw).toEqual({ version: 1, overrides: { "/valuation": true } });
  });

  it("un choix explicite prime sur le défaut, dans les deux sens", () => {
    store.setModuleVisibility("/streams", false);
    expect(store.getModuleVisibility("/streams", "artist")).toBe(false);
    store.setModuleVisibility("/onboardings", true);
    expect(store.getModuleVisibility("/onboardings", "label")).toBe(true);
  });

  it("reset oublie tous les choix : retour aux défauts", () => {
    store.setModuleVisibility("/valuation", true);
    store.setModuleVisibility("/streams", false);
    store.resetModules();
    expect(store.getModuleOverrides()).toEqual({});
    expect(store.getModuleVisibility("/valuation", "artist")).toBe(false);
    expect(store.getModuleVisibility("/streams", "artist")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("day1-modules") ?? "{}")).toEqual({
      version: 1,
      overrides: {},
    });
  });

  it("subscribe : notifié à chaque set et reset, pas pour une écriture identique, plus après désabonnement", () => {
    const fn = vi.fn();
    const unsub = store.subscribeModules(fn);
    store.setModuleVisibility("/valuation", true);
    store.setModuleVisibility("/valuation", true); // identique : pas de notification
    store.resetModules();
    store.resetModules(); // déjà vide : pas de notification
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    store.setModuleVisibility("/valuation", false);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("modulesSnapshot change quand les choix changent (clé de memo), stable sinon", () => {
    const before = store.modulesSnapshot();
    store.setModuleVisibility("/valuation", true);
    const after = store.modulesSnapshot();
    expect(after).not.toBe(before);
    expect(store.modulesSnapshot()).toBe(after);
  });

  it("avant hydrateModules, un module frais ne lit pas localStorage (rendu d'hydratation = serveur)", async () => {
    store.setModuleVisibility("/valuation", true);
    const reloaded = await freshStore();
    expect(reloaded.getModuleOverrides()).toEqual({});
    expect(reloaded.getModuleVisibility("/valuation", "artist")).toBe(false);
  });

  it("hydrateModules relit localStorage une fois et notifie (persistance entre rechargements)", async () => {
    store.setModuleVisibility("/valuation", true);
    const reloaded = await freshStore();
    const fn = vi.fn();
    reloaded.subscribeModules(fn);
    reloaded.hydrateModules();
    expect(reloaded.getModuleVisibility("/valuation", "label")).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    reloaded.hydrateModules();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("hydrateModules sur un stockage vide ne notifie pas", async () => {
    const reloaded = await freshStore();
    const fn = vi.fn();
    reloaded.subscribeModules(fn);
    reloaded.hydrateModules();
    expect(fn).not.toHaveBeenCalled();
  });

  it("setModuleVisibility hydrate d'abord : n'écrase pas un choix encore non relu", async () => {
    store.setModuleVisibility("/streams", false);
    const reloaded = await freshStore();
    reloaded.setModuleVisibility("/valuation", true);
    expect(reloaded.getModuleOverrides()).toEqual({ "/streams": false, "/valuation": true });
  });

  it("reprend une fois les masquages de l'ancien PrefsProvider (day1-prefs.hiddenModules)", async () => {
    window.localStorage.setItem(
      "day1-prefs",
      JSON.stringify({ hiddenModules: ["/sync", "/tour"], briefOpenedOn: "2026-09-16" }),
    );
    const reloaded = await freshStore();
    reloaded.hydrateModules();
    expect(reloaded.getModuleOverrides()).toEqual({ "/sync": false, "/tour": false });
    // Dès qu'une clé versionnée existe, l'ancienne n'est plus consultée.
    reloaded.resetModules();
    const again = await freshStore();
    again.hydrateModules();
    expect(again.getModuleOverrides()).toEqual({});
  });

  it("un localStorage corrompu ou d'une forme inattendue est ignoré sans lever", async () => {
    window.localStorage.setItem("day1-modules", "{not json");
    const reloaded = await freshStore();
    expect(() => reloaded.hydrateModules()).not.toThrow();
    expect(reloaded.getModuleOverrides()).toEqual({});

    window.localStorage.setItem(
      "day1-modules",
      JSON.stringify({ version: 1, overrides: { "/valuation": "oui" } }),
    );
    const bad = await freshStore();
    bad.hydrateModules();
    expect(bad.getModuleOverrides()).toEqual({});
  });
});

describe("modules-store (serveur, sans window)", () => {
  it("lecture synchrone sans lever : aucun choix, défauts du persona", async () => {
    vi.unstubAllGlobals();
    const store = await freshStore();
    expect(typeof window).toBe("undefined");
    expect(() => store.hydrateModules()).not.toThrow();
    expect(store.getModuleOverrides()).toEqual({});
    expect(store.modulesSnapshot()).toBe("{}");
    expect(store.getModuleVisibility("/valuation", "artist")).toBe(false);
  });
});

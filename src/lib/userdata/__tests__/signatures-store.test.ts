/**
 * Store local des signatures de splits (PNG + date, par titre).
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

type Store = typeof import("@/lib/userdata/signatures-store");

async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("@/lib/userdata/signatures-store");
}

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("signatures-store (navigateur)", () => {
  let store: Store;

  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    store = await freshStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aucune signature au départ", () => {
    expect(store.getSignature("da-cullinan-t1")).toBeNull();
    expect(store.signaturesSnapshot()).toBe("{}");
  });

  it("aller-retour save → get, avec version, date ISO et data URL", () => {
    const saved = store.saveSignature({ trackId: "da-cullinan-t1", dataUrl: PNG });
    expect(saved.version).toBe(1);
    expect(saved.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved.dataUrl).toBe(PNG);
    expect(store.getSignature("da-cullinan-t1")).toEqual(saved);
    // Persisté dans localStorage, clé unique, map trackId → signature.
    const raw = JSON.parse(window.localStorage.getItem("day1-signatures") ?? "{}");
    expect(raw["da-cullinan-t1"].dataUrl).toBe(PNG);
  });

  it("les signatures sont propres à chaque titre ; clear n'en retire qu'une", () => {
    store.saveSignature({ trackId: "a", dataUrl: PNG });
    store.saveSignature({ trackId: "b", dataUrl: PNG });
    store.clearSignature("a");
    expect(store.getSignature("a")).toBeNull();
    expect(store.getSignature("b")).not.toBeNull();
  });

  it("subscribe : notifié à chaque save et clear, plus après désabonnement", () => {
    const fn = vi.fn();
    const unsub = store.subscribeSignatures(fn);
    store.saveSignature({ trackId: "a", dataUrl: PNG });
    store.clearSignature("a");
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    store.saveSignature({ trackId: "a", dataUrl: PNG });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("signaturesSnapshot change quand une signature arrive, stable sinon (clé de memo)", () => {
    const before = store.signaturesSnapshot();
    store.saveSignature({ trackId: "a", dataUrl: PNG });
    const after = store.signaturesSnapshot();
    expect(after).not.toBe(before);
    expect(store.signaturesSnapshot()).toBe(after);
  });

  it("avant hydrateSignatures, un module frais ne lit pas localStorage (rendu d'hydratation = serveur)", async () => {
    store.saveSignature({ trackId: "a", dataUrl: PNG });
    const reloaded = await freshStore();
    expect(reloaded.getSignature("a")).toBeNull();
    expect(reloaded.signaturesSnapshot()).toBe("{}");
  });

  it("hydrateSignatures relit localStorage une fois et notifie (persistance entre rechargements)", async () => {
    store.saveSignature({ trackId: "a", dataUrl: PNG });
    const reloaded = await freshStore();
    const fn = vi.fn();
    reloaded.subscribeSignatures(fn);
    reloaded.hydrateSignatures();
    expect(reloaded.getSignature("a")?.dataUrl).toBe(PNG);
    expect(fn).toHaveBeenCalledTimes(1);
    reloaded.hydrateSignatures();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("saveSignature hydrate d'abord : n'écrase pas la signature d'un autre titre", async () => {
    store.saveSignature({ trackId: "a", dataUrl: PNG });
    const reloaded = await freshStore();
    reloaded.saveSignature({ trackId: "b", dataUrl: PNG });
    expect(reloaded.getSignature("a")?.dataUrl).toBe(PNG);
  });

  it("un localStorage corrompu ou mal formé est ignoré sans lever", async () => {
    window.localStorage.setItem("day1-signatures", "{not json");
    let reloaded = await freshStore();
    expect(() => reloaded.hydrateSignatures()).not.toThrow();
    expect(reloaded.getSignature("a")).toBeNull();
    // Entrée sans data URL image : écartée, les autres conservées.
    window.localStorage.setItem(
      "day1-signatures",
      JSON.stringify({
        a: { trackId: "a", signedAt: "2026-09-17T00:00:00Z", dataUrl: "javascript:alert(1)" },
        b: { trackId: "b", signedAt: "2026-09-17T00:00:00Z", dataUrl: PNG },
      }),
    );
    reloaded = await freshStore();
    reloaded.hydrateSignatures();
    expect(reloaded.getSignature("a")).toBeNull();
    expect(reloaded.getSignature("b")?.dataUrl).toBe(PNG);
  });
});

describe("signatures-store (serveur, sans window)", () => {
  it("getSignature renvoie null et signaturesSnapshot une chaîne, sans lever", async () => {
    vi.unstubAllGlobals();
    const store = await freshStore();
    expect(typeof window).toBe("undefined");
    expect(() => store.hydrateSignatures()).not.toThrow();
    expect(store.getSignature("a")).toBeNull();
    expect(store.signaturesSnapshot()).toBe("{}");
  });
});

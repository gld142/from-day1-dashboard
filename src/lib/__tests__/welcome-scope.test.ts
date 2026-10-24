/**
 * Écran co-brandé /welcome?source=… et maisons. welcome.json porte un bloc par partenaire, dont
 * Believe (contact nommé, positionnement face à DistroKid). MESURÉ le 24/10/2026 (curl) : tout le
 * namespace partait avec le fournisseur racine, donc dans le HTML de /connexion et /inscription
 * (publiques) des DEUX maisons — dans la maison universal, le partenariat Believe de Day 1 se
 * lisait chez Universal.
 *
 * Attendu : `welcome` est un namespace « de page » (il ne part qu'avec /welcome), et la maison
 * universal ne connaît que ses canaux (entités Universal Music Group + direct) : ni résolution
 * de `?source=believe`, ni bloc Believe dans les messages qu'elle envoie. La maison day1 ne
 * change pas.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_ARTISTS } from "@/lib/demo/data";
import { TENANTS, type TenantId } from "@/lib/tenant";
import { getMessages, pageMessages, rootClientMessages } from "@/messages";
import frWelcome from "@/messages/fr/welcome.json";
import enWelcome from "@/messages/en/welcome.json";
import { SOURCES, SOURCE_IDS, resolveSource, sourceIdsFor } from "@/components/modules/welcome/sources";

/* Les fournisseurs next-intl lisent la langue de la requête (`getLocale`, next-intl/server) :
   hors serveur Next, on la fixe. Rien d'autre n'est simulé. */
const requestLocale = vi.hoisted(() => ({ value: "fr" as "fr" | "en" }));
vi.mock("next-intl/server", () => ({ getLocale: async () => requestLocale.value }));

const WELCOME = { fr: frWelcome, en: enWelcome } as const;
const HOUSES = ["day1", "universal"] as const;
const LOCALES = ["fr", "en"] as const;

/** Les marqueurs du bloc partenaire Believe (fr, en) : le contact nommé et le positionnement. */
const BELIEVE_BLOCK = /Ismaël|Kané|Différenciation Believe|Believe vs DistroKid|artistes Believe|Believe artists/;
/** Seule mention légitime de Believe dans welcome.json : les formats CSV du canal direct. */
const CSV_FORMATS = "DistroKid, TuneCore, Believe";

type Welcome = { sources: Record<string, Record<string, unknown>> } & Record<string, unknown>;

describe("maisons : canaux co-brandés de /welcome", () => {
  it("day1 ouvre les cinq canaux (direct par défaut) ; universal, les entités Universal Music Group et direct (universal par défaut)", () => {
    expect([...TENANTS.day1.welcomeSources].sort()).toEqual([...SOURCE_IDS].sort());
    expect(TENANTS.day1.welcomeDefaultSource).toBe("direct");
    expect([...TENANTS.universal.welcomeSources].sort()).toEqual(["capitol", "direct", "umpg", "universal"]);
    expect(TENANTS.universal.welcomeDefaultSource).toBe("universal");
  });
  it("chaque maison : canaux connus de SOURCES, et le canal par défaut en fait partie", () => {
    for (const t of Object.values(TENANTS)) {
      for (const id of t.welcomeSources) expect(SOURCE_IDS, `${t.id} · ${id}`).toContain(id);
      expect(t.welcomeSources).toContain(t.welcomeDefaultSource);
    }
  });
});

describe("resolveSource — un `?source=` fermé ou inconnu retombe sur le canal par défaut de la maison", () => {
  it("day1 : inchangé (believe résolu, direct par défaut)", () => {
    const d = TENANTS.day1;
    for (const id of SOURCE_IDS) expect(resolveSource(id, d).id, id).toBe(id);
    expect(resolveSource("believe", d).id).toBe("believe");
    expect(resolveSource(["believe", "umpg"], d).id).toBe("believe");
    expect(resolveSource(undefined, d).id).toBe("direct");
    expect(resolveSource("sony", d).id).toBe("direct");
    expect(resolveSource([], d).id).toBe("direct");
  });
  it("universal : believe n'est jamais résolu ; capitol, umpg, universal et direct le sont", () => {
    const u = TENANTS.universal;
    expect(resolveSource("believe", u).id).toBe("universal");
    expect(resolveSource(["believe"], u).id).toBe("universal");
    for (const id of ["capitol", "umpg", "universal", "direct"] as const) expect(resolveSource(id, u).id, id).toBe(id);
    expect(resolveSource(undefined, u).id).toBe("universal");
    expect(resolveSource("sony", u).id).toBe("universal");
  });
  it("une clé héritée d'Object (toString, __proto__, constructor) n'est pas un canal", () => {
    for (const t of Object.values(TENANTS)) {
      for (const raw of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
        expect(resolveSource(raw, t), `${t.id} · ${raw}`).toBe(SOURCES[t.welcomeDefaultSource]);
      }
    }
  });
  it("sourceIdsFor : la bascule de canal ne liste que les canaux de la maison, dans l'ordre de SOURCES", () => {
    expect(sourceIdsFor(TENANTS.day1)).toEqual(SOURCE_IDS);
    expect(sourceIdsFor(TENANTS.universal)).toEqual(SOURCE_IDS.filter((id) => id !== "believe"));
  });
});

describe("welcome est un namespace de page : ni dans la racine, ni dans les messages de la requête", () => {
  for (const house of HOUSES) {
    for (const locale of LOCALES) {
      it(`${house} · ${locale} : rootClientMessages et getMessages sans welcome ni bloc Believe`, () => {
        const root = rootClientMessages(locale, TENANTS[house]) as Record<string, unknown>;
        const request = getMessages(locale, TENANTS[house]) as Record<string, unknown>;
        expect(Object.keys(root)).not.toContain("welcome");
        expect(Object.keys(request)).not.toContain("welcome");
        expect(Object.keys(root)).toContain("common");
        expect(Object.keys(root)).toContain("nav");
        expect(JSON.stringify(root)).not.toMatch(BELIEVE_BLOCK);
        /* Côté serveur, la maison day1 garde la page interne /onboardings, qui nomme aussi ce
           contact (onboardings.json) : namespace de page lui aussi, jamais dans la racine. */
        const requestOutsideInternal = Object.entries(request).filter(([ns]) => ns !== "onboardings");
        expect(JSON.stringify(requestOutsideInternal)).not.toMatch(BELIEVE_BLOCK);
        if (house === "universal") expect(JSON.stringify(request)).not.toMatch(BELIEVE_BLOCK);
      });
    }
  }
});

describe("pageMessages(…, ['welcome']) — les messages racine + les seuls canaux de la maison", () => {
  for (const locale of LOCALES) {
    it(`${locale} · day1 : welcome intact (cinq canaux, Believe compris)`, () => {
      const m = pageMessages(locale, ["welcome"], TENANTS.day1) as Record<string, unknown>;
      expect(m.welcome).toEqual(WELCOME[locale]);
      expect(JSON.stringify(m.welcome)).toMatch(BELIEVE_BLOCK); // témoin : le marqueur trouve le bloc quand il y est
      for (const [k, v] of Object.entries(rootClientMessages(locale, TENANTS.day1))) expect(m[k], k).toBe(v);
      expect(Object.keys(m)).not.toContain("onboardings");
      expect(Object.keys(m)).not.toContain("comparatif");
    });
    it(`${locale} · universal : ni bloc believe, ni « Believe » hors des formats CSV, ni « Ismaël »`, () => {
      const m = pageMessages(locale, ["welcome"], TENANTS.universal) as Record<string, unknown>;
      const welcome = m.welcome as Welcome;
      expect(Object.keys(welcome.sources).sort()).toEqual(["capitol", "direct", "umpg", "universal"]);
      const text = JSON.stringify(welcome);
      expect(text).not.toMatch(BELIEVE_BLOCK);
      expect(text.replaceAll(CSV_FORMATS, "")).not.toMatch(/Believe|Ismaël/);
      // Le reste du namespace est celui de day1, à l'identique.
      for (const [k, v] of Object.entries(WELCOME[locale])) if (k !== "sources") expect(welcome[k], k).toBe(v);
      for (const id of Object.keys(welcome.sources)) {
        expect(welcome.sources[id], id).toBe((WELCOME[locale].sources as Record<string, unknown>)[id]);
      }
      for (const [k, v] of Object.entries(rootClientMessages(locale, TENANTS.universal))) expect(m[k], k).toBe(v);
    });
  }

  /* Rien ne doit s'afficher en clé brute : chaque clé que lit cobrand-screen.tsx existe, pour chaque
     canal ouvert de chaque maison (welcome.* et nav.items.* de la sidebar du canal). */
  for (const house of HOUSES) {
    for (const locale of LOCALES) {
      it(`${house} · ${locale} : toutes les clés lues par l'écran existent pour chaque canal ouvert`, () => {
        const m = pageMessages(locale, ["welcome"], TENANTS[house]) as Record<string, unknown>;
        const welcome = m.welcome as Welcome;
        const items = (m.nav as { items: Record<string, string> }).items;
        for (const key of ["brand", "url", "cta", "switchSource", "valuesTitle", "sidebarTitle", "hiddenSuffix", "firstInsightLabel"]) {
          expect(typeof welcome[key], key).toBe("string");
        }
        for (const id of sourceIdsFor(TENANTS[house])) {
          const s = welcome.sources[id] as Record<string, unknown> & {
            steps: Record<string, { title: string; desc: string }>;
            values: Record<string, { promise: string; delivery: string }>;
          };
          expect(s, id).toBeDefined();
          for (const key of ["name", "welcomeTitle", "welcomeBody", "offer", "firstInsight"]) {
            expect(typeof s[key], `${id}.${key}`).toBe("string");
          }
          for (const n of [1, 2, 3]) {
            expect(typeof s.steps[n]?.title, `${id}.steps.${n}`).toBe("string");
            expect(typeof s.steps[n]?.desc, `${id}.steps.${n}`).toBe("string");
          }
          for (let i = 1; i <= SOURCES[id].values; i++) {
            expect(typeof s.values[i]?.promise, `${id}.values.${i}`).toBe("string");
            expect(typeof s.values[i]?.delivery, `${id}.values.${i}`).toBe("string");
          }
          for (const key of [...SOURCES[id].sidebar, ...SOURCES[id].hidden]) {
            expect(typeof items[key], `nav.items.${key} (${id})`).toBe("string");
          }
        }
      });
    }
  }

  /* welcome ne passe plus par getMessages : excluded-artists.test.ts ne le couvre plus, on le couvre ici. */
  for (const tenant of Object.values(TENANTS)) {
    it(`${tenant.id} : les canaux envoyés ne nomment aucun artiste exclu`, () => {
      const names = ALL_ARTISTS.filter((a) => tenant.excludedArtists.includes(a.id)).map((a) => a.name);
      expect(names).toHaveLength(tenant.excludedArtists.length);
      for (const locale of LOCALES) {
        const text = JSON.stringify(pageMessages(locale, ["welcome"], tenant).welcome);
        for (const name of names) expect(text, `${locale} nomme ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`, "i"));
      }
    });
  }
});

/* Ce que la page et les fournisseurs passent VRAIMENT : la maison est lue au chargement du module,
   on recharge par maison. */
describe("/welcome et fournisseurs : ce qui part vers le navigateur, par maison", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    requestLocale.value = "fr";
  });
  type El = { type?: unknown; props: Record<string, unknown> & { messages?: Record<string, unknown>; children?: unknown } };
  async function inHouse(house: TenantId) {
    vi.stubEnv("NEXT_PUBLIC_TENANT", house);
    vi.stubEnv("DEMO_MODE", "on");
    vi.resetModules();
    return import("@/i18n/intl-providers");
  }

  for (const house of HOUSES) {
    for (const locale of LOCALES) {
      it(`${house} · ${locale} : RootIntlProvider (toutes les pages, /connexion comprise) n'envoie pas welcome`, async () => {
        requestLocale.value = locale;
        const { RootIntlProvider } = await inHouse(house);
        const el = (await RootIntlProvider({ children: null })) as El;
        expect(el.props.messages).toBeDefined();
        expect(Object.keys(el.props.messages!)).not.toContain("welcome");
        expect(JSON.stringify(el.props.messages)).not.toMatch(BELIEVE_BLOCK);
      });
    }
  }

  for (const [house, expected] of [
    ["day1", "believe"],
    ["universal", "universal"],
  ] as const) {
    it(`${house} : /welcome?source=believe → canal ${expected}, vue enveloppée d'un fournisseur qui porte welcome`, async () => {
      const { PageIntlProvider } = await inHouse(house);
      const { CobrandScreen } = await import("@/components/modules/welcome/cobrand-screen");
      const { sourceIdsFor: idsFor } = await import("@/components/modules/welcome/sources");
      const { default: WelcomePage } = await import("@/app/welcome/page");
      const el = (await WelcomePage({ searchParams: Promise.resolve({ source: "believe" }) })) as El;
      expect(el.type).toBe(PageIntlProvider);
      expect(el.props.namespaces).toEqual(["welcome"]);
      const screen = el.props.children as El;
      expect(screen.type).toBe(CobrandScreen);
      expect((screen.props.source as { id: string }).id).toBe(expected);
      expect(screen.props.sourceIds).toEqual(idsFor(TENANTS[house]));
      const provided = (await PageIntlProvider(el.props as Parameters<typeof PageIntlProvider>[0])) as El;
      const messages = provided.props.messages!;
      expect(Object.keys(messages)).toContain("common");
      expect(Object.keys(messages)).toContain("nav");
      const sources = Object.keys((messages.welcome as Welcome).sources).sort();
      if (house === "day1") {
        expect(sources).toEqual([...SOURCE_IDS].sort());
        expect(JSON.stringify(messages)).toMatch(BELIEVE_BLOCK);
      } else {
        expect(sources).toEqual(["capitol", "direct", "umpg", "universal"]);
        expect(JSON.stringify(messages)).not.toMatch(BELIEVE_BLOCK);
      }
    });
  }
});

/**
 * Pages internes From Day 1 (`internal` dans nav.ts : /comparatif, /onboardings) et
 * maisons. /onboardings contient le pitch de Day 1 À PROPOS d'Universal : dans la maison
 * universal, ces pages n'existent pas (404 réel, posé par le proxy ; `notFound()` de la page en
 * seconde ligne), aucune liste (navigation, palette, Réglages → Modules) ne les cite, et leurs
 * textes ne partent pas vers le navigateur. Dans la maison day1, rien ne change.
 */
import { readdirSync } from "node:fs";
import { NextRequest } from "next/server";
import { getRewrittenUrl, isRewrite } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_AR_ITEM,
  CUSTOMER_BUSINESS_ITEMS,
  CUSTOMER_CATALOG_ITEM,
  CUSTOMER_FIGURES_ITEMS,
  CUSTOMER_HOME_ITEM,
  CUSTOMER_ROSTER_ITEM,
  CUSTOMER_SIGNALS_ITEMS,
  INTERNAL_ROUTES,
  NAV_SECTIONS,
  UNMATCHED_PATH,
  customerSections,
  internalPageMessageKeys,
  isRouteAllowedForTenant,
  moduleDescKey,
  navCatalogForPersona,
  navForPersona,
  sectionsForTenant,
} from "@/lib/nav";
import { getMessages, internalPageMessages, pageMessages, rootClientMessages } from "@/messages";
import { TENANTS, type TenantId } from "@/lib/tenant";

/* Les fournisseurs next-intl lisent la langue de la requête (`getLocale`, next-intl/server) :
   hors serveur Next, on la fixe. Rien d'autre n'est simulé. */
const requestLocale = vi.hoisted(() => ({ value: "fr" as "fr" | "en" }));
vi.mock("next-intl/server", () => ({ getLocale: async () => requestLocale.value }));

/* Le proxy lit la session Supabase (réseau) : on compte les clients créés, sans réseau. Une page
   interne de la maison universal doit répondre AVANT (0 client). */
const supabase = vi.hoisted(() => ({ clients: 0 }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => {
    supabase.clients++;
    return { auth: { getUser: async () => ({ data: { user: null } }) } };
  },
}));

/** Le texte du pitch À PROPOS d'Universal, tel qu'il est écrit (fr, en : onboardings.json). Un
    marqueur qui ne correspond à aucun texte ne peut pas échouer : le témoin plus bas le vérifie. */
const PITCH_TEXT = /Universal détient la donnée|Universal holds the data/;
/** Les marqueurs du pitch interne : son texte et le nom de son contact. */
const PITCH = new RegExp(`${PITCH_TEXT.source}|Bertil`);

const flat = (sections: ReturnType<typeof navForPersona>) => sections.flatMap((s) => s.items.map((i) => i.href));

/** Les libellés des pages internes dans les namespaces COMMUNS (nav, settings), dérivés de nav.ts. */
const LABEL_KEYS = internalPageMessageKeys();
const SETTINGS_DESC_PATHS = LABEL_KEYS.settingsDesc.map((k) => `modules.desc.${k}`);

/** Copie de `ns` sans les clés à points données (« items.onboardings ») : calcul indépendant du code testé. */
function withoutKeys(ns: unknown, dotted: readonly string[]): unknown {
  const copy = structuredClone(ns) as Record<string, unknown>;
  for (const key of dotted) {
    const path = key.split(".");
    const last = path.pop()!;
    const parent = path.reduce<Record<string, unknown> | undefined>((o, k) => o?.[k] as Record<string, unknown> | undefined, copy);
    if (parent) delete parent[last];
  }
  return copy;
}

/** Valeur d'une clé à points dans un namespace. */
const at = (ns: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], ns);

describe("isRouteAllowedForTenant", () => {
  it("maison day1 : les pages internes et leurs sous-pages restent ouvertes", () => {
    for (const href of ["/comparatif", "/onboardings", "/onboardings/umpg", "/pulse", "/settings"]) {
      expect(isRouteAllowedForTenant(href, TENANTS.day1), href).toBe(true);
    }
  });
  it("maison universal : les pages internes et leurs sous-pages sont fermées, les autres ouvertes", () => {
    for (const href of ["/comparatif", "/onboardings", "/onboardings/umpg", "/comparatif/"]) {
      expect(isRouteAllowedForTenant(href, TENANTS.universal), href).toBe(false);
    }
    for (const href of ["/pulse", "/roster", "/settings", "/onboardings-bis", "/fractional"]) {
      expect(isRouteAllowedForTenant(href, TENANTS.universal), href).toBe(true);
    }
  });
  it("seule la maison day1 ouvre les pages internes", () => {
    expect(TENANTS.day1.internalPages).toBe(true);
    expect(TENANTS.universal.internalPages).toBe(false);
  });
});

describe("sectionsForTenant — navigation, palette ⌘K et Réglages → Modules", () => {
  it("universal : même activées par un choix utilisateur, les pages internes ne sont listées nulle part", () => {
    const catalog = sectionsForTenant(navCatalogForPersona("label"), TENANTS.universal);
    expect(flat(catalog)).not.toContain("/comparatif");
    expect(flat(catalog)).not.toContain("/onboardings");
    expect(catalog.map((s) => s.labelKey)).not.toContain("sections.pitch");
    const forced = sectionsForTenant(
      navForPersona("label", { "/comparatif": true, "/onboardings": true }),
      TENANTS.universal,
    );
    expect(flat(forced)).not.toContain("/comparatif");
    expect(flat(forced)).not.toContain("/onboardings");
    expect(forced.map((s) => s.labelKey)).not.toContain("sections.pitch");
    // Rien d'autre ne disparaît.
    const others = (sections: ReturnType<typeof navForPersona>) =>
      flat(sections).filter((h) => h !== "/comparatif" && h !== "/onboardings");
    expect(flat(catalog)).toEqual(others(navCatalogForPersona("label")));
  });
  it("day1 : rien ne change (même référence de contenu, pages internes comprises)", () => {
    const catalog = navCatalogForPersona("label");
    expect(sectionsForTenant(catalog, TENANTS.day1)).toEqual(catalog);
    const forced = navForPersona("label", { "/onboardings": true });
    expect(flat(sectionsForTenant(forced, TENANTS.day1))).toContain("/onboardings");
  });
});

describe("getMessages — les textes des pages internes ne partent pas vers le navigateur d'une maison qui les ferme", () => {
  /* Le NextIntlClientProvider racine hérite de TOUS les messages de la requête (next-intl 4,
     NextIntlClientProviderServer) : ils sont sérialisés dans chaque page, /connexion comprise. */
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : universal sans comparatif ni onboardings, le reste identique ; day1 complet`, () => {
      const day1 = getMessages(locale, TENANTS.day1) as Record<string, unknown>;
      const universal = getMessages(locale, TENANTS.universal) as Record<string, unknown>;
      expect(Object.keys(day1)).toContain("onboardings");
      expect(Object.keys(day1)).toContain("comparatif");
      expect(Object.keys(universal)).not.toContain("onboardings");
      expect(Object.keys(universal)).not.toContain("comparatif");
      expect(Object.keys(universal).sort()).toEqual(
        Object.keys(day1).filter((k) => k !== "onboardings" && k !== "comparatif").sort(),
      );
      // nav et settings : les mêmes, moins les libellés des pages internes (describe plus bas).
      for (const k of Object.keys(universal)) {
        if (k === "nav") expect(universal.nav, k).toEqual(withoutKeys(day1.nav, LABEL_KEYS.nav));
        else if (k === "settings") expect(universal.settings, k).toEqual(withoutKeys(day1.settings, SETTINGS_DESC_PATHS));
        else expect(universal[k], k).toBe(day1[k]);
      }
      expect(JSON.stringify(universal)).not.toMatch(PITCH_TEXT);
    });
    /* Témoin du marqueur ci-dessus : jusqu'au 24/10 il cherchait « Universal owns the data », que
       rien n'écrit (le texte anglais est « Universal holds the data ») — en anglais, il ne pouvait
       pas échouer. Il doit trouver le pitch là où il est : la page /onboardings de la maison day1. */
    it(`${locale} : témoin — le marqueur du pitch trouve son texte dans les messages de /onboardings (day1)`, () => {
      expect(JSON.stringify(internalPageMessages(locale, ["onboardings"], TENANTS.day1))).toMatch(PITCH_TEXT);
      expect(JSON.stringify(pageMessages(locale, ["onboardings"], TENANTS.day1))).toMatch(PITCH_TEXT);
      expect(JSON.stringify(getMessages(locale, TENANTS.day1))).toMatch(PITCH_TEXT);
    });
  }
});

/* Les libellés des pages internes vivent aussi dans des namespaces COMMUNS, envoyés par le fournisseur
   racine sur toutes les pages : nav (navigation, palette ⌘K) et settings (Réglages → Modules).
   Mesuré le 24/10/2026 (curl, HTML de /connexion sur 3006, maison universal) : « Onboardings
   partenaires » 1, « usage interne » 1 — alors qu'aucune liste de la maison ne cite ces pages. */
describe("libellés des pages internes (nav, Réglages → Modules) : absents de la maison universal, intacts dans la maison day1", () => {
  const internalItems = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => i.internal);
  const MEASURED = {
    fr: ["Onboardings partenaires", "usage interne", "vs Concurrents", "Stratégie & pitch", "Pipeline interne des partenariats"],
    en: ["Partner onboardings", "internal use", "vs Competitors", "Strategy & pitch", "Internal partnership pipeline"],
  } as const;

  it("internalPageMessageKeys : chaque item `internal` de nav.ts, la section dont toutes les pages le sont, et rien d'une page ouverte", () => {
    expect(internalItems.length).toBeGreaterThan(0);
    for (const i of internalItems) {
      expect(LABEL_KEYS.nav, i.href).toContain(i.labelKey);
      expect(LABEL_KEYS.settingsDesc, i.href).toContain(moduleDescKey(i));
    }
    for (const s of NAV_SECTIONS) {
      expect(LABEL_KEYS.nav.includes(s.labelKey), s.labelKey).toBe(s.items.every((i) => i.internal));
    }
    // Aucune clé retirée ne sert une page ouverte : navigation de la démo ET du mode client.
    const customer = { view: "label", role: "owner", artistName: "X" } as Parameters<typeof customerSections>[0];
    const artist = { view: "artist", role: "artist", artistName: "X" } as Parameters<typeof customerSections>[0];
    const importItem = { href: "/import", labelKey: "items.importer", icon: CUSTOMER_HOME_ITEM.icon };
    const customerLists = [...customerSections(customer, importItem), ...customerSections(artist, importItem)];
    const openItems = [
      ...NAV_SECTIONS.flatMap((s) => s.items).filter((i) => !i.internal),
      CUSTOMER_HOME_ITEM, CUSTOMER_ROSTER_ITEM, CUSTOMER_CATALOG_ITEM, CUSTOMER_AR_ITEM,
      ...CUSTOMER_FIGURES_ITEMS, ...CUSTOMER_SIGNALS_ITEMS, ...CUSTOMER_BUSINESS_ITEMS,
      ...customerLists.flatMap((s) => s.items),
    ];
    for (const i of openItems) {
      expect(LABEL_KEYS.nav, i.href).not.toContain(i.labelKey);
      expect(LABEL_KEYS.settingsDesc, i.href).not.toContain(moduleDescKey(i));
    }
    for (const s of customerLists) expect(LABEL_KEYS.nav, s.labelKey).not.toContain(s.labelKey);
    // Photo lisible de la dérivation d'aujourd'hui.
    expect(LABEL_KEYS).toEqual({
      nav: ["items.comparatif", "items.onboardings", "sections.pitch"],
      settingsDesc: ["comparatif", "onboardings"],
    });
  });

  for (const locale of ["fr", "en"] as const) {
    it(`${locale} · universal : ni la requête, ni la racine, ni une page ne portent ces libellés ; le reste de nav et settings intact`, () => {
      const day1 = getMessages(locale, TENANTS.day1) as Record<string, unknown>;
      // Témoin : chaque clé retirée a bien un texte dans la maison day1.
      const texts = [
        ...LABEL_KEYS.nav.map((k) => at(day1.nav, k)),
        ...SETTINGS_DESC_PATHS.map((k) => at(day1.settings, k)),
      ];
      for (const t of texts) expect(typeof t === "string" && t.length > 0, String(t)).toBe(true);
      const sent = {
        getMessages: getMessages(locale, TENANTS.universal),
        rootClientMessages: rootClientMessages(locale, TENANTS.universal),
        "pageMessages(welcome)": pageMessages(locale, ["welcome"], TENANTS.universal),
        "internalPageMessages(onboardings, comparatif)": internalPageMessages(locale, ["onboardings", "comparatif"], TENANTS.universal),
      };
      for (const [name, m] of Object.entries(sent)) {
        const json = JSON.stringify(m);
        for (const t of [...texts, ...MEASURED[locale]]) {
          expect(json.includes(JSON.stringify(t).slice(1, -1)), `${name} contient « ${String(t)} »`).toBe(false);
        }
        const r = m as Record<string, unknown>;
        expect(r.nav, name).toEqual(withoutKeys(day1.nav, LABEL_KEYS.nav));
        expect(r.settings, name).toEqual(withoutKeys(day1.settings, SETTINGS_DESC_PATHS));
      }
    });
    it(`${locale} · day1 : les libellés restent (témoin des chaînes mesurées), nav et settings tels quels`, () => {
      const root = rootClientMessages(locale, TENANTS.day1) as Record<string, unknown>;
      const json = JSON.stringify(root);
      for (const t of MEASURED[locale]) expect(json, t).toContain(JSON.stringify(t).slice(1, -1));
      for (const k of LABEL_KEYS.nav) expect(at(root.nav, k), k).toBeTypeOf("string");
      for (const k of SETTINGS_DESC_PATHS) expect(at(root.settings, k), k).toBeTypeOf("string");
    });
  }
});

/* 404 RÉEL. `notFound()` dans la page ne suffit pas : le segment (dashboard) a un loading.tsx, la
   réponse part en flux avec un statut 200 (doc Next 16, file-conventions/not-found.md et loading.md
   « Status Codes » ; mesuré par la revue du 24/10). La doc recommande de vérifier AVANT, dans le
   proxy, et de réécrire vers une route introuvable : la liste du proxy est dérivée de nav.ts. */
describe("INTERNAL_ROUTES — la liste du proxy, dérivée des items `internal` de nav.ts", () => {
  const items = NAV_SECTIONS.flatMap((s) => s.items);
  it("chaque item `internal` et rien d'autre ; sous-pages fermées, voisines ouvertes", () => {
    const expected = items.filter((i) => i.internal).map((i) => i.href);
    expect(expected.length).toBeGreaterThan(0);
    expect([...INTERNAL_ROUTES].sort()).toEqual([...expected].sort());
    for (const href of expected) {
      for (const p of [href, `${href}/`, `${href}/umpg`, `${href}/a/b`]) {
        expect(isRouteAllowedForTenant(p, TENANTS.universal), p).toBe(false);
        expect(isRouteAllowedForTenant(p, TENANTS.day1), p).toBe(true);
      }
      for (const p of [`${href}-bis`, `${href}s`]) expect(isRouteAllowedForTenant(p, TENANTS.universal), p).toBe(true);
    }
    for (const i of items.filter((x) => !x.internal)) expect(isRouteAllowedForTenant(i.href, TENANTS.universal), i.href).toBe(true);
  });
  it("UNMATCHED_PATH ne correspond à aucune route : dossier privé « _ », et aucun segment dynamique à la racine de app/", () => {
    expect(UNMATCHED_PATH).toMatch(/^\/_[a-z-]+$/);
    // Un segment dynamique à la racine ([slug], [...slug]), même dans un groupe (x), l'attraperait.
    const appDir = new URL("../../app/", import.meta.url);
    const top = readdirSync(appDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    const groups = top.filter((d) => /^\(.+\)$/.test(d.name)).flatMap((g) =>
      readdirSync(new URL(`${g.name}/`, appDir), { withFileTypes: true }).filter((d) => d.isDirectory()),
    );
    expect(top.length).toBeGreaterThan(3); // témoin : le dossier lu est bien app/
    for (const d of [...top, ...groups]) expect(d.name, d.name).not.toMatch(/^\[/);
  });
});

describe("proxy — une page interne de la maison universal répond 404 avant la porte et la session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    supabase.clients = 0;
  });
  async function proxyIn(house: TenantId) {
    vi.stubEnv("NEXT_PUBLIC_TENANT", house);
    vi.stubEnv("DEMO_MODE", "on");
    vi.resetModules();
    return (await import("@/proxy")).proxy;
  }
  it("universal : chaque route interne et ses sous-pages sont réécrites vers la route introuvable, sans cookie ni session", async () => {
    const proxy = await proxyIn("universal");
    for (const href of INTERNAL_ROUTES) {
      for (const p of [href, `${href}/umpg`, `${href}?persona=label`]) {
        const res = await proxy(new NextRequest(`http://localhost:3006${p}`));
        expect(isRewrite(res), p).toBe(true);
        expect(new URL(getRewrittenUrl(res)!).pathname, p).toBe(UNMATCHED_PATH);
      }
    }
    expect(supabase.clients).toBe(0);
  });
  it("universal : une page ouverte suit son chemin habituel (sans cookie : la porte)", async () => {
    const proxy = await proxyIn("universal");
    const res = await proxy(new NextRequest("http://localhost:3006/pulse"));
    expect(isRewrite(res)).toBe(false);
    expect(res.headers.get("location")).toBe("http://localhost:3006/acces?next=%2Fpulse");
  });
  it("day1 : /onboardings suit la porte comme avant (307 vers /acces?next=…)", async () => {
    const proxy = await proxyIn("day1");
    const res = await proxy(new NextRequest("http://localhost:3005/onboardings"));
    expect(isRewrite(res)).toBe(false);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3005/acces?next=%2Fonboardings");
  });
});

/* Seconde ligne, derrière le proxy : la page serveur appelle `notFound()` (doc Next 16,
   functions/not-found.md) — interface 404, statut 200 sous le loading.tsx de (dashboard). La maison
   est lue au chargement du module : on recharge par maison. */
describe("garde des pages internes (seconde ligne) : notFound() dans la maison universal, la vue dans la maison day1", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  async function loadPage(house: TenantId, route: "comparatif" | "onboardings") {
    vi.stubEnv("NEXT_PUBLIC_TENANT", house);
    vi.resetModules();
    const mod =
      route === "comparatif"
        ? await import("@/app/(dashboard)/comparatif/page")
        : await import("@/app/(dashboard)/onboardings/page");
    return mod.default as () => unknown;
  }
  for (const route of ["comparatif", "onboardings"] as const) {
    it(`/${route} — universal : notFound()`, async () => {
      const Page = await loadPage("universal", route);
      let thrown: unknown = null;
      try {
        Page();
      } catch (e) {
        thrown = e;
      }
      expect((thrown as { digest?: string } | null)?.digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    });
    it(`/${route} — day1 : la vue est rendue`, async () => {
      const Page = await loadPage("day1", route);
      const el = Page() as { type?: unknown } | null;
      expect(el).not.toBeNull();
      expect(typeof el?.type).toBe("function");
    });
  }
});

/* Le fournisseur racine est monté sur TOUTES les pages, /connexion et /inscription comprises
   (publiques, sans porte) : ce qu'il reçoit est sérialisé dans leur HTML. Mesuré le 24/10/2026 sur
   le serveur de dev day1 : « Universal détient la donnée… » et « Bertil » dans le HTML de
   /connexion et /inscription. Les namespaces des pages internes ne partent donc qu'avec leur page. */
describe("rootClientMessages — le fournisseur racine n'envoie aucun texte de page interne, dans les deux maisons", () => {
  for (const house of ["day1", "universal"] as const) {
    for (const locale of ["fr", "en"] as const) {
      it(`${house} · ${locale} : ni comparatif ni onboardings, le reste identique à getMessages`, () => {
        const root = rootClientMessages(locale, TENANTS[house]) as Record<string, unknown>;
        const all = getMessages(locale, TENANTS[house]) as Record<string, unknown>;
        expect(Object.keys(root)).not.toContain("onboardings");
        expect(Object.keys(root)).not.toContain("comparatif");
        expect(Object.keys(root).sort()).toEqual(
          Object.keys(all).filter((k) => k !== "onboardings" && k !== "comparatif").sort(),
        );
        for (const k of Object.keys(root)) expect(root[k], k).toBe(all[k]);
        expect(JSON.stringify(root)).not.toMatch(PITCH);
      });
    }
  }
});

describe("internalPageMessages — une page interne reçoit les messages racine ET son namespace, pas celui de l'autre", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} · day1 : /onboardings a onboardings (le pitch), pas comparatif`, () => {
      const m = internalPageMessages(locale, ["onboardings"], TENANTS.day1) as Record<string, unknown>;
      const all = getMessages(locale, TENANTS.day1) as Record<string, unknown>;
      expect(m.onboardings).toBe(all.onboardings);
      expect(Object.keys(m)).not.toContain("comparatif");
      for (const [k, v] of Object.entries(rootClientMessages(locale, TENANTS.day1))) expect(m[k], k).toBe(v);
      expect(JSON.stringify(m)).toMatch(PITCH); // témoin : le marqueur trouve bien le pitch quand il y est
    });
    it(`${locale} · day1 : /comparatif a comparatif, pas onboardings (ni le pitch)`, () => {
      const m = internalPageMessages(locale, ["comparatif"], TENANTS.day1) as Record<string, unknown>;
      const all = getMessages(locale, TENANTS.day1) as Record<string, unknown>;
      expect(m.comparatif).toBe(all.comparatif);
      expect(Object.keys(m)).not.toContain("onboardings");
      expect(JSON.stringify(m)).not.toMatch(PITCH);
    });
    it(`${locale} · universal : aucune page interne, même demandée (défense en profondeur)`, () => {
      const m = internalPageMessages(locale, ["onboardings", "comparatif"], TENANTS.universal) as Record<string, unknown>;
      expect(Object.keys(m)).not.toContain("onboardings");
      expect(Object.keys(m)).not.toContain("comparatif");
      expect(JSON.stringify(m)).not.toMatch(PITCH);
    });
  }
});

/* Ce que les fournisseurs passent VRAIMENT à NextIntlClientProvider. Sans `messages`, next-intl 4
   (NextIntlClientProviderServer) hérite de TOUT `getMessages()` : la prop doit être présente. Le
   fournisseur imbriqué ne fusionne pas avec le parent (use-intl, IntlProvider : `messages` fourni
   remplace celui du contexte) : il porte donc les messages racine + son namespace. */
describe("fournisseurs next-intl : la racine sans pages internes, chaque page interne avec le sien", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    requestLocale.value = "fr";
  });
  type Provided = { type?: unknown; props: { messages?: Record<string, unknown>; children?: unknown; namespaces?: unknown } };
  async function inHouse(house: TenantId) {
    vi.stubEnv("NEXT_PUBLIC_TENANT", house);
    vi.resetModules();
    return import("@/i18n/intl-providers");
  }
  for (const house of ["day1", "universal"] as const) {
    for (const locale of ["fr", "en"] as const) {
      it(`${house} · ${locale} : RootIntlProvider passe des messages explicites, sans comparatif ni onboardings`, async () => {
        requestLocale.value = locale;
        const { RootIntlProvider } = await inHouse(house);
        const el = (await RootIntlProvider({ children: null })) as Provided;
        expect(el.props.messages).toBeDefined();
        expect(Object.keys(el.props.messages!)).not.toContain("onboardings");
        expect(Object.keys(el.props.messages!)).not.toContain("comparatif");
        expect(Object.keys(el.props.messages!)).toContain("common");
        expect(JSON.stringify(el.props.messages)).not.toMatch(PITCH);
      });
    }
  }
  for (const [route, own, other] of [
    ["onboardings", "onboardings", "comparatif"],
    ["comparatif", "comparatif", "onboardings"],
  ] as const) {
    it(`day1 /${route} : la vue est enveloppée d'un fournisseur qui porte ${own}, pas ${other}`, async () => {
      await inHouse("day1");
      const page =
        route === "comparatif"
          ? await import("@/app/(dashboard)/comparatif/page")
          : await import("@/app/(dashboard)/onboardings/page");
      const view =
        route === "comparatif"
          ? (await import("@/app/(dashboard)/comparatif/comparatif-view")).default
          : (await import("@/app/(dashboard)/onboardings/onboardings-view")).default;
      const { InternalPageIntlProvider } = await import("@/i18n/intl-providers");
      const el = (page.default as () => unknown)() as Provided;
      expect(el.type).toBe(InternalPageIntlProvider);
      expect(el.props.namespaces).toEqual([own]);
      expect((el.props.children as { type?: unknown }).type).toBe(view);
      const provided = (await InternalPageIntlProvider(el.props as Parameters<typeof InternalPageIntlProvider>[0])) as Provided;
      expect(Object.keys(provided.props.messages!)).toContain(own);
      expect(Object.keys(provided.props.messages!)).toContain("common");
      expect(Object.keys(provided.props.messages!)).not.toContain(other);
    });
  }
});

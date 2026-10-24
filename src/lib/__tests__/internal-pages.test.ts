/**
 * Pages internes From Day 1 (`internal` dans nav.ts : /comparatif, /onboardings) et
 * maisons. /onboardings contient le pitch de Day 1 À PROPOS d'Universal : dans la maison
 * universal, ces pages n'existent pas (404 de Next), aucune liste (navigation, palette,
 * Réglages → Modules) ne les cite, et leurs textes ne partent pas vers le navigateur.
 * Dans la maison day1, rien ne change.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isRouteAllowedForTenant,
  navCatalogForPersona,
  navForPersona,
  sectionsForTenant,
} from "@/lib/nav";
import { getMessages, internalPageMessages, rootClientMessages } from "@/messages";
import { TENANTS, type TenantId } from "@/lib/tenant";

/* Les fournisseurs next-intl lisent la langue de la requête (`getLocale`, next-intl/server) :
   hors serveur Next, on la fixe. Rien d'autre n'est simulé. */
const requestLocale = vi.hoisted(() => ({ value: "fr" as "fr" | "en" }));
vi.mock("next-intl/server", () => ({ getLocale: async () => requestLocale.value }));

/** Les marqueurs du pitch interne : le texte À PROPOS d'Universal (fr, en) et le nom du contact. */
const PITCH = /Universal détient la donnée|Universal holds the data|Bertil/;

const flat = (sections: ReturnType<typeof navForPersona>) => sections.flatMap((s) => s.items.map((i) => i.href));

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
      for (const k of Object.keys(universal)) expect(universal[k], k).toBe(day1[k]);
      expect(JSON.stringify(universal)).not.toMatch(/Universal détient la donnée|Universal owns the data/);
    });
  }
});

/* La garde vit dans la page serveur (doc Next 16 : `notFound()` appelé dans la page,
   functions/not-found.md) ; la maison est lue au chargement du module : on recharge par maison. */
describe("garde des pages internes : 404 de Next dans la maison universal, la vue dans la maison day1", () => {
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

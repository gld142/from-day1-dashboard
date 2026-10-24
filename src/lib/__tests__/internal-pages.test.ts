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
import { getMessages } from "@/messages";
import { TENANTS, type TenantId } from "@/lib/tenant";

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

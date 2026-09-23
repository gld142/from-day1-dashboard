/**
 * Navigation par persona : défauts de visibilité, parcours structure
 * réordonné, choix utilisateur, filet contre les pages oubliées.
 */
import { describe, expect, it } from "vitest";
import {
  NAV_SECTIONS,
  navCatalogForPersona,
  navForPersona,
  navItemByHref,
} from "@/lib/nav";

const hrefs = (sections: ReturnType<typeof navForPersona>) =>
  sections.map((s) => [s.labelKey, s.items.map((i) => i.href)] as const);

const flat = (sections: ReturnType<typeof navForPersona>) =>
  sections.flatMap((s) => s.items.map((i) => i.href));

describe("navForPersona — structure (label)", () => {
  const nav = navForPersona("label");

  it("suit le parcours structure : rituel → data → finances → business → intelligence → croissance → compte", () => {
    expect(hrefs(nav)).toEqual([
      ["sections.daily", ["/roster", "/pulse"]],
      ["sections.data", ["/streams", "/market", "/revenue", "/audience", "/algo-position"]],
      ["sections.finances", ["/finances", "/valuation", "/calculator"]],
      ["sections.rights", ["/contracts", "/splits", "/rights", "/urssaf"]],
      ["sections.intelligence", ["/audit", "/ar-watch", "/day1-index", "/copilot"]],
      ["sections.growth", ["/fans", "/tour", "/catalog", "/discovery", "/sync"]],
      ["sections.account", ["/import", "/team", "/settings"]],
    ]);
  });

  it("n'affiche ni la section pitch (interne), ni le fractional (retiré)", () => {
    const all = flat(nav);
    expect(nav.map((s) => s.labelKey)).not.toContain("sections.pitch");
    expect(all).not.toContain("/comparatif");
    expect(all).not.toContain("/onboardings");
    expect(all).toContain("/calculator");
    expect(all).not.toContain("/fractional");
  });

  it("un choix utilisateur réactive une page à sa place dans le parcours", () => {
    const withFractional = navForPersona("label", { "/fractional": true });
    const finances = withFractional.find((s) => s.labelKey === "sections.finances");
    // /fractional est interne : même explicitement activé, il n'apparaît pas.
    expect(finances?.items.map((i) => i.href)).toEqual(["/finances", "/valuation", "/calculator"]);
    const withPitch = navForPersona("label", { "/onboardings": true });
    expect(withPitch.find((s) => s.labelKey === "sections.pitch")?.items.map((i) => i.href)).toEqual([
      "/onboardings",
    ]);
  });

  it("une section dont toutes les pages sont masquées disparaît", () => {
    const nav2 = navForPersona("label", {
      "/streams": false,
      "/market": false,
      "/revenue": false,
      "/audience": false,
      "/algo-position": false,
    });
    expect(nav2.map((s) => s.labelKey)).not.toContain("sections.data");
  });

  it("/settings reste visible même si un choix dit le contraire", () => {
    expect(flat(navForPersona("label", { "/settings": false }))).toContain("/settings");
    expect(flat(navForPersona("artist", { "/settings": false }))).toContain("/settings");
  });

  it("le catalogue structure contient toutes les pages accessibles au label, sans perte ni doublon", () => {
    const expected = NAV_SECTIONS.flatMap((s) =>
      s.items.filter((i) => !i.personas || i.personas.includes("label")).map((i) => i.href),
    );
    const catalog = flat(navCatalogForPersona("label"));
    expect([...catalog].sort()).toEqual([...expected].sort());
    expect(new Set(catalog).size).toBe(catalog.length);
  });
});

describe("navForPersona — artiste", () => {
  const nav = navForPersona("artist");

  it("garde l'ordre canonique de NAV_SECTIONS, sans les pages réservées à la structure", () => {
    const expected = NAV_SECTIONS.map(
      (s) =>
        [
          s.labelKey,
          s.items
            .filter((i) => !i.personas || i.personas.includes("artist"))
            .filter((i) => !i.internal && !(i.defaultHidden === "all" || i.defaultHidden?.includes("artist")))
            .map((i) => i.href),
        ] as const,
    ).filter(([, items]) => items.length > 0);
    expect(hrefs(nav)).toEqual(expected);
  });

  it("voit le simulateur mais ni la valorisation (structure) ni le fractional (retiré), jamais la section pitch", () => {
    const all = flat(nav);
    expect(all).toContain("/calculator");
    expect(all).not.toContain("/fractional");
    expect(all).not.toContain("/valuation");
    expect(all).not.toContain("/roster");
    expect(all).not.toContain("/ar-watch");
    expect(nav.map((s) => s.labelKey)).not.toContain("sections.pitch");
  });

  it("un choix utilisateur masque une page", () => {
    expect(flat(navForPersona("artist", { "/sync": false }))).not.toContain("/sync");
  });
});

describe("navItemByHref", () => {
  it("retrouve une page par href, null sinon", () => {
    expect(navItemByHref("/calculator")?.labelKey).toBe("items.calculator");
    expect(navItemByHref("/nulle-part")).toBeNull();
  });

  it("chaque page a une description dans settings.modules.desc (fr et en)", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    for (const locale of ["fr", "en"]) {
      const file = fileURLToPath(new URL(`../../messages/${locale}/settings.json`, import.meta.url));
      const desc = (JSON.parse(readFileSync(file, "utf-8")) as { modules: { desc: Record<string, string> } })
        .modules.desc;
      for (const s of NAV_SECTIONS) {
        for (const i of s.items) {
          const key = i.labelKey.replace(/^items\./, "");
          expect(desc[key], `${locale}: settings.modules.desc.${key}`).toBeTypeOf("string");
        }
      }
    }
  });
});

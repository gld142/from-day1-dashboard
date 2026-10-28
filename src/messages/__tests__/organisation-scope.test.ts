/**
 * Les textes de l'organisation de la maison (namespace de page `organisation`) ne partent
 * jamais avec le fournisseur racine — donc ni sur /connexion, ni sur /inscription, ni sur
 * /acces — et partent avec le dashboard (layout (dashboard), PageIntlProvider), dans les deux
 * maisons.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TENANTS } from "@/lib/tenant";
import { PAGE_SCOPED_NAMESPACES, pageMessages, rootClientMessages } from "@/messages";

const LAYOUT = fileURLToPath(new URL("../../app/(dashboard)/layout.tsx", import.meta.url));
const MARKERS = { fr: ["Pôle Urbain", "Organisation de la maison"], en: ["Urban division", "Label organisation"] } as const;

describe("namespace organisation", () => {
  it("classé page, pas racine", () => {
    expect(PAGE_SCOPED_NAMESPACES).toContain("organisation");
  });
  for (const locale of ["fr", "en"] as const) {
    for (const house of ["day1", "universal"] as const) {
      it(`${locale} · ${house} : absent de la racine, présent dans les messages du dashboard`, () => {
        const root = JSON.stringify(rootClientMessages(locale, TENANTS[house]));
        const dashboard = JSON.stringify(pageMessages(locale, ["organisation"], TENANTS[house]));
        for (const m of MARKERS[locale]) {
          expect(root, m).not.toContain(m); // témoin : la racine ne le porte pas…
          expect(dashboard, m).toContain(m); // … le fournisseur du dashboard, si
        }
      });
    }
  }
  it("le layout (dashboard) enveloppe le dashboard dans PageIntlProvider avec organisation", () => {
    const src = readFileSync(LAYOUT, "utf-8");
    expect(src).toMatch(/<PageIntlProvider namespaces=\{\["organisation"\]\}>/);
  });
});

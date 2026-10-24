/**
 * Fermé par défaut : chaque namespace de messages est CLASSÉ, explicitement.
 * - racine : envoyé par le fournisseur racine (`rootClientMessages`), donc sérialisé dans CHAQUE
 *   page, /connexion et /inscription comprises (publiques, sans porte) ;
 * - page : `PAGE_SCOPED_NAMESPACES` (src/messages/index.ts), envoyé seulement avec la page qui le lit
 *   (`PageIntlProvider`).
 * Mesuré le 24/10/2026 : un namespace ajouté sans y penser partait avec la racine — le pitch
 * interne (onboardings) puis le bloc Believe (welcome) se lisaient dans le HTML de /connexion. Un
 * nouveau namespace fait donc échouer ce test tant que quelqu'un n'a pas décidé de son classement.
 */
import { describe, expect, it } from "vitest";
import { TENANTS } from "@/lib/tenant";
import { PAGE_SCOPED_NAMESPACES, messageNamespaces, rootClientMessages } from "@/messages";

/*
 * Tout nouveau namespace doit être classé : racine (envoyé sur toutes les pages, y compris
 * publiques) ou page (PAGE_SCOPED_NAMESPACES). Ne l'ajouter ICI que s'il peut se lire sur
 * /connexion sans rien révéler (ni pitch, ni partenaire, ni contact, ni artiste exclu).
 */
const ROOT_ALLOWLIST = [
  "common", "nav", "pulse", "streams", "market", "placements", "revenue", "audience", "finances",
  "calculator", "splits", "contracts", "rights", "urssaf", "audit", "valuation", "day1index",
  "copilot", "fans", "tour", "arwatch", "roster", "catalog", "team", "settings", "algoposition",
  "discovery", "sync", "fractional", "importer", "brief", "ask", "fil",
] as const;

const sorted = (xs: Iterable<string>) => [...xs].sort();

describe("namespaces : chacun classé racine OU page, aucun oublié", () => {
  it("les deux listes sont disjointes et sans doublon", () => {
    const page: readonly string[] = PAGE_SCOPED_NAMESPACES;
    expect(ROOT_ALLOWLIST.filter((ns) => page.includes(ns))).toEqual([]);
    expect(new Set(ROOT_ALLOWLIST).size).toBe(ROOT_ALLOWLIST.length);
    expect(new Set(page).size).toBe(page.length);
  });

  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : les namespaces des messages = ROOT_ALLOWLIST ∪ PAGE_SCOPED_NAMESPACES`, () => {
      const all = messageNamespaces(locale);
      expect(all.length).toBeGreaterThan(30); // témoin : la liste lue est bien celle des messages
      expect(sorted(all)).toEqual(sorted([...ROOT_ALLOWLIST, ...PAGE_SCOPED_NAMESPACES]));
    });

    it(`${locale} : la racine de la maison day1 (la plus large) envoie exactement ROOT_ALLOWLIST ; universal, une partie`, () => {
      expect(sorted(Object.keys(rootClientMessages(locale, TENANTS.day1)))).toEqual(sorted(ROOT_ALLOWLIST));
      const allowed: readonly string[] = ROOT_ALLOWLIST;
      for (const ns of Object.keys(rootClientMessages(locale, TENANTS.universal))) expect(allowed, ns).toContain(ns);
    });
  }
});

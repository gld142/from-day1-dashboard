/**
 * Câblage, lu dans le code SOURCE (arbre syntaxique : un commentaire qui cite un nom n'est pas un
 * usage). Les tests de contenu (internal-pages, welcome-scope) vérifient ce que les fournisseurs
 * passent ; ceux-ci, qu'aucun chemin ne les contourne.
 *
 * 1. Fournisseurs next-intl. Rendu sans `messages`, `<NextIntlClientProvider>` hérite de TOUT
 *    `getMessages()` (next-intl 4) : mesuré le 24/10/2026, le pitch interne puis le bloc Believe
 *    se lisaient dans le HTML de /connexion et /inscription (publiques). Seul
 *    src/i18n/intl-providers.tsx le rend, toujours avec des messages explicites ; le layout racine
 *    passe par `RootIntlProvider`.
 * 2. Écran co-brandé. cobrand-screen.tsx est un composant CLIENT : un import de valeur depuis
 *    ./sources embarquerait dans le navigateur la configuration de tous les canaux, dont ceux que
 *    la maison n'ouvre pas (Believe dans la maison universal). La page lui passe le canal résolu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC, codeMentions, moduleRefs, parse, rel, resolveLocal, sourceFiles } from "./source-ast";

describe("fournisseurs next-intl : un seul fichier rend NextIntlClientProvider", () => {
  const LAYOUT = join(SRC, "app/layout.tsx");

  it("app/layout.tsx enveloppe l'app dans <RootIntlProvider> et ne cite jamais NextIntlClientProvider", () => {
    const text = readFileSync(LAYOUT, "utf8");
    expect(text).toMatch(/<RootIntlProvider[\s>]/);
    expect(text).not.toContain("NextIntlClientProvider");
  });

  it("dans src/ (hors tests), NextIntlClientProvider n'apparaît dans le code que dans src/i18n/intl-providers.tsx", () => {
    const files = sourceFiles(SRC);
    expect(files.map(rel)).toContain("src/app/layout.tsx"); // témoin : la recherche couvre app/
    const users = files.filter((f) => codeMentions(parse(f), "NextIntlClientProvider") > 0).map(rel);
    // Témoin inclus : la recherche trouve le fichier qui le rend vraiment.
    expect(users).toEqual(["src/i18n/intl-providers.tsx"]);
  });
});

describe("cobrand-screen.tsx (client) n'importe que des TYPES de ./sources", () => {
  const SCREEN = join(SRC, "components/modules/welcome/cobrand-screen.tsx");
  const SOURCES = join(SRC, "components/modules/welcome/sources.ts");

  it("chaque import, export … from ou import() qui vise sources.ts est `import type`", () => {
    const refs = moduleRefs(parse(SCREEN)).filter(
      (r) => r.specifier !== "<dynamique>" && resolveLocal(r.specifier, SCREEN) === SOURCES,
    );
    expect(refs.length).toBeGreaterThan(0); // témoin : l'import de types est bien trouvé
    expect(refs.filter((r) => !r.typeOnly).map((r) => r.text)).toEqual([]);
    // Un import() dont le chemin n'est pas littéral ne peut pas être jugé : il n'y en a aucun.
    expect(moduleRefs(parse(SCREEN)).filter((r) => r.specifier === "<dynamique>").map((r) => r.text)).toEqual([]);
  });
});

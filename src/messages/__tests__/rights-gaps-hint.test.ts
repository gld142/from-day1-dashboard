/**
 * Le compteur du KPI « Écarts détectés » compte des RELEVÉS (il comptait des
 * périodes agrégées, ce qui ne correspondait plus au montant affiché). Ce test
 * verrouille la formulation dans les deux locales, sans recopier le message :
 *
 *  1. le hint nomme la même unité que `byArtist.gapCount` — la ventilation
 *     juste en dessous du KPI dit « 3 relevés en écart » / « 3 statements in
 *     gap ». Deux libellés qui comptent la même chose doivent la nommer
 *     pareil ; un retour à « période » / « period » fait tomber le test ;
 *  2. le singulier existe et diffère du pluriel. Aucun périmètre de démo ne
 *     produit un seul relevé en écart : la forme `one` n'est jamais rendue à
 *     l'écran, elle n'est prouvée qu'ici.
 *
 * Rendu par `createTranslator` — le moteur ICU de next-intl, celui que la page
 * utilise. La parité des clés fr/en est déjà tenue par parity.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = fileURLToPath(new URL("..", import.meta.url));
const LOCALES = ["fr", "en"] as const;

const translator = (locale: string) =>
  createTranslator({
    locale,
    messages: { rights: JSON.parse(readFileSync(join(MESSAGES_DIR, locale, "rights.json"), "utf-8")) },
    namespace: "rights",
  });

/** Les mots porteurs de sens d'un message rendu (le nombre et les mots outils sautent). */
const mots = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length >= 5);

describe.each(LOCALES)("rights.kpis.gapsHint — %s", (locale) => {
  const t = translator(locale);

  it("nomme la même unité que la ventilation par artiste (des relevés, pas des périodes)", () => {
    const hint = t("kpis.gapsHint", { count: 11 });
    const ventilation = t("byArtist.gapCount", { count: 11 });
    const communs = mots(hint).filter((w) => mots(ventilation).includes(w));
    expect(
      communs,
      `« ${hint} » et « ${ventilation} » comptent la même chose mais ne nomment pas la même unité`,
    ).not.toHaveLength(0);
  });

  it("rend le compte, et distingue le singulier du pluriel", () => {
    const un = t("kpis.gapsHint", { count: 1 });
    const plusieurs = t("kpis.gapsHint", { count: 11 });
    expect(un).toContain("1");
    expect(plusieurs).toContain("11");
    expect(un).not.toBe(plusieurs);
    // La forme `one` n'est pas la forme `other` amputée de son « s ».
    expect(un.replace(/\d+/, "#")).not.toBe(plusieurs.replace(/\d+/, "#"));
  });
});

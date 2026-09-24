import { test, expect, type Browser, type Page } from "@playwright/test";
import { collectConsole, frMessages, ready, seed } from "./helpers";

/**
 * /rights — le KPI « Écarts détectés » doit être RÉCLAMABLE.
 *
 * Il se compte relevé par relevé. Agrégé par (organisme, période), il
 * embarquerait les résidus des artistes normalement payés des cases où un seul
 * est sous-versé : un montant qu'on ne peut réclamer à personne (7 314 € de
 * trop sur les données du 24/09/2026, soit 4,6 % du total). Trois lectures de
 * la même page doivent donc donner le même chiffre :
 *   A. le KPI en vue structure (persona label, aucun zoom) ;
 *   B. la somme des écarts de la ventilation par artiste ;
 *   C. l'écart lu sur la page zoomée de chaque artiste ;
 * et la porte vers /audit doit porter ce même montant.
 *
 * Deux contraintes d'environnement, mesurées, que ce fichier assume :
 *
 *  1. `fmtEur` compacte au-delà de 100 000 € (« 160 k € ») : à l'écran, l'euro
 *     n'est pas lisible et une égalité pourrait tenir par arrondi sans rien
 *     prouver. La notation compacte est donc neutralisée à l'exécution — le
 *     code de la page n'est pas touché, seul le formatage final change. Un
 *     compteur d'appels sert de témoin : tant qu'il est à zéro, le composant
 *     n'a pas tourné DANS le navigateur et la page lue est celle du rendu
 *     serveur (persona par défaut, montants compactés).
 *
 *  2. Ce décalage voulu entre texte serveur et texte client provoque un
 *     mismatch d'hydratation (React #418). Il est produit par la mesure, pas
 *     par le produit : il est toléré ici, et seulement ici. Les erreurs console
 *     restent vérifiées pour tout le reste, MISSING_MESSAGE compris.
 *
 * À lancer sur le build de prod (`E2E_SERVER=prod`, cf. playwright.config.ts) :
 * en mode dev sur ce port, le WebSocket HMR est bloqué et /rights n'est jamais
 * hydratée — le compteur resterait à zéro et le test échouerait sur son témoin.
 */

const rights = frMessages<{
  kpis: { gaps: string; expected: string };
  byArtist: { gap: string };
  doors: { auditValue: string };
}>("rights");

const THEME = "night" as const;
/** Les artistes du roster de démo, dans l'ordre d'affichage de la ventilation. */
const ARTISTES = ["Dadju", "Nono La Grinta", "Kiko"];
/** Compteur d'appels au formateur, posé par le patch — témoin d'hydratation. */
const COMPTEUR = "__intlPatchCalls";

type Ouverte = { page: Page; erreurs: string[]; fermer: () => Promise<void> };

/**
 * Ouvre /rights dans un contexte navigateur NEUF : `localStorage` n'est partagé
 * qu'à l'intérieur d'un contexte, et `seed` n'écrit le rôle qu'une fois par
 * onglet — deux personas dans le même contexte se marcheraient dessus.
 */
async function ouvrir(
  browser: Browser,
  persona: "artist" | "label",
  focus: string | null,
): Promise<Ouverte> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((cle) => {
    const w = window as unknown as Record<string, number>;
    w[cle] = 0;
    const Origine = Intl.NumberFormat;
    const patch = function (locale?: string | string[], opts?: Intl.NumberFormatOptions) {
      const o = { ...(opts ?? {}) };
      if (o.notation === "compact") {
        o.notation = "standard";
        o.maximumFractionDigits = 0;
      }
      w[cle] += 1;
      return new Origine(locale, o);
    } as unknown as typeof Intl.NumberFormat;
    patch.supportedLocalesOf = Origine.supportedLocalesOf.bind(Origine);
    Object.defineProperty(patch, "prototype", { value: Origine.prototype });
    Intl.NumberFormat = patch;
  }, COMPTEUR);
  const erreurs = collectConsole(page);
  await seed(page, THEME, persona, focus);
  await page.goto("/rights");
  await ready(page, THEME);
  // Témoin : le composant a-t-il tourné dans le navigateur ?
  await page.waitForFunction(
    (cle) => ((window as unknown as Record<string, number>)[cle] ?? 0) > 0,
    COMPTEUR,
    { timeout: 60_000 },
  );
  return { page, erreurs, fermer: () => context.close() };
}

/** Le point affilié dont le libellé est `label`, rendu sur une ligne. */
async function point(page: Page, label: string): Promise<string> {
  const bloc = page.locator("div", { has: page.locator(`span:text-is("${label}")`) }).last();
  return (await bloc.innerText()).split("\n").map((l) => l.trim()).filter(Boolean)[0];
}

/** « 160 002 € » → 160002. Échoue si le montant est resté compacté. */
function euros(texte: string, quoi: string): number {
  expect(
    texte,
    `${quoi} : montant encore compacté (« ${texte} ») — le patch d'Intl n'a pas pris`,
  ).not.toMatch(/\d\s*[kKmM]/);
  const n = Number(texte.replace(/[^\d]/g, ""));
  expect(Number.isFinite(n) && n > 0, `${quoi} : montant illisible (« ${texte} »)`).toBe(true);
  return n;
}

/** Les lignes « Écart » de la ventilation, par artiste. */
async function ventilation(page: Page): Promise<{ nom: string; texte: string }[]> {
  const lignes = (await page.getByTestId("rights-by-artist").innerText())
    .split("\n")
    .map((l) => l.trim());
  return ARTISTES.map((nom) => {
    const i = lignes.indexOf(nom);
    expect(i, `« ${nom} » absent de la ventilation`).toBeGreaterThanOrEqual(0);
    const j = lignes.findIndex((l, k) => k > i && l === rights.byArtist.gap);
    expect(j, `« ${rights.byArtist.gap} » absent après « ${nom} »`).toBeGreaterThan(i);
    return { nom, texte: lignes[j + 1] };
  });
}

/**
 * Erreurs console, hydratation mise à part : le mismatch #418 est provoqué par
 * la neutralisation de la notation compacte, pas par la page.
 */
function erreursReelles(erreurs: string[]): string[] {
  return erreurs.filter((e) => !/React error #41[89]|#425|hydrat/i.test(e));
}

test.describe("/rights — le KPI des écarts est réclamable", () => {
  test("vue structure : KPI = somme de la ventilation = somme des pages zoomées = porte /audit", async ({
    browser,
  }) => {
    const struct = await ouvrir(browser, "label", null);

    // Témoin : sans patch effectif, « Attendu (en cours) » (251 125 €) sortirait
    // en « 251,1 k € » et toute égalité mesurée ensuite ne vaudrait rien.
    euros(await point(struct.page, rights.kpis.expected), "témoin « Attendu (en cours) »");

    // A · le KPI du roster.
    const total = euros(await point(struct.page, rights.kpis.gaps), "KPI « Écarts détectés »");

    // B · la ventilation par artiste.
    const parArtiste = await ventilation(struct.page);
    const sommeVentilation = parArtiste.reduce(
      (s, a) => s + euros(a.texte, `ventilation — ${a.nom}`),
      0,
    );
    expect(sommeVentilation, "la ventilation par artiste ne reconstitue pas le KPI").toBe(total);

    // La porte vers /audit annonce le même montant que le KPI.
    const motif = rights.doors.auditValue.replace("{amount}", "").trim();
    const porte = await struct.page.getByText(new RegExp(motif)).first().innerText();
    expect(euros(porte, "porte /audit"), "la porte vers /audit ne porte pas le montant du KPI").toBe(
      total,
    );

    expect(erreursReelles(struct.erreurs), "erreurs console — vue structure").toEqual([]);
    await struct.fermer();

    // C · chaque artiste sur sa page zoomée : la même chaîne, caractère pour caractère.
    let sommeZooms = 0;
    for (const { nom, texte } of parArtiste) {
      const zoom = await ouvrir(browser, "label", nom.toLowerCase().replace(/\s+/g, "-"));
      const vu = await point(zoom.page, rights.kpis.gaps);
      expect(erreursReelles(zoom.erreurs), `erreurs console — zoom ${nom}`).toEqual([]);
      await zoom.fermer();
      expect(vu, `${nom} : la page zoomée et la ventilation divergent`).toBe(texte);
      sommeZooms += euros(vu, `page zoomée — ${nom}`);
    }
    expect(sommeZooms, "les pages zoomées ne reconstituent pas le KPI").toBe(total);
  });

  test("persona artiste : le KPI ne porte que l'écart de cet artiste", async ({ browser }) => {
    // Référence : le roster et sa ventilation, en vue structure.
    const struct = await ouvrir(browser, "label", null);
    const total = euros(await point(struct.page, rights.kpis.gaps), "KPI du roster");
    const attendus = (await ventilation(struct.page)).map((a) => a.texte);
    await struct.fermer();

    // La page en persona artiste : c'est son seul écart qu'elle montre.
    const solo = await ouvrir(browser, "artist", null);
    const kpi = await point(solo.page, rights.kpis.gaps);
    expect(
      attendus,
      `le KPI en persona artiste (« ${kpi} ») ne correspond à aucun artiste du roster (${attendus.join(", ")})`,
    ).toContain(kpi);
    // Jamais l'agrégat de toute la structure.
    expect(euros(kpi, "KPI en persona artiste")).toBeLessThan(total);
    // Et la ventilation par artiste n'existe pas hors vue structure.
    await expect(solo.page.getByTestId("rights-by-artist")).toHaveCount(0);
    expect(erreursReelles(solo.erreurs), "erreurs console — persona artiste").toEqual([]);
    await solo.fermer();
  });
});

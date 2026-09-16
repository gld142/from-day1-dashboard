import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/**
 * Outils partagés par l'audit visuel (visual-audit) et le parcours de démo
 * (demo-path) : seed thème + persona, collecte des erreurs console, contrôle
 * d'intégrité du texte rendu, débordement horizontal, screenshots.
 */

export const THEMES = ["night", "dawn", "day"] as const;
export type Theme = (typeof THEMES)[number];
export type Persona = "artist" | "label";

export const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

/** Messages fr (source de vérité des libellés cliqués dans le parcours). */
export function frMessages<T = Record<string, unknown>>(ns: string): T {
  const file = path.join(__dirname, "..", "src", "messages", "fr", `${ns}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

/**
 * Seed du thème (next-themes) et du persona (RoleProvider) AVANT tout script
 * de la page. Un `?persona=` dans l'URL prime de toute façon sur le stockage.
 * Le script d'init se rejoue à chaque navigation : le rôle n'est posé qu'une
 * fois par onglet (marqueur sessionStorage) pour que les bascules de persona
 * faites par les clics du parcours survivent aux `goto` suivants.
 */
export async function seed(page: Page, theme: Theme, persona: Persona, focusedArtistId: string | null = null) {
  await page.addInitScript(
    ([t, p, f]) => {
      window.localStorage.setItem("theme", t);
      if (!window.sessionStorage.getItem("e2e-role-seeded")) {
        window.localStorage.setItem(
          "day1-role",
          JSON.stringify({ persona: p, focusedArtistId: f }),
        );
        window.sessionStorage.setItem("e2e-role-seeded", "1");
      }
    },
    [theme, persona, focusedArtistId] as const,
  );
}

/**
 * Erreurs console (type error) + exceptions non catchées. Les messages
 * next-intl `MISSING_MESSAGE` sont des erreurs console : ils tombent dedans.
 */
export function collectConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/**
 * Fait défiler toute la page puis revient en haut : les charts Recharts ne
 * montent leurs barres qu'une fois visibles à l'écran — sans ce passage, un
 * screenshot fullPage montre des axes vides sous la ligne de flottaison
 * (artefact de capture, pas un défaut produit).
 */
export async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(400, window.innerHeight - 100);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
}

/** Attend le h1, le thème appliqué, fait défiler la page, puis laisse charts et animations se poser. */
export async function ready(page: Page, theme: Theme, settle = 900) {
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(
    (t) => document.documentElement.getAttribute("data-theme") === t,
    theme,
    { timeout: 15_000 },
  );
  await scrollThrough(page);
  await page.waitForTimeout(settle);
}

/**
 * Textes qui ressemblent à une clé i18n brute mais sont légitimes
 * (domaines, hôtes). Comparés au texte trimé.
 */
const KEY_ALLOWLIST = new Set(["kworb.net", "app.from-day1.fr"]);

/**
 * Intégrité du texte rendu : aucun « NaN », « undefined », « [object », ni
 * clé i18n brute (`^[a-z]+\.[a-zA-Z.]+$`) dans un nœud texte affiché.
 * Retourne les offenses sous forme « <tag> "texte" ».
 */
export async function textIntegrity(page: Page): Promise<string[]> {
  return page.evaluate((allow) => {
    const offenders: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const keyRe = /^[a-z]+\.[a-zA-Z.]+$/;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const raw = node.textContent ?? "";
      const text = raw.trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript") continue;
      if (el.getClientRects().length === 0) continue;
      const problems: string[] = [];
      if (/\bNaN\b/.test(text)) problems.push("NaN");
      if (/\bundefined\b/.test(text)) problems.push("undefined");
      if (text.includes("[object")) problems.push("[object");
      if (keyRe.test(text) && !allow.includes(text)) problems.push("clé i18n brute");
      if (problems.length) offenders.push(`<${tag}> "${text.slice(0, 80)}" → ${problems.join(", ")}`);
    }
    return offenders;
  }, Array.from(KEY_ALLOWLIST));
}

export async function overflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/** Nom de fichier sûr pour un identifiant d'étape (« /welcome?source=x » → « welcome-source-x »). */
export function slug(s: string): string {
  return s.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Screenshot fullPage : souris hors de la page (pas de tooltip de chart
 * résiduel après un clic) et défilement remis en haut (sinon, en émulation
 * mobile, la topbar sticky est capturée à la position de défilement courante).
 */
export async function shot(page: Page, name: string, fullPage = true) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage });
}

/**
 * Les trois assertions d'intégrité (soft : le test continue, l'échec est
 * consigné) — erreurs console, débordement horizontal, texte rendu.
 */
export async function assertIntegrity(page: Page, label: string, consoleErrors: string[]) {
  const o = await overflow(page);
  const text = await textIntegrity(page);
  expect
    .soft(consoleErrors, `Erreurs console — ${label} :\n${consoleErrors.join("\n")}`)
    .toEqual([]);
  expect
    .soft(
      consoleErrors.filter((e) => e.includes("MISSING_MESSAGE")),
      `MISSING_MESSAGE — ${label}`,
    )
    .toEqual([]);
  expect
    .soft(
      o.scrollWidth,
      `Débordement horizontal — ${label} : scrollWidth=${o.scrollWidth} > clientWidth=${o.clientWidth}`,
    )
    .toBeLessThanOrEqual(o.clientWidth + 1);
  expect.soft(text, `Texte suspect — ${label} :\n${text.join("\n")}`).toEqual([]);
}

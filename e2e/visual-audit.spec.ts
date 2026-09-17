import { test } from "@playwright/test";
import {
  THEMES,
  assertIntegrity,
  collectConsole,
  ready,
  seed,
  shot,
  slug,
  type Persona,
} from "./helpers";

/**
 * Audit visuel automatisé : 31 routes × 3 thèmes (persona label), plus les
 * 6 pages du parcours de démo en persona artiste. Desktop 1440×900.
 * Pour chaque combinaison :
 *  - seed localStorage (thème + rôle) AVANT le goto (addInitScript),
 *  - attend le h1 visible et le thème appliqué,
 *  - échoue s'il y a une erreur console (pas les warnings), une exception
 *    non catchée, un MISSING_MESSAGE, un débordement horizontal, ou un texte
 *    rendu suspect (NaN, undefined, [object, clé i18n brute),
 *  - screenshot fullPage dans e2e/screenshots/<route>[-<persona>]-<theme>.png.
 */

const ROUTES = [
  "pulse",
  "overview",
  "roster",
  "streams",
  "market",
  "revenue",
  "audience",
  "algo-position",
  "finances",
  "calculator",
  "valuation",
  "fractional",
  "splits",
  "contracts",
  "rights",
  "urssaf",
  "audit",
  "day1-index",
  "copilot",
  "ar-watch",
  "fans",
  "discovery",
  "sync",
  "tour",
  "catalog",
  "team",
  "comparatif",
  "onboardings",
  "settings",
  // Écrans co-brandés (hors shell dashboard : pas de sidebar / topbar).
  "welcome?source=universal",
  "welcome?source=believe",
] as const;

/** Pages du parcours de démo : couvertes aussi en persona artiste. */
const ARTIST_ROUTES = ["pulse", "revenue", "streams", "market", "audit", "roster"] as const;

function audit(route: string, persona: Persona) {
  const withPersona = route.includes("?") ? `${route}&persona=${persona}` : `${route}?persona=${persona}`;
  const name = persona === "label" ? slug(route) : `${slug(route)}-${persona}`;
  test.describe(`/${route} (${persona})`, () => {
    for (const theme of THEMES) {
      test(`theme ${theme} — console, débordement, texte, screenshot`, async ({ page }) => {
        const consoleErrors = collectConsole(page);
        await seed(page, theme, persona);
        await page.goto(`/${withPersona}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await ready(page, theme);
        await shot(page, `${name}-${theme}`);
        await assertIntegrity(page, `/${withPersona} (${theme})`, consoleErrors);
      });
    }
  });
}

for (const route of ROUTES) audit(route, "label");
for (const route of ARTIST_ROUTES) audit(route, "artist");

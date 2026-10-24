import { test } from "@playwright/test";
import { isRouteAllowedForTenant } from "../src/lib/nav";
import { TENANT } from "../src/lib/tenant";
import {
  THEMES,
  assertIntegrity,
  collectConsole,
  passerLaPorte,
  ready,
  seed,
  shot,
  slug,
  type Persona,
} from "./helpers";

/**
 * Audit visuel automatisé : les routes ci-dessous × 3 thèmes (persona label), plus
 * les 6 pages du parcours de démo en persona artiste. Desktop 1440×900. Seules les
 * routes OUVERTES dans la maison du test (`TENANT`, NEXT_PUBLIC_TENANT du processus,
 * transmise au serveur lancé par Playwright) sont auditées ; les autres sont
 * déclarées « skip » avec leur raison (voir `openInHouse`).
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
  "fil",
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

/**
 * La route existe-t-elle telle quelle dans la maison du test ? Une page interne From Day 1 fermée
 * (`isRouteAllowedForTenant`) répond 404 ; un canal /welcome hors `tenant.welcomeSources` retombe
 * sur le canal par défaut de la maison. Les auditer capturerait une 404, ou un autre canal, sous
 * un nom trompeur (« onboardings-night.png », « welcome-source-believe-night.png »).
 */
function openInHouse(route: string): boolean {
  const url = new URL(`/${route}`, "http://e2e.invalid");
  if (!isRouteAllowedForTenant(url.pathname, TENANT)) return false;
  const source = url.searchParams.get("source");
  const sources: readonly string[] = TENANT.welcomeSources;
  return url.pathname !== "/welcome" || source === null || sources.includes(source);
}

/* La porte à mot de passe (d1_gate) avant chaque test : sans elle, le proxy renvoie sur /acces. */
test.beforeEach(async ({ context, baseURL }) => passerLaPorte(context, baseURL!));

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

for (const [routes, persona] of [[ROUTES, "label"], [ARTIST_ROUTES, "artist"]] as const) {
  for (const route of routes) {
    if (openInHouse(route)) audit(route, persona);
    else test.skip(`/${route} (${persona}) — fermée dans la maison ${TENANT.id}`, () => {});
  }
}

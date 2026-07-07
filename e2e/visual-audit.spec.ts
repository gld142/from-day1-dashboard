import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

/**
 * Audit visuel automatisé : 28 routes × 3 thèmes, persona label.
 * Pour chaque combinaison :
 *  - seed localStorage (thème + rôle) AVANT le goto (addInitScript),
 *  - attend le h1 visible (Next 16 compile à la demande),
 *  - échoue s'il y a une erreur console (pas les warnings) ou une
 *    exception non catchée (pageerror),
 *  - échoue en cas de débordement horizontal,
 *  - screenshot fullPage dans e2e/screenshots/<route>-<theme>.png.
 */

const ROUTES = [
  "pulse",
  "overview",
  "roster",
  "streams",
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
] as const;

const THEMES = ["night", "dawn", "day"] as const;

const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

for (const route of ROUTES) {
  test.describe(`/${route}`, () => {
    for (const theme of THEMES) {
      test(`theme ${theme} — pas d'erreur console, pas de débordement, screenshot`, async ({
        page,
      }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text());
          }
        });
        page.on("pageerror", (err) => {
          consoleErrors.push(`pageerror: ${err.message}`);
        });

        // Thème + persona label seedés avant tout script de la page.
        await page.addInitScript(
          ([t]) => {
            window.localStorage.setItem("theme", t);
            window.localStorage.setItem(
              "day1-role",
              JSON.stringify({ persona: "label", focusedArtistId: null }),
            );
          },
          [theme] as const,
        );

        await page.goto(`/${route}`, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });

        // La page est prête quand le h1 est visible…
        await expect(page.locator("h1").first()).toBeVisible({
          timeout: 60_000,
        });
        // …et que next-themes a bien appliqué le thème demandé.
        await page.waitForFunction(
          (t) => document.documentElement.getAttribute("data-theme") === t,
          theme,
          { timeout: 15_000 },
        );
        // Laisse les charts/animations se poser avant le screenshot.
        await page.waitForTimeout(900);

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${route}-${theme}.png`),
          fullPage: true,
        });

        expect
          .soft(
            consoleErrors,
            `Erreurs console sur /${route} (${theme}) :\n${consoleErrors.join("\n")}`,
          )
          .toEqual([]);
        expect
          .soft(
            overflow.scrollWidth,
            `Débordement horizontal sur /${route} (${theme}) : scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`,
          )
          .toBeLessThanOrEqual(overflow.clientWidth + 1);
      });
    }
  });
}

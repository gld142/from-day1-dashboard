import { test, expect, type Page } from "@playwright/test";
import {
  THEMES,
  assertIntegrity,
  collectConsole,
  frMessages,
  ready,
  seed,
  shot,
  type Theme,
} from "./helpers";

/**
 * Parcours de démo Universal (vendredi 19/09), cliqué comme en salle :
 *  /welcome?source=universal → CTA → /roster (label) → /pulse (roster) →
 *  clic Dadju (top movers) → /pulse (Dadju) → /streams → /revenue?period=day
 *  (tuile « Hier » cernée, onglets de période, panneau « part » et ses 3
 *  onglets, tableau par plateforme) → /audit → bascule persona artiste
 *  (topbar) → /pulse (artiste Dadju) → retour structure → /roster → clic Kiko
 *  → /pulse (Kiko). Plus /onboardings et /welcome?source=believe.
 *
 * 3 thèmes × 2 viewports (desktop 1440×900, mobile 390×844). À chaque étape :
 * screenshot + intégrité (console, MISSING_MESSAGE, débordement, texte).
 * Le persona de départ est « artiste » : le CTA du canal doit imposer
 * « structure » lui-même.
 */

const welcome = frMessages<{ cta: string }>("welcome");
const pulse = frMessages<{ backToRoster: string }>("pulse");
const common = frMessages<{ roles: { artist: string; label: string; switchTo: string } }>("common");
const revenue = frMessages<{
  estimate: { period: Record<string, string> };
  shares: { tabs: Record<string, string> };
}>("revenue");

const LABEL_NAME = "Day 1 Dashboard Pro";
/** La topbar (le PageHeader est aussi un <header>). */
const topbar = (page: Page) => page.locator("header.sticky");
const switchTo = (role: string) => common.roles.switchTo.replace("{role}", role);

/** Ouvre le sélecteur d'identité de la topbar et choisit un persona. */
async function switchPersona(page: Page, role: "artist" | "label") {
  await topbar(page)
    .getByRole("button")
    .filter({ hasText: new RegExp(`${LABEL_NAME}|Dadju|Kiko|Nono`) })
    .first()
    .click();
  await page.getByRole("menuitem", { name: switchTo(common.roles[role]) }).click();
  await expect(page.getByRole("menuitem")).toHaveCount(0);
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`parcours de démo — ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });

    for (const theme of THEMES) {
      test(`theme ${theme}`, async ({ page }) => {
        test.setTimeout(240_000);
        const errors = collectConsole(page);
        const prefix = `demo-${vp.name}-${theme}`;
        let n = 0;
        const step = async (name: string) => {
          n += 1;
          const label = `${prefix} — ${n}. ${name}`;
          await shot(page, `${prefix}-${String(n).padStart(2, "0")}-${name}`);
          // Seules les erreurs apparues depuis l'étape précédente sont imputées à celle-ci.
          await assertIntegrity(page, label, errors.splice(0));
        };

        /* 1. Écran co-brandé Universal, persona artiste au départ. */
        await seed(page, theme, "artist");
        await page.goto("/welcome?source=universal", { waitUntil: "domcontentloaded", timeout: 90_000 });
        await ready(page, theme);
        await step("welcome-universal");

        /* 2. CTA → /roster en vue structure. */
        await page.getByRole("link", { name: welcome.cta }).click();
        await page.waitForURL(/\/roster/);
        await ready(page, theme);
        await expect(topbar(page)).toContainText(LABEL_NAME);
        await expect(page.locator("main")).toContainText("Dadju");
        await step("roster-label");

        /* 3. /pulse vue roster (persona mémorisé). */
        await page.goto("/pulse", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await step("pulse-roster");

        /* 4. Clic Dadju dans les top movers → Pulse Dadju. */
        await page.locator("main").getByRole("button", { name: /Dadju/ }).first().click();
        await expect(page.getByRole("button", { name: pulse.backToRoster })).toBeVisible();
        await page.waitForTimeout(900);
        await step("pulse-dadju");

        /* 5. /streams (Dadju). */
        await page.goto("/streams", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await step("streams-dadju");

        /* 6. /revenue?period=day : tuile « Hier » cernée, panneau part, tableau. */
        await page.goto("/revenue?period=day", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await expect(page.locator('[data-period="day"][aria-current]')).toBeVisible();
        await step("revenue-day");

        /* 6b. Onglet « 30 jours » → l'URL suit, la tuile « 30 jours » est cernée. */
        await page.getByRole("tab", { name: revenue.estimate.period.month }).click();
        await page.waitForURL(/period=month/);
        await expect(page.locator('[data-period="month"][aria-current]')).toBeVisible();
        await page.waitForTimeout(500);
        await step("revenue-month");

        /* 6c. Panneau « part » : onglets importer / demander au label. */
        await page.getByRole("tab", { name: revenue.shares.tabs.upload }).click();
        await page.waitForTimeout(300);
        await step("shares-upload");
        await page.getByRole("tab", { name: revenue.shares.tabs.request }).click();
        await expect(page.getByRole("textbox")).toBeVisible();
        await page.waitForTimeout(300);
        await step("shares-request");
        await page.getByRole("tab", { name: revenue.shares.tabs.percent }).click();

        /* 7. /audit (Dadju). */
        await page.goto("/audit", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await step("audit-dadju");

        /* 8. Bascule persona → vue artiste (topbar), Pulse artiste Dadju. */
        await switchPersona(page, "artist");
        await expect(topbar(page)).toContainText("Dadju");
        await page.goto("/pulse", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await expect(topbar(page)).not.toContainText(LABEL_NAME);
        await step("pulse-artist-dadju");

        /* 9. Retour structure → /roster → clic Kiko → /pulse (Kiko). */
        await switchPersona(page, "label");
        await page.goto("/roster", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await page.locator("main tr", { hasText: "Kiko" }).first().click();
        await expect(page.locator("main tr[aria-selected='true']")).toContainText("Kiko");
        await page.waitForTimeout(400);
        await step("roster-kiko");
        await page.goto("/pulse", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await expect(topbar(page)).toContainText("Kiko");
        await step("pulse-kiko");

        /* 10. Onboardings partenaires (carte Universal). */
        await page.goto("/onboardings", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await step("onboardings");

        /* 11. Écran co-brandé Believe. */
        await page.goto("/welcome?source=believe", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await step("welcome-believe");
      });
    }
  });
}

/* ───────────── Contrôles ponctuels ───────────── */

test.describe("Pulse à 1280 px — rangée de KPIs", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const persona of ["label", "artist"] as const) {
    test(`persona ${persona} zoomé Dadju`, async ({ page }) => {
      const errors = collectConsole(page);
      const theme: Theme = "night";
      await seed(page, theme, persona, "dadju");
      await page.goto("/pulse", { waitUntil: "domcontentloaded" });
      await ready(page, theme);
      await shot(page, `pulse-1280-${persona}-dadju`);
      await assertIntegrity(page, `/pulse 1280 (${persona})`, errors);
    });
  }
});

test.describe("Parité EN (spot-check)", () => {
  test.use({ locale: "en-US" });
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "day1-locale", value: "en", url: baseURL! }]);
  });

  const PAGES = [
    { name: "revenue-label-dadju", url: "/revenue?period=day", persona: "label", focus: "dadju" },
    { name: "revenue-artist", url: "/revenue?period=day", persona: "artist", focus: null },
    { name: "welcome-universal", url: "/welcome?source=universal", persona: "artist", focus: null },
  ] as const;

  for (const p of PAGES) {
    test(p.name, async ({ page }) => {
      const errors = collectConsole(page);
      const theme: Theme = "night";
      await seed(page, theme, p.persona, p.focus);
      await page.goto(p.url, { waitUntil: "domcontentloaded" });
      await ready(page, theme);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await shot(page, `en-${p.name}-${theme}`);
      await assertIntegrity(page, `EN ${p.url}`, errors);
    });
  }
});

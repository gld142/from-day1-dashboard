import { defineConfig, devices } from "@playwright/test";

/**
 * QA visuelle automatisée — routes × 3 thèmes × personas (visual-audit) et
 * parcours de démo cliqué (demo-path). Le serveur tourne sur le port 3100
 * pour ne pas entrer en conflit avec un dev server local sur 3000.
 *
 * Deux modes de serveur :
 *  - défaut : `npm run dev` (compile à la demande : timeouts généreux) ;
 *  - `E2E_SERVER=prod` : `next start` sur un build de prod préalable
 *    (`NEXT_DIST_DIR=.next-e2e npm run build`). Le dev server meurt après de
 *    longues sessions HMR ; le build de prod est la référence pour l'audit.
 *    Un serveur déjà lancé sur 3100 est réutilisé dans ce mode.
 */
const PORT = 3100;
const prod = process.env.E2E_SERVER === "prod";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: prod ? `npx next start -p ${PORT}` : "npm run dev",
    port: PORT,
    reuseExistingServer: prod,
    timeout: 240_000,
    // NEXT_DIST_DIR : distDir dédié (.next-e2e) — Next 16 verrouille le
    // distDir par instance de `next dev`, ce qui empêcherait le serveur de
    // test de démarrer si un dev server tourne déjà sur .next (port 3000).
    // Les specs e2e testent la DÉMO : elle est éteinte par défaut dans le produit
    // (src/lib/demo-mode.ts). Elles passent la porte à mot de passe du 25/09
    // (cookie d1_gate) via `passerLaPorte` (e2e/helpers.ts), qui lit
    // E2E_GATE_PASSWORD (le mot de passe de /acces) ou E2E_GATE_COOKIE (la
    // valeur du cookie). Sans l'une des deux, chaque spec échoue avec un message
    // explicite. Lancer :
    //   E2E_GATE_PASSWORD=… E2E_SERVER=prod NEXT_DIST_DIR=.next-e2e npx playwright test
    env: { PORT: String(PORT), NEXT_DIST_DIR: ".next-e2e", DEMO_MODE: "on" },
  },
});

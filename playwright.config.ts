import { defineConfig, devices } from "@playwright/test";

/**
 * QA visuelle automatisée — 28 routes × 3 thèmes (persona label).
 * Le serveur dev tourne sur le port 3100 pour ne pas entrer en conflit
 * avec un dev server local sur 3000. Next 16 compile à la demande :
 * timeouts généreux.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1280, height: 800 },
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 3100,
    reuseExistingServer: false,
    timeout: 240_000,
    // NEXT_DIST_DIR : distDir dédié (.next-e2e) — Next 16 verrouille le
    // distDir par instance de `next dev`, ce qui empêcherait le serveur de
    // test de démarrer si un dev server tourne déjà sur .next (port 3000).
    env: { PORT: "3100", NEXT_DIST_DIR: ".next-e2e" },
  },
});

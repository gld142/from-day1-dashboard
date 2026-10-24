import type { FullConfig } from "@playwright/test";
import { cookiePorte, verifierPorte } from "./porte";

/**
 * Vérifie la porte une fois pour toutes les specs. Playwright lance le `webServer` AVANT
 * le globalSetup (tâches « plugin setup » puis globalSetup, playwright 1.61 :
 * runner/index.js, createGlobalSetupTasks) : le serveur est donc déjà prêt ici, y compris
 * en `E2E_SERVER=prod`.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("Playwright : baseURL absente de la configuration.");
  await verifierPorte(baseURL, await cookiePorte());
}

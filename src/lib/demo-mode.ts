/**
 * La démo (données fictives derrière le mot de passe /acces) est ÉTEINTE par
 * défaut dans le produit : un client, ou tout visiteur, ne doit jamais tomber
 * sur du fictif. Décidé avec Gaël le 28/09/2026 — la démo de présentation vit
 * à part, figée (branche `demo`, voir AGENTS.md).
 *
 * `DEMO_MODE=on` la rallume (en local, pour travailler sur la démo).
 */
export function demoEnabled(): boolean {
  return process.env.DEMO_MODE === "on";
}

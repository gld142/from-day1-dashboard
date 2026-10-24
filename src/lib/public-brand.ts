import { TENANT, type Tenant } from "@/lib/tenant";

/** Échappe le texte pour le HTML brut (contenu ET valeur d'attribut entre guillemets doubles). */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Couleur de pastille par défaut (cartouche noir, texte blanc) si celle de la maison est invalide. */
const PILL_BG = "#000000";
const PILL_FG = "#ffffff";

/**
 * Garde pour une couleur interpolée dans un `style=` : seul un `#hex` valide en
 * CSS (3, 4, 6 ou 8 chiffres) passe, sinon le repli. Évite qu'une valeur de config casse
 * l'attribut ou injecte une autre propriété CSS.
 */
export function safeColor(value: string, fallback: string): string {
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : fallback;
}

/**
 * Titre de la porte /acces — texte brut, à échapper par l'appelant.
 * Elle garde la marque courte de la maison (« From Day 1 — Accès » côté
 * Day 1, inchangé).
 */
export function gateTitleText(tenant: Tenant = TENANT): string {
  return `${tenant.shortName} — Accès`;
}

/**
 * La pastille de co-marque en HTML brut, pour la porte /acces (route handler
 * sans React). Même rendu que celle de la sidebar : fond et texte de
 * `tenant.logo`. Chaîne vide quand la maison n'a pas de co-marque.
 * Le liseré intérieur rend le cartouche noir visible sur le fond sombre.
 */
export function coBrandPillHtml(tenant: Tenant = TENANT): string {
  if (!tenant.logo) return "";
  const { text } = tenant.logo;
  const bg = safeColor(tenant.logo.bg, PILL_BG);
  const fg = safeColor(tenant.logo.fg, PILL_FG);
  return `<span class="pill" style="background:${bg};color:${fg};box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)" title="${esc(`Co-marque ${text}`)}">${esc(text)}</span>`;
}

/** Bloc de marque de la porte : nom public de la maison, puis la pastille si co-marque. */
export function gateBrandHtml(tenant: Tenant = TENANT): string {
  return `<h1>${esc(tenant.publicName)}${coBrandPillHtml(tenant)}</h1>`;
}

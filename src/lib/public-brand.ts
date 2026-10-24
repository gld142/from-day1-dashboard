import { TENANT, type Tenant } from "@/lib/tenant";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Titre de la porte /acces. Elle garde la marque courte de la maison
 * (« From Day 1 — Accès » côté Day 1, inchangé), pas la marque des pages publiques.
 */
export function gateTitle(tenant: Tenant = TENANT): string {
  return `${tenant.shortName} — Accès`;
}

/**
 * La pastille de co-marque en HTML brut, pour la porte /acces (route handler
 * sans React). Même rendu que celle de la sidebar : fond et texte de
 * `tenant.logo`. Chaîne vide quand la maison n'a pas de co-marque.
 */
export function coBrandPillHtml(tenant: Tenant = TENANT): string {
  if (!tenant.logo) return "";
  const { text, bg, fg } = tenant.logo;
  return `<span class="pill" style="background:${esc(bg)};color:${esc(fg)}" title="${esc(`Co-marque ${text}`)}">${esc(text)}</span>`;
}

/** Bloc de marque de la porte : nom public de la maison, puis la pastille si co-marque. */
export function gateBrandHtml(tenant: Tenant = TENANT): string {
  return `<h1>${esc(tenant.publicName)}${coBrandPillHtml(tenant)}</h1>`;
}

/**
 * Les routes des pages internes From Day 1 (`internal: true` dans nav.ts : /comparatif,
 * /onboardings — dont le pitch de Day 1 À PROPOS d'Universal) et la règle qui les ferme dans une
 * maison sans pages internes (`tenant.internalPages`).
 *
 * Module LÉGER, sans import de valeur : le proxy (src/proxy.ts) le lit avant CHAQUE requête, et son
 * bundle embarque tout ce qu'il importe. Mesuré le 24/10/2026 (build day1 de acf3754) : quand la
 * liste était dérivée de nav.ts (icônes lucide-react), `lucide-react/dist/esm/Icon.mjs` se lisait
 * dans le chunk du proxy. La liste est donc écrite ICI ; internal-pages.test.ts garantit qu'elle
 * est exactement celle des items `internal` de nav.ts (dans les deux sens), internal-routes.test.ts
 * que le proxy n'importe ni nav.ts ni lucide-react.
 */
import type { Tenant } from "@/lib/tenant";

/** Les routes des pages internes (le proxy les ferme, sous-pages comprises). */
export const INTERNAL_ROUTES: readonly string[] = ["/comparatif", "/onboardings"];

/** Page interne From Day 1, ou une de ses sous-pages ? */
export function isInternalPath(path: string): boolean {
  return INTERNAL_ROUTES.some((href) => path === href || path.startsWith(`${href}/`));
}

/**
 * Où le proxy réécrit une route que la maison n'ouvre pas : un chemin qu'aucune route ne sert, pour
 * que Next rende `app/not-found.tsx` (« handles any unmatched URLs », doc Next 16,
 * file-conventions/not-found.md) avec un VRAI statut 404, hors du segment (dashboard) et de son
 * loading.tsx. Préfixe « _ » : un dossier privé n'est jamais une route (doc, project-structure.md
 * « Private folders ») ; un segment dynamique à la racine de app/ l'attraperait (testé).
 */
export const UNMATCHED_PATH = "/_page-absente";

/**
 * La route existe-t-elle dans cette maison ? Les pages internes From Day 1 n'existent que là où
 * `tenant.internalPages` : ailleurs, le proxy répond 404 avant tout (src/proxy.ts), leur page
 * serveur appelle `notFound()` en seconde ligne, et `sectionsForTenant` (nav.ts) les retire de la
 * navigation, de la palette ⌘K et de Réglages → Modules.
 */
export function isRouteAllowedForTenant(href: string, tenant: Pick<Tenant, "internalPages">): boolean {
  return tenant.internalPages || !isInternalPath(href);
}

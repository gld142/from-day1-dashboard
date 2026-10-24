import { GATE_COOKIE, GATE_PATH, tokenFor } from "../src/lib/gate";

/**
 * Porte à mot de passe de la démo (src/lib/gate.ts, 25/09/2026), côté e2e. Le nom du
 * cookie et la formule du jeton sont IMPORTÉS de src/lib/gate.ts (ils étaient recopiés) :
 * ils ne peuvent plus diverger du proxy. Pas d'import Playwright ici — le fichier est
 * aussi lu par vitest (src/lib/__tests__/e2e-porte.test.ts).
 *   E2E_GATE_COOKIE   : la valeur du cookie telle quelle (prime) ;
 *   E2E_GATE_PASSWORD : le mot de passe de /acces, dont on dérive le cookie.
 * Ni l'un ni l'autre ne sont dans le code : ils viennent de l'environnement.
 */
export { GATE_COOKIE };

/** La valeur du cookie d1_gate, ou une erreur explicite si aucune variable n'est définie. */
export async function cookiePorte(): Promise<string> {
  const value = process.env.E2E_GATE_COOKIE || (process.env.E2E_GATE_PASSWORD ? await tokenFor(process.env.E2E_GATE_PASSWORD) : null);
  if (!value) {
    throw new Error(
      "Porte de la démo : définir E2E_GATE_COOKIE (valeur du cookie d1_gate) ou E2E_GATE_PASSWORD (mot de passe de /acces) " +
        "pour que les specs e2e passent le proxy (src/proxy.ts). Ex. : E2E_GATE_PASSWORD=… E2E_SERVER=prod NEXT_DIST_DIR=.next-e2e npx playwright test",
    );
  }
  return value;
}

/**
 * Une seule requête avant toutes les specs : le dashboard (/pulse) répond-il au cookie ?
 * Sans ce contrôle, un mauvais mot de passe fait échouer chaque spec sur la page /acces,
 * avec des messages qui parlent d'un titre ou d'un bouton introuvable. Le message d'erreur
 * ne contient ni le mot de passe ni le cookie.
 */
export async function verifierPorte(baseURL: string, cookie: string, doFetch: typeof fetch = fetch): Promise<void> {
  const res = await doFetch(new URL("/pulse", baseURL).toString(), {
    headers: { cookie: `${GATE_COOKIE}=${cookie}` },
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) {
    const cible = new URL(res.headers.get("location") ?? "/", baseURL).pathname;
    if (cible === GATE_PATH) {
      throw new Error(
        `Porte de la démo : ${baseURL}/pulse renvoie vers ${GATE_PATH} — le cookie est refusé. ` +
          "Vérifier E2E_GATE_PASSWORD (le mot de passe de /acces) ou E2E_GATE_COOKIE.",
      );
    }
    if (cible === "/connexion" || cible.startsWith("/connexion/")) {
      throw new Error(
        `Démo éteinte : ${baseURL}/pulse renvoie vers /connexion. Le serveur testé doit tourner avec DEMO_MODE=on ` +
          "(c'est le cas du serveur lancé par la config Playwright ; pas forcément d'un serveur déjà ouvert sur :3100 " +
          "et réutilisé, ni d'un E2E_BASE_URL externe).",
      );
    }
    throw new Error(
      `Porte de la démo : ${baseURL}/pulse redirige (HTTP ${res.status}) vers ${cible}, attendu 200 avec le cookie.`,
    );
  }
  if (!res.ok) throw new Error(`Porte de la démo : ${baseURL}/pulse répond HTTP ${res.status} (attendu 200 avec le cookie).`);
}

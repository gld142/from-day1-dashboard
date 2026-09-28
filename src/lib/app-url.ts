/**
 * Adresse publique de l'app, fixée côté serveur (APP_URL). Tous les liens qui
 * sortent de l'app (emails, retours Stripe) partent d'ici, JAMAIS des en-têtes
 * de la requête : un Origin/Host falsifié ferait partir, depuis nos vrais emails,
 * un lien vers un autre site — et son jeton de connexion avec.
 */
export function appUrl(path: string): string {
  const base = process.env.APP_URL;
  if (!base || !/^https?:\/\/[^/]+$/.test(base)) {
    throw new Error("APP_URL manquant ou invalide (ex. https://app.from-day1.com, sans / final)");
  }
  // Un chemin « //ailleurs » changerait de domaine : seuls les chemins absolus simples passent.
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`chemin invalide pour un lien sortant : ${path}`);
  const url = new URL(path, base);
  if (url.origin !== base) throw new Error("lien sortant hors de APP_URL");
  return url.toString();
}

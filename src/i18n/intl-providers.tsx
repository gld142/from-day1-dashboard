import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { pageMessages, rootClientMessages, type PageScopedNamespace } from "@/messages";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * Les fournisseurs next-intl de l'app (la racine, et un fournisseur imbriqué par page qui lit un
 * namespace de page), composants SERVEUR : ce qu'ils passent en `messages` est sérialisé dans le
 * HTML de la page (doc Next 16, server-and-client-components.md : les props d'un composant client
 * partent dans la charge utile RSC).
 *
 * `messages` est TOUJOURS explicite : absent, next-intl 4 (`NextIntlClientProviderServer`) hérite
 * de tout `getMessages()` de la requête. La langue, le fuseau, `now` et les formats restent
 * hérités de i18n/request.ts.
 */

async function requestLocale(): Promise<Locale> {
  const raw = await getLocale();
  return locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;
}

/** Racine (app/layout.tsx), sur TOUTES les pages : aucun namespace de page (PAGE_SCOPED_NAMESPACES). */
export async function RootIntlProvider({ children }: { children: React.ReactNode }) {
  const messages = rootClientMessages(await requestLocale());
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

/**
 * Autour de la vue d'une page qui lit un namespace de page (PAGE_SCOPED_NAMESPACES) : les messages
 * racine + SES namespaces, tels que la maison les reçoit, et rien d'une autre page (un fournisseur
 * imbriqué remplace les messages du parent, il ne les complète pas).
 * - /comparatif, /onboardings (pages internes) : leur namespace, rien dans une maison sans pages
 *   internes ;
 * - /welcome : `welcome` avec les seuls canaux de la maison (`tenant.welcomeSources`).
 */
export async function PageIntlProvider({
  namespaces,
  children,
}: {
  namespaces: readonly PageScopedNamespace[];
  children: React.ReactNode;
}) {
  const messages = pageMessages(await requestLocale(), namespaces);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

import { notFound } from "next/navigation";
import { InternalPageIntlProvider } from "@/i18n/intl-providers";
import { isRouteAllowedForTenant } from "@/lib/nav";
import { TENANT } from "@/lib/tenant";
import OnboardingsView from "./onboardings-view";

/**
 * /onboardings — page interne From Day 1 : le pipeline partenaires, dont le pitch de Day 1
 * À PROPOS d'Universal. Elle n'existe que dans une maison à pages internes (`internalPages`) :
 * ailleurs, le proxy répond déjà 404 (src/proxy.ts). `notFound()` ici est la SECONDE ligne, avant
 * tout rendu de la vue : il rend l'interface 404, mais avec un statut 200 (réponse en flux sous le
 * loading.tsx de (dashboard) : doc Next 16, loading.md « Status Codes »).
 */
export default function OnboardingsPage() {
  if (!isRouteAllowedForTenant("/onboardings", TENANT)) notFound();
  // Ses textes partent avec elle, et seulement avec elle : le fournisseur racine ne les envoie
  // plus (rootClientMessages). La page reste synchrone : `notFound()` est levé avant tout rendu.
  return (
    <InternalPageIntlProvider namespaces={["onboardings"]}>
      <OnboardingsView />
    </InternalPageIntlProvider>
  );
}

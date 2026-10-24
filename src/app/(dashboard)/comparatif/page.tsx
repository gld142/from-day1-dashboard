import { notFound } from "next/navigation";
import { InternalPageIntlProvider } from "@/i18n/intl-providers";
import { isRouteAllowedForTenant } from "@/lib/nav";
import { TENANT } from "@/lib/tenant";
import ComparatifView from "./comparatif-view";

/**
 * /comparatif — page interne From Day 1 : Day 1 face à ses concurrents. Elle n'existe que dans
 * une maison à pages internes (`internalPages`) : ailleurs, le 404 de Next AVANT tout rendu de
 * la vue (doc Next 16, functions/not-found.md : `notFound()` dans la page serveur ; la vue reste
 * un composant client à côté).
 */
export default function ComparatifPage() {
  if (!isRouteAllowedForTenant("/comparatif", TENANT)) notFound();
  // Ses textes partent avec elle, et seulement avec elle : le fournisseur racine ne les envoie
  // plus (rootClientMessages). La page reste synchrone : `notFound()` est levé avant tout rendu.
  return (
    <InternalPageIntlProvider namespaces={["comparatif"]}>
      <ComparatifView />
    </InternalPageIntlProvider>
  );
}

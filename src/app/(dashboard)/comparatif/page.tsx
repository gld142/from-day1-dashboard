import { notFound } from "next/navigation";
import { InternalPageIntlProvider } from "@/i18n/intl-providers";
import { isRouteAllowedForTenant } from "@/lib/internal-routes";
import { TENANT } from "@/lib/tenant";
import ComparatifView from "./comparatif-view";

/**
 * /comparatif — page interne From Day 1 : Day 1 face à ses concurrents. Elle n'existe que dans
 * une maison à pages internes (`internalPages`) : ailleurs, le proxy répond déjà 404
 * (src/proxy.ts). `notFound()` ici est la SECONDE ligne, avant tout rendu de la vue : il rend
 * l'interface 404, mais avec un statut 200 (réponse en flux sous le loading.tsx de (dashboard) :
 * doc Next 16, loading.md « Status Codes »).
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

import { notFound } from "next/navigation";
import { isRouteAllowedForTenant } from "@/lib/nav";
import { TENANT } from "@/lib/tenant";
import OnboardingsView from "./onboardings-view";

/**
 * /onboardings — page interne From Day 1 : le pipeline partenaires, dont le pitch de Day 1
 * À PROPOS d'Universal. Elle n'existe que dans une maison à pages internes (`internalPages`) :
 * ailleurs, le 404 de Next AVANT tout rendu de la vue (doc Next 16, functions/not-found.md :
 * `notFound()` dans la page serveur ; la vue reste un composant client à côté).
 */
export default function OnboardingsPage() {
  if (!isRouteAllowedForTenant("/onboardings", TENANT)) notFound();
  return <OnboardingsView />;
}

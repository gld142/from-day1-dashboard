import type { Metadata } from "next";
import { publicTitle } from "@/lib/tenant";
import { FlowClient } from "./flow-client";

export const metadata: Metadata = {
  title: publicTitle("Ouvre ton espace"),
  robots: { index: false },
};

/** Parcours d'achat : hors du shell dashboard (pas de sidebar), public. */
export default function InscriptionPage() {
  return <FlowClient />;
}

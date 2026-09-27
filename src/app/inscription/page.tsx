import type { Metadata } from "next";
import { FlowClient } from "./flow-client";

export const metadata: Metadata = {
  title: "Day 1 Pro — Ouvre ton espace",
  robots: { index: false },
};

/** Parcours d'achat : hors du shell dashboard (pas de sidebar), public. */
export default function InscriptionPage() {
  return <FlowClient />;
}

import type { Metadata } from "next";
import { CobrandScreen } from "@/components/modules/welcome/cobrand-screen";
import { resolveSource } from "@/components/modules/welcome/sources";
import { ARTISTS, auditFindings } from "@/lib/demo/api";

export const metadata: Metadata = {
  title: "From Day 1 — Bienvenue",
};

/**
 * Écran co-brandé par canal d'acquisition (spec §7).
 * `?source=universal|believe`, sinon canal direct. Hors du shell dashboard
 * (pas de sidebar / topbar) : c'est un écran d'atterrissage.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const source = resolveSource((await searchParams).source);

  // Le « premier insight » cite l'écart d'audit réel du roster — écarts DSP
  // estimé / déclaré uniquement, jamais les écarts label / distributeur.
  const gapEur = ARTISTS.flatMap((a) => auditFindings(a.id))
    .filter((f) => f.source.includes("écart"))
    .reduce((sum, f) => sum + (f.expected - f.reported), 0);

  return <CobrandScreen source={source} gapEur={gapEur} />;
}

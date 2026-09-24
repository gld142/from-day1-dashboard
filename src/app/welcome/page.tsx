import type { Metadata } from "next";
import { CobrandScreen } from "@/components/modules/welcome/cobrand-screen";
import { resolveSource } from "@/components/modules/welcome/sources";
import { ARTISTS, auditFindings } from "@/lib/demo/api";
import { isDspGap } from "@/lib/real/audit-gap";

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

  /* Le « premier insight » cite l'écart d'audit réel du roster — écarts DSP
     estimé / déclaré uniquement, jamais les écarts label / distributeur.
     Le nombre d'artistes concernés et la période sont mesurés eux aussi : les
     phrases annonçaient « sur les 3 artistes du pilote » alors que deux
     seulement portent un écart. */
  const gaps = ARTISTS.flatMap((a) => auditFindings(a.id)).filter(isDspGap);
  const gapEur = gaps.reduce((sum, f) => sum + (f.expected - f.reported), 0);
  const gapArtists = new Set(gaps.map((f) => f.artistId)).size;

  return (
    <CobrandScreen source={source} gapEur={gapEur} gapArtists={gapArtists} />
  );
}

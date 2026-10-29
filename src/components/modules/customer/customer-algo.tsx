"use client";

/**
 * /algo-position en mode client — AUCUN chiffre tant que la source n'est pas
 * branchée. La démo affichait un « score de santé algo », des taux de sauvegarde
 * et de skip tirés au hasard : Spotify ne publie rien de tout ça. Ce qui existe
 * vraiment (part algorithmique / éditoriale, sauvegardes, ajouts en playlist par
 * titre) est dans Spotify for Artists, que l'artiste peut exporter.
 */
import { PageHeader } from "@/components/dashboard/page-header";
import { useCustomer } from "@/lib/customer-mode";
import { Needs } from "./signals-ui";

export function CustomerAlgo() {
  const customer = useCustomer();
  return (
    <div className="rise-in">
      <PageHeader title="Position algo Spotify" subtitle={`${customer?.artistName ?? ""} · en attente de ton export Spotify for Artists`} />
      <div className="space-y-3">
        <Needs family="streams" title="Ce que cette page montrera">
          <p>Pour chaque titre : la part des écoutes venue des playlists algorithmiques (Radio, Découvertes de la semaine…) et éditoriales, les sauvegardes, les ajouts en playlist, et leur évolution d&apos;un export à l&apos;autre.</p>
          <p className="text-muted-foreground">Ces chiffres n&apos;existent que dans Spotify for Artists. Day 1 n&apos;en affichera aucun tant qu&apos;ils ne viennent pas de ton propre compte : pas d&apos;estimation, pas de note inventée.</p>
        </Needs>
        <Needs family="catalog" title="Ce qu'il faut">
          <p>
            <b>Ton export Spotify for Artists</b>{" "}(onglet Musique, puis téléchargement CSV). L&apos;import sera branché dès qu&apos;un vrai fichier aura été vérifié ligne par ligne.
          </p>
        </Needs>
      </div>
    </div>
  );
}

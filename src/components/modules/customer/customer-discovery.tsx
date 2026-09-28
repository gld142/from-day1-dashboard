"use client";

/**
 * /discovery en mode client — AUCUNE note tant que rien n'est mesuré. La démo
 * classait des inédits avec des scores tirés au hasard (« potentiel viral »,
 * « similarité aux hits ») : aucune source ne mesure ça avant la sortie. La
 * version réelle sera un test : l'artiste publie des extraits, Day 1 mesure les
 * réactions sur ses comptes connectés et classe les titres sur ces mesures.
 */
import { PageHeader } from "@/components/dashboard/page-header";
import { useCustomer } from "@/lib/customer-mode";
import { Needs } from "./signals-ui";

export function CustomerDiscovery() {
  const customer = useCustomer();
  return (
    <div className="rise-in">
      <PageHeader title="Discovery Lab" subtitle={`${customer?.artistName ?? ""} · test réel de tes inédits, bientôt`} />
      <div className="space-y-3">
        <Needs family="trends" title="Comment ça marchera">
          <p>1. Tu publies un extrait de chaque inédit (TikTok, YouTube Shorts).</p>
          <p>2. Day 1 relève les vues, les j&apos;aime, les partages et les commentaires de chaque extrait, sur tes comptes connectés, jour après jour.</p>
          <p>3. Les titres sont classés sur ces réactions réelles, à durée de publication égale.</p>
          <p className="text-muted-foreground">Aucune note n&apos;est affichée avant : prédire le succès d&apos;un titre non sorti, sans mesure, serait inventer.</p>
        </Needs>
        <Needs family="catalog" title="Ce qu'il faut">
          <p>
            <b>La connexion de ton compte TikTok</b> (après validation de Day 1 par TikTok : quelques jours à deux semaines selon TikTok) et <b>de ta chaîne YouTube</b>.
          </p>
        </Needs>
      </div>
    </div>
  );
}

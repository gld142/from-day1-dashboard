"use client";

/**
 * « Équipe : DA · chef de projet · marketing · juriste » de l'artiste zoomé, d'après
 * l'organisation de la maison (Réglages → Organisation). Vue structure (démo) seulement.
 */
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { ARTISTS } from "@/lib/demo/data";
import { personName, resolveAssignment } from "@/lib/demo/org";
import { useOrg } from "@/lib/userdata/use-org";

export function ArtistTeamLine({ artistId, className }: { artistId: string; className?: string }) {
  const t = useTranslations("organisation");
  const org = useOrg();
  const artist = ARTISTS.find((a) => a.id === artistId);
  if (!artist) return null;
  const team = resolveAssignment(artist, org);
  const name = (id: string) => personName(org, id) ?? id;
  return (
    <p className={className ?? "text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs"}>
      <Users className="size-3 shrink-0" aria-hidden />
      <span>
        <span className="text-foreground/80 font-medium">{t("team.heading")}</span>{" "}
        {t("team.line", {
          da: name(team.daId),
          projet: name(team.projectLeadId),
          marketing: name(team.marketingId),
          juridique: name(team.legalId),
        })}
      </span>
    </p>
  );
}

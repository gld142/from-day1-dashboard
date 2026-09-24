"use client";

/**
 * /copilot — poser une question, obtenir un chiffre calculé.
 * Refondue le 23/09. Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Le bandeau de quatre « capacités » disparaît. Il annonçait ce que l'outil
 * saurait faire, au-dessus d'un chat dont les suggestions font exactement la
 * même chose — en cliquable. Annoncer une capacité juste au-dessus du bouton
 * qui l'exécute, c'est occuper un quart d'écran pour rien.
 *
 * Pas de feuille teintée ici : la page **est** le chat. Lui poser un héros
 * au-dessus reviendrait à répondre avant qu'on ait demandé.
 */
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";
import { CopilotChat } from "@/components/modules/intelligence/copilot-chat";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { useRole } from "@/lib/role";

export default function CopilotPage() {
  const t = useTranslations("copilot");
  const tc = useTranslations("common");
  const { artistId, focusedArtistId, isLabel, persona } = useRole();

  const isRoster = isLabel && focusedArtistId === null;

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={isRoster ? t("subtitleLabel") : t("subtitle")}
      />

      {/* Re-monté à chaque changement de persona / zoom : le fil doit repartir
          des bonnes données, pas continuer sur celles de l'artiste précédent. */}
      <CopilotChat
        key={`${persona}:${focusedArtistId ?? "all"}`}
        isRoster={isRoster}
        artistId={artistId}
      />

      <Doors
        title={tc("blocks.doors")}
        doors={[
          {
            key: "audit",
            family: "money",
            href: "/audit",
            label: t("doors.audit"),
            value: t("doors.auditValue"),
          },
          {
            key: "revenue",
            family: "money",
            href: "/revenue",
            label: t("doors.revenue"),
            value: t("doors.revenueValue"),
          },
          {
            key: "streams",
            family: "streams",
            href: "/streams",
            label: t("doors.streams"),
            value: t("doors.streamsValue"),
          },
          {
            key: "finances",
            family: "money",
            href: "/finances",
            label: t("doors.finances"),
            value: t("doors.financesValue"),
          },
          {
            key: "audience",
            family: "audience",
            href: "/audience",
            label: t("doors.audience"),
            value: t("doors.audienceValue"),
          },
          {
            key: "calculator",
            family: "money",
            href: "/calculator",
            label: t("doors.calculator"),
            value: t("doors.calculatorValue"),
          },
        ]}
      />
      <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
    </div>
  );
}

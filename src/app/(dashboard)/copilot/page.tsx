"use client";

/**
 * /copilot — Copilot IA.
 * Bandeau de 4 capacités + chat avec échanges pré-écrits interpolés
 * des vraies données démo (chips cliquables, saisie libre).
 */
import { useTranslations } from "next-intl";
import { FileSearch, LineChart, Radar, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { CopilotChat } from "@/components/modules/intelligence/copilot-chat";
import { useRole } from "@/lib/role";

export default function CopilotPage() {
  const t = useTranslations("copilot");
  const { artistId, focusedArtistId, isLabel, persona } = useRole();

  const isRoster = isLabel && focusedArtistId === null;

  const capabilities = [
    { icon: LineChart, title: t("capabilities.analyzeTitle"), desc: t("capabilities.analyzeDesc") },
    { icon: Radar, title: t("capabilities.anomalyTitle"), desc: t("capabilities.anomalyDesc") },
    { icon: FileSearch, title: t("capabilities.auditTitle"), desc: t("capabilities.auditDesc") },
    { icon: TrendingUp, title: t("capabilities.forecastTitle"), desc: t("capabilities.forecastDesc") },
  ];

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ── Bandeau capacités ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((cap, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <cap.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{cap.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {cap.desc}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Chat (re-monté à chaque changement de persona / zoom) ── */}
      <div className="mt-4">
        <CopilotChat
          key={`${persona}:${focusedArtistId ?? "all"}`}
          isRoster={isRoster}
          artistId={artistId}
        />
      </div>
    </div>
  );
}

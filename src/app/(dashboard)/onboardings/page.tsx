"use client";

/**
 * Onboardings partenaires — le pipeline qui doit amener 80 % des
 * inscriptions à M18. Kanban 4 colonnes en state local (démo),
 * fiche détail par partenaire, et la méthode en 5 principes.
 * Contenu pitch (vue label) sans données sensibles : reste affiché
 * si on y accède par URL.
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  FlaskConical,
  Lock,
  Rocket,
  Target,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi";
import {
  PARTNERS,
  PartnerBoard,
  initialStatuses,
  type PartnerId,
  type PartnerStatus,
} from "@/components/modules/pitch/partner-board";

const PRINCIPLES: Array<{ key: string; icon: LucideIcon }> = [
  { key: "activable", icon: Rocket },
  { key: "owner", icon: UserRound },
  { key: "metrics", icon: Target },
  { key: "pilot", icon: FlaskConical },
  { key: "exclusivity", icon: Lock },
];

export default function OnboardingsPage() {
  const t = useTranslations("onboardings");
  const [statuses, setStatuses] = useState<Record<PartnerId, PartnerStatus>>(
    initialStatuses,
  );

  const inDiscussion = useMemo(
    () => PARTNERS.filter((p) => statuses[p.id] === "discussion").length,
    [statuses],
  );
  const pilotsM3 = PARTNERS.filter((p) => p.pilotM3).length;

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ─── KPIs pipeline ─── */}
      <div className="rise-in grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          id="onb-targeted"
          label={t("kpis.targeted")}
          value={PARTNERS.length}
          format="int"
          deltaLabel={t("kpis.targetedHint")}
        />
        <KpiCard
          id="onb-discussion"
          label={t("kpis.inDiscussion")}
          value={inDiscussion}
          format="int"
          deltaLabel={t("kpis.inDiscussionHint")}
        />
        <KpiCard
          id="onb-pilots"
          label={t("kpis.pilots")}
          value={pilotsM3}
          format="int"
          deltaLabel={t("kpis.pilotsHint")}
        />
        <KpiCard
          id="onb-goal"
          label={t("kpis.goal")}
          value={80}
          format="pct"
          deltaLabel={t("kpis.goalHint")}
          hero
        />
      </div>

      {/* ─── Kanban pipeline ─── */}
      <section className="rise-in mt-4">
        <div className="mb-3">
          <h2 className="font-heading text-base font-semibold">
            {t("board.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("board.subtitle")}
          </p>
        </div>
        <PartnerBoard
          statuses={statuses}
          onStatusChange={(id, s) =>
            setStatuses((prev) => ({ ...prev, [id]: s }))
          }
        />
      </section>

      {/* ─── La méthode : 5 principes ─── */}
      <section className="rise-in mt-4 rounded-xl border bg-card p-5">
        <h2 className="font-heading text-base font-semibold">
          {t("method.title")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("method.subtitle")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PRINCIPLES.map(({ key, icon: Icon }, i) => (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-xl border bg-surface-2/60 p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="num text-[10px] font-semibold text-muted-foreground">
                  {i + 1}/5
                </span>
              </div>
              <h3 className="text-[13px] font-semibold leading-tight">
                {t(`method.principles.${key}.title`)}
              </h3>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t(`method.principles.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

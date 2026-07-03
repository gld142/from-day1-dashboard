"use client";

/**
 * /team — gouvernance du workspace : membres, rôles, périmètres d'accès,
 * matrice de permissions et journal d'activité.
 * Persona artiste : vue "qui a accès à MES données" (équipe filtrée).
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityLog } from "@/components/modules/structure/activity-log";
import {
  InviteDialog,
  type PendingInvite,
} from "@/components/modules/structure/invite-dialog";
import { PermissionsMatrix } from "@/components/modules/structure/permissions-matrix";
import { TeamTable } from "@/components/modules/structure/team-table";
import { LABEL, TEAM } from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import { fmtDate } from "@/lib/format";
import { useRole } from "@/lib/role";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export default function TeamPage() {
  const t = useTranslations("team");
  const locale = useLocale();
  const { isLabel, artistId } = useRole();

  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [lastInvited, setLastInvited] = useState<string | null>(null);

  /** Persona artiste : uniquement les membres qui voient SES données. */
  const members = useMemo(
    () =>
      isLabel
        ? TEAM
        : TEAM.filter(
            (m) => m.artistAccess === "all" || m.artistAccess.includes(artistId),
          ),
    [isLabel, artistId],
  );

  const distinctRoles = useMemo(
    () => new Set(members.map((m) => m.role)).size,
    [members],
  );
  const activeWeek = useMemo(
    () =>
      members.filter(
        (m) =>
          DEMO_TODAY.getTime() - new Date(m.lastActive).getTime() <= WEEK_MS,
      ).length,
    [members],
  );
  const lastActivity = useMemo(
    () =>
      members.reduce(
        (max, m) => (m.lastActive > max ? m.lastActive : max),
        members[0]?.lastActive ?? "",
      ),
    [members],
  );

  function handleInvite(invite: PendingInvite) {
    setPending((prev) => [...prev, invite]);
    setLastInvited(invite.email);
  }

  return (
    <div className="rise-in space-y-6">
      <PageHeader
        title={isLabel ? t("title") : t("artistTitle")}
        subtitle={
          isLabel
            ? t("subtitle", { label: LABEL.name })
            : t("artistSubtitle", { label: LABEL.name })
        }
      >
        {isLabel && <InviteDialog onInvite={handleInvite} />}
      </PageHeader>

      {lastInvited && (
        <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-2.5 text-xs text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {t("invite.sent", { email: lastInvited })}
        </p>
      )}

      {/* KPIs équipe */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          id="team-members"
          label={t("kpis.members")}
          value={members.length + pending.length}
          format="int"
          deltaLabel={t("kpis.lastActivity", {
            date: lastActivity ? fmtDate(locale, lastActivity) : "—",
          })}
        />
        <KpiCard
          id="team-roles"
          label={t("kpis.roles")}
          value={distinctRoles}
          format="int"
        />
        <KpiCard
          id="team-active"
          label={t("kpis.activeWeek")}
          value={activeWeek}
          format="int"
          hero
          className="col-span-2 lg:col-span-1"
        />
      </section>

      {/* Tableau des membres */}
      <TeamTable
        members={members}
        pending={isLabel ? pending : []}
        hint={isLabel ? undefined : t("table.artistHint")}
      />

      {/* Matrice permissions + journal */}
      <section className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <PermissionsMatrix />
        </div>
        <div className="xl:col-span-2">
          <ActivityLog />
        </div>
      </section>
    </div>
  );
}

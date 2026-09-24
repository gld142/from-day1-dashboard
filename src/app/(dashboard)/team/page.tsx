"use client";

/**
 * /team — gouvernance du workspace : membres, rôles, périmètres d'accès,
 * matrice de permissions et journal d'activité.
 * Persona artiste : vue "qui a accès à MES données" (équipe filtrée).
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
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
  const tc = useTranslations("common");
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
    <div className="rise-in">
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

      <div className="space-y-3">
      {/* Qui a un accès, et depuis quand. */}
      <Sheet family="catalog">
        <SheetHeading
          action={t("kpis.lastActivity", {
            date: lastActivity ? fmtDate(locale, lastActivity) : "—",
          })}
        >
          {t("hero.title")}
        </SheetHeading>
        <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
          {members.length + pending.length}
        </p>
        <p className="sheet-ink mt-1.5 text-[13px]">
          {/* « 0 actives sur 7 jours » ne dit rien d'utile : quand la fenêtre
              est vide, on donne la date qui, elle, se lit. */}
          {activeWeek > 0
            ? t("hero.caption", { active: activeWeek })
            : t("hero.captionIdle", {
                date: lastActivity ? fmtDate(locale, lastActivity) : "—",
              })}
        </p>
        <AffiliatedPoints
          points={[
            {
              key: "members",
              value: String(members.length),
              label: t("kpis.members"),
            },
            {
              key: "roles",
              value: String(distinctRoles),
              label: t("kpis.roles"),
              note: t("kpis.rolesHint"),
            },
            {
              key: "active",
              value: String(activeWeek),
              label: t("kpis.activeWeek"),
            },
            {
              key: "pending",
              value: String(pending.length),
              label: t("kpis.pending"),
              note: pending.length === 0 ? t("kpis.pendingNone") : undefined,
            },
          ]}
        />
      </Sheet>

      {/* Tableau des membres */}
      <Sheet family="catalog">
        <SheetHeading action={isLabel ? undefined : t("table.artistHint")}>
          {t("table.title")}
        </SheetHeading>
        <TeamTable members={members} pending={isLabel ? pending : []} bare />
      </Sheet>

      {/* Matrice permissions + journal */}
      <div className="grid gap-3 xl:grid-cols-5">
        <Sheet family="catalog" className="xl:col-span-3">
          <SheetHeading action={t("matrix.subtitle")}>{t("matrix.title")}</SheetHeading>
          <PermissionsMatrix bare />
        </Sheet>
        <Sheet family="catalog" className="xl:col-span-2">
          <SheetHeading action={t("activity.subtitle")}>
            {t("activity.title")}
          </SheetHeading>
          <ActivityLog bare />
        </Sheet>
      </div>

      <Doors
        title={tc("blocks.doors")}
        doors={[
          { key: "roster", family: "money", href: "/roster", label: t("doors.roster"), value: t("doors.rosterValue") },
          { key: "splits", family: "money", href: "/splits", label: t("doors.splits"), value: t("doors.splitsValue") },
          { key: "finances", family: "money", href: "/finances", label: t("doors.finances"), value: t("doors.financesValue") },
          { key: "contracts", family: "money", href: "/contracts", label: t("doors.contracts"), value: t("doors.contractsValue") },
          { key: "settings", family: "catalog", href: "/settings", label: t("doors.settings"), value: t("doors.settingsValue") },
          { key: "audit", family: "money", href: "/audit", label: t("doors.audit"), value: t("doors.auditValue") },
        ]}
      />
      <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

"use client";

/**
 * Pipeline partenariats — kanban 4 colonnes + fiche détail (Dialog).
 * Les statuts vivent en state local (démo) : un Select par card fait
 * avancer le partenaire, pas besoin de drag & drop.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  CalendarClock,
  Flame,
  Gift,
  HandHeart,
  ShieldAlert,
  Target,
  UserRound,
} from "lucide-react";
import { TEAM } from "@/lib/demo/api";
import { hashString } from "@/lib/demo/seed";
import { artistGradient, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PartnerStatus = "toContact" | "discussion" | "pilot" | "signed";

export const PARTNER_STATUSES: PartnerStatus[] = [
  "toContact",
  "discussion",
  "pilot",
  "signed",
];

export type PartnerId =
  | "believe"
  | "adami"
  | "sacem"
  | "bolero"
  | "qonto"
  | "mama"
  | "schools";

export type Partner = {
  id: PartnerId;
  initials: string;
  /** Id du membre d'équipe owner (TEAM de la démo). */
  ownerId: string;
  /** Échéance de la prochaine action (ISO). */
  due: string;
  priority?: boolean;
  /** Pilote visé à M+3 (alimente le KPI). */
  pilotM3?: boolean;
  /** Nombre de risques documentés dans le namespace i18n. */
  riskCount: 2 | 3;
  initialStatus: PartnerStatus;
};

export const PARTNERS: Partner[] = [
  {
    id: "believe",
    initials: "BE",
    ownerId: "gael",
    due: "2026-07-10",
    priority: true,
    pilotM3: true,
    riskCount: 3,
    initialStatus: "discussion",
  },
  {
    id: "adami",
    initials: "AD",
    ownerId: "lisa",
    due: "2026-07-21",
    riskCount: 2,
    initialStatus: "discussion",
  },
  {
    id: "sacem",
    initials: "SA",
    ownerId: "gael",
    due: "2026-09-04",
    riskCount: 2,
    initialStatus: "toContact",
  },
  {
    id: "bolero",
    initials: "BA",
    ownerId: "ines",
    due: "2026-08-17",
    riskCount: 2,
    initialStatus: "toContact",
  },
  {
    id: "qonto",
    initials: "QO",
    ownerId: "ines",
    due: "2026-07-30",
    riskCount: 2,
    initialStatus: "discussion",
  },
  {
    id: "mama",
    initials: "MA",
    ownerId: "omar",
    due: "2026-10-13",
    pilotM3: true,
    riskCount: 2,
    initialStatus: "pilot",
  },
  {
    id: "schools",
    initials: "EC",
    ownerId: "omar",
    due: "2026-09-28",
    riskCount: 2,
    initialStatus: "toContact",
  },
];

export function initialStatuses(): Record<PartnerId, PartnerStatus> {
  return Object.fromEntries(
    PARTNERS.map((p) => [p.id, p.initialStatus]),
  ) as Record<PartnerId, PartnerStatus>;
}

function partnerHue(id: PartnerId): number {
  return hashString(`partner:${id}`) % 360;
}

function ownerName(ownerId: string): string {
  return TEAM.find((m) => m.id === ownerId)?.name ?? ownerId;
}

function PartnerLogo({
  partner,
  size = "md",
}: {
  partner: Partner;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-lg font-semibold text-white/95",
        size === "lg" ? "size-11 text-sm" : "size-8 text-[11px]",
      )}
      style={{ background: artistGradient(partnerHue(partner.id)) }}
    >
      {partner.initials}
    </span>
  );
}

/* ─────────────────────────── Card ─────────────────────────── */

function PartnerCard({
  partner,
  status,
  onStatusChange,
  onOpen,
}: {
  partner: Partner;
  status: PartnerStatus;
  onStatusChange: (s: PartnerStatus) => void;
  onOpen: () => void;
}) {
  const t = useTranslations("onboardings");
  const locale = useLocale();

  return (
    <div className="rounded-lg border bg-card p-3 transition-colors hover:border-brand/40">
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full text-left"
        aria-label={t("board.details")}
      >
        <div className="flex items-start gap-2.5">
          <PartnerLogo partner={partner} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold leading-tight">
                {t(`partners.${partner.id}.name`)}
              </span>
              <ArrowUpRight
                className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </div>
            <span className="block truncate text-[11px] text-muted-foreground">
              {t(`partners.${partner.id}.tag`)}
            </span>
          </div>
          {partner.priority && (
            <Badge className="shrink-0 gap-1 bg-brand/15 text-brand">
              <Flame aria-hidden />
              {t("board.priority")}
            </Badge>
          )}
        </div>

        <dl className="mt-2.5 flex flex-col gap-1.5">
          <div className="flex items-start gap-1.5">
            <Gift className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("board.brings")}
              </dt>
              <dd className="text-[12px] leading-snug">
                {t(`partners.${partner.id}.brings`)}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <HandHeart className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("board.weBring")}
              </dt>
              <dd className="text-[12px] leading-snug">
                {t(`partners.${partner.id}.weBring`)}
              </dd>
            </div>
          </div>
        </dl>

        <div className="mt-2.5 flex items-start gap-1.5 rounded-md bg-surface-2 px-2 py-1.5">
          <CalendarClock className="mt-0.5 size-3 shrink-0 text-brand" aria-hidden />
          <p className="min-w-0 text-[11px] leading-snug">
            {t(`partners.${partner.id}.nextAction`)}
            <span className="num mt-0.5 block text-[10px] text-muted-foreground">
              {fmtDate(locale, partner.due)}
            </span>
          </p>
        </div>
      </button>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          <UserRound className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{ownerName(partner.ownerId)}</span>
        </span>
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as PartnerStatus)}
        >
          <SelectTrigger
            size="sm"
            className="max-w-36 text-[11px]"
            aria-label={t("board.statusLabel")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTNER_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {t(`board.columns.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ─────────────────────────── Dialog détail ─────────────────────────── */

function PartnerDialog({
  partner,
  status,
  onClose,
}: {
  partner: Partner | null;
  status: PartnerStatus | null;
  onClose: () => void;
}) {
  const t = useTranslations("onboardings");

  return (
    <Dialog open={partner !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {partner && status && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <PartnerLogo partner={partner} size="lg" />
                <div className="min-w-0 flex-1">
                  <DialogTitle>{t(`partners.${partner.id}.name`)}</DialogTitle>
                  <DialogDescription className="mt-0.5">
                    {t(`partners.${partner.id}.tag`)}
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="mr-6 shrink-0">
                  {t(`board.columns.${status}`)}
                </Badge>
              </div>
            </DialogHeader>

            {/* Pitch 90 secondes */}
            <section>
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("dialog.pitchTitle")}
              </h3>
              <blockquote className="rounded-lg border-l-2 border-brand bg-surface-2 p-3 font-heading text-[13px] italic leading-relaxed">
                {t(`partners.${partner.id}.pitch`)}
              </blockquote>
            </section>

            {/* Métriques de succès */}
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Target className="size-3 text-brand" aria-hidden />
                {t("dialog.metricsTitle")}
              </h3>
              <ul className="flex flex-col">
                {(["m3", "m9", "m18"] as const).map((m) => (
                  <li
                    key={m}
                    className="hairline-b flex items-start gap-2.5 py-2 last:shadow-none"
                  >
                    <span className="num mt-0.5 inline-flex w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                      {t(`dialog.${m}`)}
                    </span>
                    <span className="text-[13px] leading-snug">
                      {t(`partners.${partner.id}.${m}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Risques & mitigations */}
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ShieldAlert className="size-3 text-warning" aria-hidden />
                {t("dialog.risksTitle")}
              </h3>
              <ul className="flex flex-col gap-2">
                {Array.from({ length: partner.riskCount }, (_, i) => `r${i + 1}`).map(
                  (r) => (
                    <li key={r} className="rounded-lg bg-surface-2 p-2.5">
                      <p className="text-[13px] font-medium leading-snug">
                        {t(`partners.${partner.id}.risks.${r}.risk`)}
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                        <span className="font-medium text-success">
                          {t("dialog.mitigation")}
                        </span>{" "}
                        — {t(`partners.${partner.id}.risks.${r}.mitigation`)}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Board ─────────────────────────── */

export function PartnerBoard({
  statuses,
  onStatusChange,
}: {
  statuses: Record<PartnerId, PartnerStatus>;
  onStatusChange: (id: PartnerId, s: PartnerStatus) => void;
}) {
  const t = useTranslations("onboardings");
  const [openId, setOpenId] = useState<PartnerId | null>(null);
  const openPartner = PARTNERS.find((p) => p.id === openId) ?? null;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PARTNER_STATUSES.map((col) => {
          const items = PARTNERS.filter((p) => statuses[p.id] === col);
          return (
            <div key={col} className="rounded-xl border bg-surface-2/50 p-3">
              <div className="mb-3 flex items-center justify-between px-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`board.columns.${col}`)}
                </h3>
                <span
                  className={cn(
                    "num inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    items.length > 0
                      ? "bg-brand/15 text-brand"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.map((p) => (
                  <PartnerCard
                    key={p.id}
                    partner={p}
                    status={col}
                    onStatusChange={(s) => onStatusChange(p.id, s)}
                    onOpen={() => setOpenId(p.id)}
                  />
                ))}
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
                    {t("board.empty")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PartnerDialog
        partner={openPartner}
        status={openId ? statuses[openId] : null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

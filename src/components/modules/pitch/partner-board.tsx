"use client";

/**
 * Le pipeline partenaires — la liste, et la fiche détail.
 * Refondue le 24/09 avec la page /onboardings.
 *
 * Le kanban à quatre colonnes est retiré. Il promettait un équilibre qui
 * n'existe pas : six partenaires s'entassaient dans « En discussion » pendant
 * que « Signé » affichait une boîte vide sur toute la hauteur de l'écran, et
 * la colonne la plus chargée était celle qu'on lisait le moins bien. Les
 * partenaires vivent désormais dans une liste, groupés par étape et **triés
 * par échéance** : c'est la date qui dit quoi faire ensuite, pas la colonne.
 *
 * Une échéance dépassée est en rouge. C'est l'information que le kanban ne
 * donnait nulle part — quatre des neuf dates étaient déjà derrière nous sans
 * que rien ne le signale.
 *
 * Le statut reste modifiable partenaire par partenaire (select) : les
 * comptes de la feuille d'en-tête se recalculent avec lui.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Flame, ShieldAlert, Target } from "lucide-react";
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

/** Ordre du pipeline : de la porte fermée à la signature. */
export const PARTNER_STATUSES: PartnerStatus[] = [
  "toContact",
  "discussion",
  "pilot",
  "signed",
];

export type PartnerId =
  | "capitol"
  | "umpg"
  | "universal"
  | "believe"
  | "adami"
  | "sacem"
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
  /** Pilote visé à M+3 — une intention d'équipe, pas un engagement signé. */
  pilotM3?: boolean;
  /** Nombre de risques documentés dans le namespace i18n. */
  riskCount: 2 | 3;
  initialStatus: PartnerStatus;
};

export const PARTNERS: Partner[] = [
  {
    id: "capitol",
    initials: "CA",
    ownerId: "gael",
    due: "2026-09-18",
    priority: true,
    pilotM3: true,
    riskCount: 2,
    initialStatus: "discussion",
  },
  {
    id: "umpg",
    initials: "UP",
    ownerId: "gael",
    due: "2026-09-30",
    priority: true,
    pilotM3: true,
    riskCount: 2,
    initialStatus: "discussion",
  },
  {
    id: "universal",
    initials: "UM",
    ownerId: "gael",
    due: "2026-09-19",
    priority: true,
    pilotM3: true,
    riskCount: 2,
    initialStatus: "discussion",
  },
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
        "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white/95 select-none",
        size === "lg" ? "size-11 text-sm" : "size-8 text-[11px]",
      )}
      style={{ background: artistGradient(partnerHue(partner.id)) }}
    >
      {partner.initials}
    </span>
  );
}

/* ─────────────────────────── Ligne ─────────────────────────── */

function PartnerRow({
  partner,
  status,
  overdue,
  onStatusChange,
  onOpen,
}: {
  partner: Partner;
  status: PartnerStatus;
  /** L'échéance est derrière nous : elle se lit en rouge. */
  overdue: boolean;
  onStatusChange: (s: PartnerStatus) => void;
  onOpen: () => void;
}) {
  const t = useTranslations("onboardings");
  const locale = useLocale();

  return (
    <li className="border-border/50 flex flex-col gap-2 border-t py-2.5 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <PartnerLogo partner={partner} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button
              type="button"
              onClick={onOpen}
              aria-label={t("board.details")}
              className="text-left text-sm leading-tight font-semibold hover:underline"
            >
              {t(`partners.${partner.id}.name`)}
              <ArrowUpRight className="ml-0.5 inline size-3.5 align-[-2px]" aria-hidden />
            </button>
            <span className="sheet-ink text-[11.5px]">
              {t(`partners.${partner.id}.tag`)}
            </span>
            {partner.priority && (
              <span className="text-destructive inline-flex items-center gap-1 text-[11px] font-semibold">
                <Flame className="size-3" aria-hidden />
                {t("board.priority")}
              </span>
            )}
          </p>

          <p className="text-foreground/75 mt-1 text-[12px] leading-snug">
            <span className="sheet-ink font-medium">{t("board.brings")}</span>{" "}
            {t(`partners.${partner.id}.brings`)}
          </p>
          <p className="text-foreground/75 text-[12px] leading-snug">
            <span className="sheet-ink font-medium">{t("board.weBring")}</span>{" "}
            {t(`partners.${partner.id}.weBring`)}
          </p>

          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px]">
            <span
              className={cn(
                "font-semibold tabular-nums",
                overdue && "text-destructive",
              )}
            >
              {fmtDate(locale, partner.due)}
            </span>
            <span className="text-foreground/75">
              {t(`partners.${partner.id}.nextAction`)}
            </span>
            <span className="sheet-ink">
              {t("board.ownedBy", { name: ownerName(partner.ownerId) })}
            </span>
          </p>
        </div>
      </div>

      <Select value={status} onValueChange={(v) => onStatusChange(v as PartnerStatus)}>
        <SelectTrigger
          size="sm"
          className="w-full shrink-0 text-[11px] sm:w-36"
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
    </li>
  );
}

/* ─────────────────────────── Fiche détail ─────────────────────────── */

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

            {/* Le pitch tenu devant ce partenaire. */}
            <section>
              <h3 className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                {t("dialog.pitchTitle")}
              </h3>
              <blockquote className="bg-secondary rounded-lg p-3 text-[13px] leading-relaxed italic">
                {t(`partners.${partner.id}.pitch`)}
              </blockquote>
            </section>

            {/* Ce à quoi on s'engage à se mesurer — des cibles, pas des acquis. */}
            <section>
              <h3 className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                <Target className="size-3" aria-hidden />
                {t("dialog.metricsTitle")}
              </h3>
              <ul className="flex flex-col">
                {(["m3", "m9", "m18"] as const).map((m) => (
                  <li
                    key={m}
                    className="hairline-b flex items-start gap-2.5 py-2 last:shadow-none"
                  >
                    <span className="bg-secondary text-foreground/80 mt-0.5 inline-flex w-10 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {t(`dialog.${m}`)}
                    </span>
                    <span className="text-[13px] leading-snug">
                      {t(`partners.${partner.id}.${m}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-1.5 text-[11px]">
                {t("dialog.metricsHint")}
              </p>
            </section>

            {/* Ce qui peut faire échouer le deal, et la parade écrite d'avance. */}
            <section>
              <h3 className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                <ShieldAlert className="text-warning size-3" aria-hidden />
                {t("dialog.risksTitle")}
              </h3>
              <ul className="flex flex-col gap-2">
                {Array.from({ length: partner.riskCount }, (_, i) => `r${i + 1}`).map(
                  (r) => (
                    <li key={r} className="bg-secondary rounded-lg p-2.5">
                      <p className="text-[13px] leading-snug font-medium">
                        {t(`partners.${partner.id}.risks.${r}.risk`)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
                        <span className="text-success font-medium">
                          {t("dialog.mitigation")}
                        </span>
                        {" — "}
                        {t(`partners.${partner.id}.risks.${r}.mitigation`)}
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

/* ─────────────────────────── Liste ─────────────────────────── */

/**
 * Les partenaires, par étape puis par échéance. Une étape sans personne ne
 * laisse pas de boîte vide : elle disparaît, et son compte reste lisible dans
 * la feuille d'en-tête de la page.
 */
export function PartnerList({
  statuses,
  todayIso,
  onStatusChange,
}: {
  statuses: Record<PartnerId, PartnerStatus>;
  /** « Aujourd'hui » de la démo : c'est lui qui dit ce qui est en retard. */
  todayIso: string;
  onStatusChange: (id: PartnerId, s: PartnerStatus) => void;
}) {
  const t = useTranslations("onboardings");
  const [openId, setOpenId] = useState<PartnerId | null>(null);
  const openPartner = PARTNERS.find((p) => p.id === openId) ?? null;

  return (
    <>
      <div className="mt-1">
        {PARTNER_STATUSES.map((col) => {
          const items = PARTNERS.filter((p) => statuses[p.id] === col).sort((a, b) =>
            a.due.localeCompare(b.due),
          );
          if (items.length === 0) return null;
          return (
            <section key={col} className="mt-3 first:mt-0">
              <h3 className="sheet-ink flex items-baseline gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
                <span>{t(`board.columns.${col}`)}</span>
                <span className="tabular-nums">{items.length}</span>
              </h3>
              <ul>
                {items.map((p) => (
                  <PartnerRow
                    key={p.id}
                    partner={p}
                    status={col}
                    overdue={p.due < todayIso}
                    onStatusChange={(s) => onStatusChange(p.id, s)}
                    onOpen={() => setOpenId(p.id)}
                  />
                ))}
              </ul>
            </section>
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

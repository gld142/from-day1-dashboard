"use client";

/**
 * /onboardings — où en est chaque canal partenaire, et ce qui vient ensuite.
 * Refondue le 24/09. Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Le chiffre qui tient la page est **le nombre de partenaires engagés** —
 * ceux qui ont dépassé « à contacter ». C'est le seul état du pipeline qui se
 * mesure, et il bouge quand on déplace un statut.
 *
 * Ce qui disparaît :
 *  - la grille de quatre cartes de KPI en tête, marque de l'ancienne version ;
 *  - « Objectif M18 · 80 % » affiché comme un chiffre à côté de chiffres
 *    mesurés. Une cible n'est pas un relevé : elle est descendue dans la
 *    feuille « méthode », écrite comme une cible d'équipe. Idem pour les cinq
 *    pilotes visés à M+3, qui étaient comptés comme s'ils existaient déjà ;
 *  - le kanban à quatre colonnes (voir le commentaire de partner-board).
 *
 * Ce qui apparaît : les échéances dépassées. Quatre des neuf dates de
 * prochaine action sont derrière le dernier relevé et rien ne le disait.
 *
 * La page est interne (personas label, `internal` dans nav.ts) : elle vouvoie,
 * comme toutes les vues de structure.
 */

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_TODAY } from "@/lib/demo/seed";
import { fmtDate, fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
import {
  PARTNERS,
  PARTNER_STATUSES,
  PartnerList,
  initialStatuses,
  type PartnerId,
  type PartnerStatus,
} from "@/components/modules/pitch/partner-board";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

const TODAY_ISO = DEMO_TODAY.toISOString().slice(0, 10);

/** Les cinq principes, dans l'ordre où ils s'appliquent à un deal. */
const PRINCIPLES = ["activable", "owner", "metrics", "pilot", "exclusivity"] as const;

/**
 * La barre du pipeline : plus une étape est avancée, plus son filet est dense.
 * C'est la seule façon de voir d'un coup que la file s'arrête avant la
 * signature — le kanban, lui, montrait surtout une colonne vide.
 */
const STAGE_FILL: Record<PartnerStatus, number> = {
  toContact: 26,
  discussion: 46,
  pilot: 66,
  signed: 88,
};

export default function OnboardingsPage() {
  const t = useTranslations("onboardings");
  const tc = useTranslations("common");
  const locale = useLocale();

  const [statuses, setStatuses] = useState<Record<PartnerId, PartnerStatus>>(
    initialStatuses,
  );

  const facts = useMemo(() => {
    const count = (s: PartnerStatus) =>
      PARTNERS.filter((p) => statuses[p.id] === s).length;

    /* La prochaine échéance à venir, et celles qu'on a laissées passer : deux
       lectures différentes de la même date, et les deux font agir. */
    const ahead = PARTNERS.filter((p) => p.due >= TODAY_ISO).sort((a, b) =>
      a.due.localeCompare(b.due),
    );

    return {
      total: PARTNERS.length,
      byStage: {
        toContact: count("toContact"),
        discussion: count("discussion"),
        pilot: count("pilot"),
        signed: count("signed"),
      } satisfies Record<PartnerStatus, number>,
      engaged: PARTNERS.filter((p) => statuses[p.id] !== "toContact").length,
      overdue: PARTNERS.filter((p) => p.due < TODAY_ISO).length,
      next: ahead[0] ?? null,
      owners: new Set(PARTNERS.map((p) => p.ownerId)).size,
      pilotsAimed: PARTNERS.filter((p) => p.pilotM3).length,
    };
  }, [statuses]);

  const stages = PARTNER_STATUSES.filter((s) => facts.byStage[s] > 0);

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="space-y-3">
        {/* Où en est le pipeline, et ce qui arrive en premier. */}
        <Sheet family="catalog">
          <SheetHeading action={<ProvenanceBadge provenance="declared" />}>
            {t("hero.title")}
          </SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {fmtInt(locale, facts.engaged)}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {t("hero.caption", {
              total: fmtInt(locale, facts.total),
              toContact: facts.byStage.toContact,
            })}
          </p>

          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_14%,transparent)]">
            {stages.map((s) => (
              <div
                key={s}
                className="h-full"
                style={{
                  width: `${(facts.byStage[s] / facts.total) * 100}%`,
                  background: `color-mix(in oklab, var(--sheet-line) ${STAGE_FILL[s]}%, transparent)`,
                }}
                title={`${t(`board.columns.${s}`)} · ${facts.byStage[s]}`}
              />
            ))}
          </div>
          <p className="sheet-ink mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {PARTNER_STATUSES.map((s) => (
              <span key={s}>
                {t(`board.columns.${s}`)}
                <b className="ml-1 font-semibold tabular-nums">{facts.byStage[s]}</b>
              </span>
            ))}
          </p>

          <AffiliatedPoints
            points={[
              {
                key: "next",
                value: facts.next ? fmtDate(locale, facts.next.due) : "—",
                label: t("kpis.next"),
                note: facts.next
                  ? t(`partners.${facts.next.id}.name`)
                  : t("kpis.nextNone"),
              },
              {
                key: "overdue",
                value: fmtInt(locale, facts.overdue),
                label: t("kpis.overdue"),
                note: t("kpis.overdueHint"),
              },
              {
                key: "signed",
                value: fmtInt(locale, facts.byStage.signed),
                label: t("kpis.signed"),
                note:
                  facts.byStage.signed === 0 ? t("kpis.signedNone") : undefined,
              },
              {
                key: "owners",
                value: fmtInt(locale, facts.owners),
                label: t("kpis.owners"),
                note: t("kpis.ownersHint"),
              },
            ]}
          />
        </Sheet>

        {/* Les partenaires, par étape puis par échéance. */}
        <Sheet family="catalog">
          <SheetHeading action={t("board.hint")}>{t("board.title")}</SheetHeading>
          <PartnerList
            statuses={statuses}
            todayIso={TODAY_ISO}
            onStatusChange={(id, s) =>
              setStatuses((prev) => ({ ...prev, [id]: s }))
            }
          />
        </Sheet>

        {/* La règle du jeu, puis les cibles — annoncées comme des cibles. */}
        <Sheet family="catalog">
          <SheetHeading>{t("method.title")}</SheetHeading>
          <ol className="mt-1">
            {PRINCIPLES.map((key, i) => (
              <li
                key={key}
                className="border-border/50 flex items-baseline gap-3 border-t py-2 first:border-t-0 first:pt-1"
              >
                <span className="sheet-ink w-4 shrink-0 text-xs font-semibold tabular-nums">
                  {fmtInt(locale, i + 1)}
                </span>
                <span className="min-w-0 text-[12.5px] leading-relaxed">
                  <b className="font-semibold">
                    {t(`method.principles.${key}.title`)}
                  </b>
                  {" — "}
                  <span className="text-foreground/75">
                    {t(`method.principles.${key}.desc`)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="sheet-rule mt-3 pt-2.5 text-[11.5px] leading-relaxed">
            {t("method.targets", {
              share: 80,
              pilots: facts.pilotsAimed,
            })}
          </p>
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "comparatif",
              family: "trends",
              href: "/comparatif",
              label: t("doors.comparatif"),
              value: t("doors.comparatifValue"),
            },
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              value: t("doors.auditValue"),
            },
            {
              key: "rights",
              family: "money",
              href: "/rights",
              label: t("doors.rights"),
              value: t("doors.rightsValue"),
            },
            {
              key: "roster",
              family: "money",
              href: "/roster",
              label: t("doors.roster"),
              value: t("doors.rosterValue"),
            },
            {
              key: "index",
              family: "trends",
              href: "/day1-index",
              label: t("doors.index"),
              value: t("doors.indexValue"),
            },
            {
              key: "team",
              family: "catalog",
              href: "/team",
              label: t("doors.team"),
              value: t("doors.teamValue", { count: facts.owners }),
            },
          ]}
        />

        {/* Seul lien de cette page qui ne soit pas déjà dans la barre latérale :
            `/welcome` vit hors de la coquille du dashboard. Les cinq autres
            (Pulse, Copilot, Importer, Catalogue, Réglages) étaient du
            remplissage — la barre latérale les porte déjà. */}
        <RestRow
          title={t("portal.title")}
          items={[
            {
              key: "welcome",
              href: "/welcome?source=universal",
              label: t("portal.link"),
            },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

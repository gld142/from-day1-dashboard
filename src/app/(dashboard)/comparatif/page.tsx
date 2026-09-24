"use client";

/**
 * /comparatif — ce que From Day 1 réunit et que personne d'autre ne réunit.
 * Refondue le 24/09. Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Le chiffre qui tient la page est **le nombre de capacités qu'aucun
 * concurrent ne couvre entièrement**. Il n'est pas écrit : il est lu dans la
 * matrice du tableau (`comparisonFacts`). La version d'avant affirmait « les
 * 7 » dans son héros pendant que le tableau en comptait 8, et annonçait
 * « 12 capacités » là où il y en a 11 plus une ligne de prix — trois nombres
 * pour une seule vérité, et aucun des trois vérifiable sans compter à la
 * main. Un chiffre calculé ne peut plus dériver de ce qu'il décrit.
 *
 * Ce qui disparaît :
 *  - la grille de sept cartes « Tier S » au-dessus du tableau : le tableau
 *    dit la même chose, capacité par capacité, et en donne la preuve ;
 *  - le violet de marque en fond de héros, de pastilles et de bordures. Dans
 *    le système, la couleur code la famille d'information — ici « tendances »,
 *    comme /market et /day1-index, parce qu'on y lit une position de marché.
 *
 * Faits et jugements sont séparés : la fenêtre de marché donne deux ordres de
 * grandeur estimés (badge « estimé »), puis, sous un filet, la lecture qu'on
 * en fait — annoncée comme une lecture.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fmtEur, fmtInt } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import {
  ComparisonTable,
  comparisonFacts,
} from "@/components/modules/pitch/comparison-table";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

/** Les deux ordres de grandeur de la fenêtre : estimés, et affichés comme tels. */
const WINDOW_FACTS = ["market", "barrier"] as const;

export default function ComparatifPage() {
  const t = useTranslations("comparatif");
  const tc = useTranslations("common");
  const locale = useLocale();

  const facts = useMemo(() => comparisonFacts(), []);

  const listOf = (keys: readonly string[]) =>
    keys.map((k) => t(`table.rows.${k}`)).join(" · ");

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="space-y-3">
        {/* Ce que personne d'autre ne réunit — compté dans le tableau qui suit. */}
        <Sheet family="trends">
          <SheetHeading action={<ProvenanceBadge provenance="declared" />}>
            {t("hero.title")}
          </SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {fmtInt(locale, facts.uncovered.length)}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {t("hero.caption", {
              total: fmtInt(locale, facts.capabilities),
              rivals: fmtInt(locale, facts.rivals),
            })}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[12.5px] leading-snug">
            {facts.uncovered.map((key) => (
              <li
                key={key}
                className="rounded-md bg-[color-mix(in_oklab,var(--sheet-line)_12%,transparent)] px-2 py-0.5 font-medium"
              >
                {t(`table.rows.${key}`)}
              </li>
            ))}
          </ul>

          <AffiliatedPoints
            points={[
              {
                key: "capabilities",
                value: fmtInt(locale, facts.capabilities),
                label: t("kpis.capabilities"),
                note: t("kpis.capabilitiesHint"),
              },
              {
                key: "best",
                value: fmtInt(locale, facts.bestRivalCount),
                label: t("kpis.best"),
                note: facts.bestRivals
                  .map((p) => t(`table.products.${p}`))
                  .join(", "),
              },
              {
                key: "covered",
                value: fmtInt(locale, facts.covered.length),
                label: t("kpis.covered"),
                note: listOf(facts.covered),
              },
              {
                key: "price",
                value: t("kpis.priceValue", {
                  low: fmtEur(locale, 19),
                  high: fmtEur(locale, 199),
                }),
                label: t("kpis.price"),
                note: t("kpis.priceHint"),
              },
            ]}
          />
        </Sheet>

        {/* La preuve : capacité par capacité, plateforme par plateforme. */}
        <Sheet family="trends">
          <SheetHeading action={t("table.scope", {
            total: fmtInt(locale, facts.capabilities),
            products: fmtInt(locale, facts.rivals + 1),
          })}>
            {t("table.title")}
          </SheetHeading>
          <ComparisonTable bare />
        </Sheet>

        {/* Deux ordres de grandeur, puis la lecture qu'on en fait — séparées. */}
        <Sheet family="trends">
          <SheetHeading action={t("window.source")}>{t("window.title")}</SheetHeading>
          <div className="mt-1 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {WINDOW_FACTS.map((key) => (
              <div key={key}>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <b className="text-2xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                    {t(`window.facts.${key}.value`)}
                  </b>
                  <ProvenanceBadge provenance="estimated" />
                </p>
                <span className="sheet-ink mt-1 block text-xs">
                  {t(`window.facts.${key}.label`)}
                </span>
                <p className="text-foreground/75 mt-1 text-[12.5px] leading-relaxed">
                  {t(`window.facts.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
          <div className="sheet-rule mt-3 pt-2.5">
            <p className="sheet-ink text-[11px] font-semibold tracking-[0.08em] uppercase">
              {t("window.readingTitle")}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed">{t("window.reading")}</p>
          </div>
        </Sheet>

        {/* Le pitch : une position, signée comme telle. */}
        <Sheet family="trends">
          <SheetHeading>{t("pitch.kicker")}</SheetHeading>
          <blockquote className="max-w-4xl text-[15px] leading-relaxed italic">
            {t("pitch.quote", {
              low: fmtEur(locale, 19),
              high: fmtEur(locale, 199),
            })}
          </blockquote>
          <p className="sheet-ink mt-2 text-[11.5px]">{t("pitch.author")}</p>
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "rights",
              family: "money",
              href: "/rights",
              label: t("doors.rights"),
              value: t("doors.rightsValue"),
            },
            {
              key: "urssaf",
              family: "money",
              href: "/urssaf",
              label: t("doors.urssaf"),
              value: t("doors.urssafValue"),
            },
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              value: t("doors.auditValue"),
            },
            {
              key: "valuation",
              family: "money",
              href: "/valuation",
              label: t("doors.valuation"),
              value: t("doors.valuationValue"),
            },
            {
              key: "index",
              family: "trends",
              href: "/day1-index",
              label: t("doors.index"),
              value: t("doors.indexValue"),
            },
            {
              key: "copilot",
              family: "trends",
              href: "/copilot",
              label: t("doors.copilot"),
              value: t("doors.copilotValue"),
            },
          ]}
        />
        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

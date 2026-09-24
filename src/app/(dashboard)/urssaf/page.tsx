"use client";

/**
 * /urssaf — cotisations sociales artiste-auteur. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Le chiffre qui tient la page : **ce que tu dois**. La barre sous lui montre
 * la coupe — ce qui part, ce qui reste — sur les mêmes douze mois.
 *
 * Correction de justesse : le trimestre déclaré était figé sur avril–juin 2026
 * (constante `QUARTER_MONTHS`) tandis que l'échéance affichée, elle, se
 * calculait. Au 23 septembre 2026, la page annonçait donc « déclaration T3 2026 »
 * au-dessus d'un montant d'avril à juin, et le récapitulatif imprimait
 * « T3 2026 (avril – juin 2026) ». Les mois du trimestre se déduisent
 * désormais de l'échéance, et un trimestre non clos est annoncé comme tel.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ARTISTS,
  LABEL,
  getArtist,
  revenueBySource,
  revenueSeries,
} from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import { downloadCsv, round2 } from "@/lib/export";
import { fmtDate, fmtEur, fmtMonthName, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import {
  ContributionSimulator,
  DeadlinesTimeline,
  DeclarationBand,
  URSSAF_LINES,
  URSSAF_RATE,
  type Deadline,
} from "@/components/modules/droits/urssaf-widgets";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TODAY_ISO = DEMO_TODAY.toISOString().slice(0, 10);
const CURRENT_MONTH = TODAY_ISO.slice(0, 7);

/** Sources relevant du régime artiste-auteur (droits d'auteur). */
const AUTHOR_SOURCES = new Set(["sacem", "sync"]);

const RAW_DEADLINES: Array<Pick<Deadline, "date" | "quarter" | "year">> = [
  { date: "2026-01-15", quarter: 4, year: 2025 },
  { date: "2026-04-15", quarter: 1, year: 2026 },
  { date: "2026-07-15", quarter: 2, year: 2026 },
  { date: "2026-10-15", quarter: 3, year: 2026 },
  { date: "2027-01-15", quarter: 4, year: 2026 },
];

/* Les échéances ne dépendent que de la date : rien à recalculer au rendu. */
const NEXT_DEADLINE = RAW_DEADLINES.find((d) => d.date >= TODAY_ISO) ?? null;

const DEADLINES: Deadline[] = RAW_DEADLINES.map((d) => {
  if (d.date < TODAY_ISO) return { ...d, status: "paid" as const };
  if (d !== NEXT_DEADLINE) return { ...d, status: "upcoming" as const };
  return {
    ...d,
    status: "next" as const,
    daysLeft: Math.round(
      (new Date(`${d.date}T00:00:00Z`).getTime() - DEMO_TODAY.getTime()) / 86_400_000,
    ),
  };
});

/** Les trois mois « YYYY-MM » d'un trimestre civil. */
function quarterMonths(year: number, quarter: number): string[] {
  const first = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${year}-${String(first + i).padStart(2, "0")}`);
}

function declarable12m(artistId: string): number {
  return revenueBySource(artistId, 12)
    .filter((r) => AUTHOR_SOURCES.has(r.source))
    .reduce((s, r) => s + r.amount, 0);
}

export default function UrssafPage() {
  const t = useTranslations("urssaf");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { isLabel, artistId, focusedArtistId } = useRole();
  const grouped = isLabel && !focusedArtistId;

  const scopedIds = useMemo(
    () => (grouped ? ARTISTS.map((a) => a.id) : [artistId]),
    [grouped, artistId],
  );

  const declarable = useMemo(
    () => scopedIds.reduce((s, id) => s + declarable12m(id), 0),
    [scopedIds],
  );
  const contributions = (declarable * URSSAF_RATE) / 100;
  const net = declarable - contributions;

  const next = DEADLINES.find((d) => d.status === "next") ?? null;
  const quarterLabel = NEXT_DEADLINE
    ? t("deadlines.quarter", { q: NEXT_DEADLINE.quarter, year: NEXT_DEADLINE.year })
    : "";

  /* Le trimestre réellement couvert par la prochaine échéance — déduit d'elle,
     jamais écrit en dur. */
  const quarter = useMemo(() => {
    if (!NEXT_DEADLINE) return null;
    const months = quarterMonths(NEXT_DEADLINE.year, NEXT_DEADLINE.quarter);
    const amount = scopedIds.reduce(
      (sum, id) =>
        sum +
        revenueSeries(id, 24)
          .filter((p) => months.includes(p.month) && AUTHOR_SOURCES.has(p.source))
          .reduce((s, p) => s + p.amount, 0),
      0,
    );
    return {
      months,
      amount,
      /** Un trimestre dont le dernier mois n'est pas passé bougera encore. */
      open: months[months.length - 1] >= CURRENT_MONTH,
      label: `${fmtMonthName(locale, months[0], "long")} – ${fmtMonthName(
        locale,
        months[2],
        "long",
      )} ${NEXT_DEADLINE.year}`,
    };
  }, [scopedIds, locale]);

  const declarantName = grouped ? LABEL.name : getArtist(artistId).name;
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  const rateLabel = fmtPct(locale, URSSAF_RATE).replace("+", "");

  /* ── Export CSV du détail des cotisations simulées ─────────────────── */
  const exportContributionsCsv = () => {
    const rows: Array<{ label: string; rate: number | null; amount: number }> = [
      { label: t("export.base"), rate: null, amount: round2(declarable) },
      ...URSSAF_LINES.map((line) => ({
        label: t(`sim.lines.${line.key}`),
        rate: line.rate,
        amount: round2((declarable * line.rate) / 100),
      })),
      { label: t("sim.total"), rate: URSSAF_RATE, amount: round2(contributions) },
      { label: t("sim.net"), rate: null, amount: round2(net) },
    ];
    downloadCsv("day1-urssaf", rows, [
      { header: t("sim.line"), cell: (r) => r.label },
      { header: t("sim.rate"), cell: (r) => r.rate },
      { header: t("sim.amount"), cell: (r) => r.amount },
    ]);
  };

  const duePct = declarable === 0 ? 0 : (contributions / declarable) * 100;

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader
        title={t("title")}
        subtitle={grouped ? t("subtitleLabel") : t("subtitle")}
      >
        <ExportMenu
          label={t("export.button")}
          csvLabel={t("export.csv")}
          printLabel={t("export.print")}
          onExportCsv={exportContributionsCsv}
        />
      </PageHeader>

      <div className="space-y-3">
        {/* Ce qui part, et ce qui reste. */}
        <Sheet family="money">
          <SheetHeading>{t("hero.title")}</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {eur(contributions)}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {t("hero.caption", { rate: rateLabel, base: eur(declarable) })}
          </p>

          {declarable > 0 && (
            <>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full"
                  style={{
                    width: `${100 - duePct}%`,
                    background: "var(--success)",
                  }}
                  title={`${t("hero.barNet")} · ${eur(net)}`}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${duePct}%`,
                    background: "var(--warning)",
                  }}
                  title={`${t("hero.barDue")} · ${eur(contributions)}`}
                />
              </div>
              <p className="sheet-ink mt-1 flex justify-between text-[11px]">
                <span>
                  {t("hero.barNet")} {eur(net)}
                </span>
                <span>
                  {t("hero.barDue")} {rateLabel}
                </span>
              </p>
            </>
          )}

          <AffiliatedPoints
            points={[
              {
                key: "declarable",
                value: eur(declarable),
                label: t("kpis.declarable"),
                note: t("kpis.declarableHint"),
              },
              {
                key: "net",
                value: eur(net),
                label: t("kpis.net"),
                note: t("kpis.netHint"),
              },
              {
                key: "quarter",
                value: quarter ? eur(quarter.amount) : "—",
                label: t("kpis.quarter"),
                note: quarter
                  ? quarter.open
                    ? t("kpis.quarterOpen", { quarter: quarterLabel })
                    : t("kpis.quarterHint", {
                        quarter: quarterLabel,
                        amount: eur((quarter.amount * URSSAF_RATE) / 100),
                      })
                  : undefined,
              },
              {
                key: "deadline",
                value: next ? fmtDate(locale, next.date) : "—",
                label: t("kpis.nextDeadline"),
                note: next
                  ? `${quarterLabel} · ${t("kpis.deadlineIn", { days: next.daysLeft ?? 0 })}`
                  : undefined,
              },
            ]}
          />
        </Sheet>

        {/* La déclaration pré-remplie : une action, pas un bloc de données. */}
        {quarter && (
          <DeclarationBand
            declarantName={declarantName}
            quarterLabel={quarterLabel}
            monthsLabel={quarter.label}
            quarterlyDeclarable={quarter.amount}
          />
        )}

        {/* Le détail ligne à ligne, et ce que ça donnerait sur un autre montant. */}
        <Sheet family="money">
          <SheetHeading action={t("sim.sub")}>{t("sim.heading")}</SheetHeading>
          <ContributionSimulator
            key={grouped ? "roster" : artistId}
            initialAmount={declarable}
            bare
          />
          <details className="sheet-rule mt-3 pt-2.5 text-[11.5px] leading-relaxed">
            <summary className="sheet-ink cursor-pointer font-medium">
              {t("note.title")}
            </summary>
            <p className="text-muted-foreground mt-2">{t("note.body")}</p>
          </details>
        </Sheet>

        {/* Quand ça tombe. */}
        <Sheet family="money">
          <SheetHeading action={t("deadlines.sub")}>
            {t("deadlines.heading")}
          </SheetHeading>
          <DeadlinesTimeline deadlines={DEADLINES} bare />
        </Sheet>

        {grouped && (
          <Sheet family="money">
            <SheetHeading action={t("labelTable.sub")}>
              {t("labelTable.heading")}
            </SheetHeading>
            <div className="mt-1 min-w-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("labelTable.artist")}</TableHead>
                    <TableHead className="text-right">
                      {t("labelTable.declarable")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("labelTable.contributions")}
                    </TableHead>
                    <TableHead className="text-right">{t("labelTable.share")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ARTISTS.map((a) => ({ artist: a, declarable: declarable12m(a.id) }))
                    .sort((x, y) => y.declarable - x.declarable)
                    .map(({ artist, declarable: d }) => (
                      <TableRow key={artist.id}>
                        <TableCell>
                          <ArtistBadge artist={artist} size="sm" />
                        </TableCell>
                        <TableCell className="num text-right font-medium">
                          {fmtEur(locale, d)}
                        </TableCell>
                        <TableCell className="num sheet-ink text-right">
                          {fmtEur(locale, (d * URSSAF_RATE) / 100)}
                        </TableCell>
                        <TableCell className="num sheet-ink text-right">
                          {declarable === 0
                            ? "—"
                            : fmtPct(locale, (d / declarable) * 100).replace("+", "")}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </Sheet>
        )}

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
              key: "revenue",
              family: "money",
              href: "/revenue",
              label: t("doors.revenue"),
              value: t("doors.revenueValue"),
            },
            {
              key: "finances",
              family: "money",
              href: "/finances",
              label: t("doors.finances"),
              value: t("doors.financesValue"),
            },
            {
              key: "contracts",
              family: "money",
              href: "/contracts",
              label: t("doors.contracts"),
              value: t("doors.contractsValue"),
            },
            {
              key: "splits",
              family: "money",
              href: "/splits",
              label: t("doors.splits"),
              value: t("doors.splitsValue"),
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
    </div>
  );
}

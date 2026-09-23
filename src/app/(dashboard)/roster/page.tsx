"use client";

/**
 * /roster — qui porte le label, et qui décroche. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Cette page n'affiche pas un total de plus : les revenus, le net et la
 * valorisation du roster vivent déjà sur /revenue, /finances et /valuation.
 * Ce qu'elle seule peut dire, c'est le **rapport entre les artistes** — d'où un
 * héros sur la concentration : quelle part des revenus tient à un seul nom.
 * Les totaux restent, en points affiliés, à leur juste rang.
 *
 * Réservé à la vue structure.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { LabelGuard } from "@/components/modules/structure/label-guard";
import { RosterAlerts } from "@/components/modules/structure/roster-alerts";
import { RosterMatrix } from "@/components/modules/structure/roster-matrix";
import { RosterPnlBars } from "@/components/modules/structure/roster-pnl-bars";
import { RosterTable } from "@/components/modules/structure/roster-table";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { LABEL, labelTotals, rosterRows, type RosterRow } from "@/lib/demo/api";
import { downloadCsv, round2 } from "@/lib/export";
import { artistColor, fmtCompact, fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";

export default function RosterPage() {
  const t = useTranslations("roster");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { isLabel, focusedArtistId, setFocusedArtistId, setPersona } = useRole();

  const rows = useMemo(() => rosterRows(), []);
  const totals = useMemo(() => labelTotals(), []);

  /* La part de chacun dans les revenus du roster — le seul chiffre que cette
     page est seule à pouvoir dire. */
  const shares = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.revenue12m, 0);
    const sorted = [...rows].sort((a, b) => b.revenue12m - a.revenue12m);
    return {
      total,
      sorted,
      top: sorted[0] ?? null,
      topShare: total === 0 ? 0 : ((sorted[0]?.revenue12m ?? 0) / total) * 100,
      topThree:
        total === 0
          ? 0
          : (sorted.slice(0, 3).reduce((s, r) => s + r.revenue12m, 0) / total) * 100,
      declining: rows.filter((r) => r.delta30d < 0).length,
    };
  }, [rows]);

  const pct = (points: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(points / 100);
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });

  if (!isLabel) {
    return (
      <LabelGuard
        title={t("guard.title")}
        description={t("guard.description")}
        cta={t("guard.cta")}
        onSwitch={() => setPersona("label")}
      />
    );
  }

  /* ── Export CSV du comparatif roster ───────────────────────────────── */
  const exportRosterCsv = () => {
    downloadCsv<RosterRow>("day1-roster", rows, [
      { header: t("table.artist"), cell: (r) => r.name },
      { header: t("export.genre"), cell: (r) => r.genre },
      { header: t("table.stage"), cell: (r) => t(`stage.${r.careerStage}`) },
      { header: t("table.streams30d"), cell: (r) => r.streams30d },
      { header: t("table.delta30d"), cell: (r) => round2(r.delta30d) },
      { header: t("table.revenue12m"), cell: (r) => round2(r.revenue12m) },
      { header: t("table.net12m"), cell: (r) => round2(r.net12m) },
      { header: t("table.margin"), cell: (r) => round2(r.margin) },
      { header: t("table.valuation"), cell: (r) => r.valuationMid },
      { header: t("table.index"), cell: (r) => r.day1Index },
    ]);
  };

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: totals.artists, label: LABEL.name })}
      >
        <ExportMenu
          label={t("export.button")}
          csvLabel={t("export.csv")}
          printLabel={t("export.print")}
          onExportCsv={exportRosterCsv}
        />
      </PageHeader>

      <div className="space-y-3">
        {/* À quel point le label tient à un seul nom. */}
        <Sheet family="money">
          <SheetHeading action={t("kpis.revenue12mHint")}>
            {t("hero.title")}
          </SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {pct(shares.topShare)}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {shares.top
              ? t("hero.caption", { artist: shares.top.name })
              : t("hero.captionEven")}
          </p>

          {/* Chaque artiste, à sa teinte, à l'échelle de ce qu'il rapporte. */}
          {shares.total > 0 && (
            <>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
                {shares.sorted.map((r) => (
                  <div
                    key={r.id}
                    className="h-full"
                    style={{
                      width: `${(r.revenue12m / shares.total) * 100}%`,
                      background: artistColor(r.hue),
                    }}
                    title={`${r.name} · ${eur(r.revenue12m)}`}
                  />
                ))}
              </div>
              <p className="sheet-ink mt-1 flex flex-wrap justify-between gap-x-4 text-[11px]">
                {/* « Les trois premiers : 100 % » sur un roster de trois
                    n'apprend rien : la ligne n'apparaît qu'au-delà. */}
                <span>
                  {rows.length > 3
                    ? t("hero.topThree", { share: pct(shares.topThree) })
                    : t("kpis.revenue12m")}
                </span>
                <span>{eur(shares.total)}</span>
              </p>
            </>
          )}

          <p className="sheet-ink mt-2 text-[11.5px] leading-relaxed">
            {t("hero.risk")}
          </p>

          <AffiliatedPoints
            points={[
              {
                key: "artists",
                value: String(totals.artists),
                label: t("kpis.artists"),
                note: t("kpis.artistsHint", { count: shares.declining }),
              },
              {
                key: "streams",
                value: fmtCompact(locale, totals.streams30d),
                label: t("kpis.streams30d"),
              },
              {
                key: "net",
                value: eur(totals.net12m),
                label: t("kpis.net12m"),
                note: t("kpis.net12mHint"),
              },
              {
                key: "valuation",
                value: eur(totals.valuationMid),
                label: t("kpis.valuation"),
                note: t("kpis.valuationHint"),
              },
            ]}
          />
        </Sheet>

        {/* LE tableau roster. */}
        <Sheet family="money">
          <SheetHeading action={t("table.hint")}>{t("table.title")}</SheetHeading>
          <RosterTable
            rows={rows}
            focusedArtistId={focusedArtistId}
            onFocus={setFocusedArtistId}
            bare
          />
        </Sheet>

        {/* Où chacun se situe, et ce qui cloche. */}
        <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
          <Sheet family="trends">
            <SheetHeading action={t("matrix.subtitle")}>
              {t("matrix.title")}
            </SheetHeading>
            <RosterMatrix rows={rows} bare />
          </Sheet>
          <Sheet family="trends">
            <SheetHeading action={t("alerts.subtitle")}>
              {t("alerts.title")}
            </SheetHeading>
            <RosterAlerts rows={rows} bare />
          </Sheet>
        </div>

        {/* Ce que chacun rapporte, coûte et laisse. */}
        <Sheet family="money">
          <SheetHeading>{t("pnl.title")}</SheetHeading>
          <RosterPnlBars bare />
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "valuation",
              family: "money",
              href: "/valuation",
              label: t("doors.valuation"),
              value: t("doors.valuationValue"),
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
              key: "arwatch",
              family: "trends",
              href: "/ar-watch",
              label: t("doors.arwatch"),
              value: t("doors.arwatchValue"),
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
              value: t("doors.teamValue"),
            },
          ]}
        />

        <RestRow
          title={tc("blocks.restLabel")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "streams", href: "/streams", label: t("rest.streams") },
            { key: "revenue", href: "/revenue", label: t("rest.revenue") },
            { key: "catalog", href: "/catalog", label: t("rest.catalog") },
            { key: "tour", href: "/tour", label: t("rest.tour") },
            { key: "market", href: "/market", label: t("rest.market") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

"use client";

/**
 * /roster — la salle des machines du label : comparatif complet du roster,
 * matrice stratégique, P&L par artiste et alertes. Réservé à la vue structure.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { LabelGuard } from "@/components/modules/structure/label-guard";
import { RosterAlerts } from "@/components/modules/structure/roster-alerts";
import { RosterMatrix } from "@/components/modules/structure/roster-matrix";
import { RosterPnlBars } from "@/components/modules/structure/roster-pnl-bars";
import { RosterTable } from "@/components/modules/structure/roster-table";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { LABEL, labelTotals, rosterRows, type RosterRow } from "@/lib/demo/api";
import { downloadCsv, round2 } from "@/lib/export";
import { useRole } from "@/lib/role";

export default function RosterPage() {
  const t = useTranslations("roster");
  const { isLabel, focusedArtistId, setFocusedArtistId, setPersona } = useRole();

  const rows = useMemo(() => rosterRows(), []);
  const totals = useMemo(() => labelTotals(), []);

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
    <div className="rise-in space-y-6">
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

      {/* KPIs label */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          id="roster-artists"
          label={t("kpis.artists")}
          value={totals.artists}
          format="int"
        />
        <KpiCard
          id="roster-streams"
          label={t("kpis.streams30d")}
          value={totals.streams30d}
          format="compact"
        />
        <KpiCard
          id="roster-revenue"
          label={t("kpis.revenue12m")}
          value={totals.revenue12m}
          format="eur"
        />
        <KpiCard
          id="roster-net"
          label={t("kpis.net12m")}
          value={totals.net12m}
          format="eur"
        />
        <KpiCard
          id="roster-valuation"
          label={t("kpis.valuation")}
          value={totals.valuationMid}
          format="eur"
          hero
          className="col-span-2 lg:col-span-1"
        />
      </section>

      {/* LE tableau roster */}
      <RosterTable
        rows={rows}
        focusedArtistId={focusedArtistId}
        onFocus={setFocusedArtistId}
      />

      {/* Matrice stratégique + alertes */}
      <section className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <RosterMatrix rows={rows} />
        </div>
        <div className="xl:col-span-2">
          <RosterAlerts rows={rows} />
        </div>
      </section>

      {/* P&L par artiste */}
      <RosterPnlBars />
    </div>
  );
}

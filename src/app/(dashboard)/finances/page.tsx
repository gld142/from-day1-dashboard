"use client";

/**
 * Dépenses & P&L — le centre financier Day 1.
 * Persona artiste : son propre P&L. Persona label : roster agrégé ou zoom artiste.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddExpenseDialog } from "@/components/modules/finances/add-expense-dialog";
import { CategoryDonut } from "@/components/modules/finances/category-donut";
import { ExpenseRegister } from "@/components/modules/finances/expense-register";
import {
  PnlComparisons,
  type SpendRow,
  type YearPnlRow,
} from "@/components/modules/finances/pnl-comparisons";
import {
  PnlMonthlyChart,
  type MonthlyPnlPoint,
} from "@/components/modules/finances/pnl-monthly-chart";
import { WavelyCard } from "@/components/modules/finances/wavely-card";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARTISTS,
  PROJECTS,
  TEAM,
  TRACKS,
  expenses as fetchExpenses,
  getArtist,
  monthlyRevenueTotals,
  pnlByYear,
} from "@/lib/demo/api";
import type { Expense, ExpenseCategory } from "@/lib/demo/types";
import { EXPENSE_CATEGORIES } from "@/lib/demo/types";
import { downloadCsv } from "@/lib/export";
import { fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";

const ALL = "__all__";
const YEARS = [2025, 2026] as const;

export default function FinancesPage() {
  const locale = useLocale();
  const t = useTranslations("finances");
  const { artistId, focusedArtistId, isLabel, setFocusedArtistId } = useRole();

  const [year, setYear] = useState<number>(2026);
  const [category, setCategory] = useState<string>(ALL);
  const [projectId, setProjectId] = useState<string>(ALL);
  /** Dépenses saisies à la main dans la session (préfixées au registre). */
  const [added, setAdded] = useState<Expense[]>([]);

  // Périmètre artistes : label sans zoom = tout le roster.
  const scopeAll = isLabel && !focusedArtistId;
  const artistIds = useMemo(
    () => (scopeAll ? ARTISTS.map((a) => a.id) : [artistId]),
    [scopeAll, artistId],
  );
  const focusedArtist = scopeAll ? null : getArtist(artistId);

  const projectOptions = useMemo(
    () =>
      scopeAll ? PROJECTS : PROJECTS.filter((p) => p.artistId === artistId),
    [scopeAll, artistId],
  );

  /* ── Dépenses filtrées (générées + saisies en session) ─────────────── */
  const filteredExpenses = useMemo(() => {
    const base = fetchExpenses({
      artistId: scopeAll ? undefined : artistId,
      year,
      category: category === ALL ? undefined : (category as ExpenseCategory),
      projectId: projectId === ALL ? undefined : projectId,
    });
    const manual = added.filter(
      (e) =>
        artistIds.includes(e.artistId) &&
        e.date.startsWith(String(year)) &&
        (category === ALL || e.category === category) &&
        (projectId === ALL || e.projectId === projectId),
    );
    return [...manual, ...base];
  }, [scopeAll, artistId, artistIds, year, category, projectId, added]);

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses],
  );

  /* ── Revenus + série mensuelle (année filtrée) ─────────────────────── */
  const { totalRevenueYear, monthly } = useMemo(() => {
    const revByMonth = new Map<string, number>();
    for (const id of artistIds) {
      for (const m of monthlyRevenueTotals(id, 24)) {
        if (!m.month.startsWith(String(year))) continue;
        revByMonth.set(m.month, (revByMonth.get(m.month) ?? 0) + m.amount);
      }
    }
    const expByMonth = new Map<string, number>();
    for (const e of filteredExpenses) {
      const mo = e.date.slice(0, 7);
      expByMonth.set(mo, (expByMonth.get(mo) ?? 0) + e.amount);
    }
    const months = Array.from(
      new Set([...revByMonth.keys(), ...expByMonth.keys()]),
    ).sort();
    const series: MonthlyPnlPoint[] = months.map((month) => {
      const revenue = revByMonth.get(month) ?? 0;
      const exp = expByMonth.get(month) ?? 0;
      return { month, revenue, expenses: exp, net: revenue - exp };
    });
    return {
      totalRevenueYear: series.reduce((s, m) => s + m.revenue, 0),
      monthly: series,
    };
  }, [artistIds, year, filteredExpenses]);

  const net = totalRevenueYear - totalExpenses;
  const margin = totalRevenueYear === 0 ? 0 : (net / totalRevenueYear) * 100;

  /* ── P&L par année (deltas KPI + onglet "Par année") ───────────────── */
  const yearAgg = useMemo(() => {
    const acc = new Map<number, YearPnlRow>();
    for (const id of artistIds) {
      for (const row of pnlByYear(id)) {
        const cur = acc.get(row.year) ?? {
          year: row.year,
          revenue: 0,
          expenses: 0,
          net: 0,
        };
        cur.revenue += row.revenue;
        cur.expenses += row.expenses;
        cur.net += row.net;
        acc.set(row.year, cur);
      }
    }
    return Array.from(acc.values()).sort((a, b) => a.year - b.year);
  }, [artistIds]);

  const prevYearRow = yearAgg.find((r) => r.year === year - 1);
  const deltaPct = (cur: number, prev?: number) =>
    prev && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  /* ── Donut catégories ──────────────────────────────────────────────── */
  const byCategory = useMemo(() => {
    const acc = new Map<ExpenseCategory, number>();
    for (const e of filteredExpenses) {
      acc.set(e.category, (acc.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(acc.entries()).map(([cat, amount]) => ({
      category: cat,
      amount,
    }));
  }, [filteredExpenses]);

  /* ── Comparaisons par projet / titre ───────────────────────────────── */
  const { byProject, byTrack } = useMemo(() => {
    const projTitle = new Map(PROJECTS.map((p) => [p.id, p.title]));
    const trkTitle = new Map(TRACKS.map((tr) => [tr.id, tr.title]));
    const proj = new Map<string, number>();
    const trk = new Map<string, number>();
    for (const e of filteredExpenses) {
      if (e.projectId)
        proj.set(e.projectId, (proj.get(e.projectId) ?? 0) + e.amount);
      if (e.trackId) trk.set(e.trackId, (trk.get(e.trackId) ?? 0) + e.amount);
    }
    const toRows = (
      m: Map<string, number>,
      titles: Map<string, string>,
    ): SpendRow[] =>
      Array.from(m.entries())
        .map(([id, amount]) => ({ id, name: titles.get(id) ?? id, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);
    return {
      byProject: toRows(proj, projTitle),
      byTrack: toRows(trk, trkTitle),
    };
  }, [filteredExpenses]);

  /* ── Sparklines KPI ────────────────────────────────────────────────── */
  const revSpark = monthly.map((m) => ({ value: m.revenue }));
  const expSpark = monthly.map((m) => ({ value: m.expenses }));
  const netSpark = monthly.map((m) => ({ value: m.net }));

  const wavelyCount = useMemo(
    () => filteredExpenses.filter((e) => e.source === "wavely").length,
    [filteredExpenses],
  );

  /* ── Export CSV du registre filtré, tel qu'affiché ─────────────────── */
  const exportExpensesCsv = () => {
    const projectTitle = new Map(PROJECTS.map((p) => [p.id, p.title]));
    const trackTitle = new Map(TRACKS.map((tr) => [tr.id, tr.title]));
    const memberName = new Map(TEAM.map((m) => [m.id, m.name]));
    downloadCsv<Expense>(`day1-expenses-${year}`, filteredExpenses, [
      { header: t("register.date"), cell: (e) => e.date },
      { header: t("register.label"), cell: (e) => e.label },
      {
        header: t("register.category"),
        cell: (e) => t(`categories.${e.category}`),
      },
      {
        header: t("register.project"),
        cell: (e) => (e.projectId ? (projectTitle.get(e.projectId) ?? "") : ""),
      },
      {
        header: t("register.track"),
        cell: (e) => (e.trackId ? (trackTitle.get(e.trackId) ?? "") : ""),
      },
      { header: t("register.amount"), cell: (e) => e.amount },
      {
        header: t("register.addedBy"),
        cell: (e) => memberName.get(e.addedBy) ?? e.addedBy,
      },
      {
        header: t("register.source"),
        cell: (e) =>
          e.source === "wavely" ? t("register.wavely") : t("register.manual"),
      },
    ]);
  };

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader
        title={t("title")}
        subtitle={
          focusedArtist
            ? t("subtitle")
            : `${t("subtitle")} — ${t("scope.roster")}`
        }
      >
        <ExportMenu
          label={t("export.button")}
          csvLabel={t("export.csv")}
          printLabel={t("export.print")}
          onExportCsv={exportExpensesCsv}
        />
        <AddExpenseDialog
          isLabel={isLabel}
          defaultArtistId={artistId}
          onAdd={(e) => setAdded((prev) => [e, ...prev])}
        />
      </PageHeader>

      {/* ── Barre de filtres ──────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger size="sm" className="w-28" aria-label={t("filters.year")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)} className="num">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLabel && (
          <Select
            value={focusedArtistId ?? ALL}
            onValueChange={(v) => {
              setFocusedArtistId(v === ALL ? null : v);
              setProjectId(ALL);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-44"
              aria-label={t("filters.artist")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allArtists")}</SelectItem>
              {ARTISTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger
            size="sm"
            className="w-44"
            aria-label={t("filters.category")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allCategories")}</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`categories.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger
            size="sm"
            className="w-48"
            aria-label={t("filters.project")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allProjects")}</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {focusedArtist && (
          <ArtistBadge artist={focusedArtist} size="sm" className="ml-auto" />
        )}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          id="fin-expenses"
          label={t("kpis.expenses", { year })}
          value={totalExpenses}
          format="eur"
          delta={deltaPct(totalExpenses, prevYearRow?.expenses)}
          deltaLabel={
            prevYearRow ? t("kpis.vsPrevYear", { year: year - 1 }) : undefined
          }
          spark={expSpark}
          sparkColor="var(--chart-4)"
        />
        <KpiCard
          id="fin-revenue"
          label={t("kpis.revenue", { year })}
          value={totalRevenueYear}
          format="eur"
          delta={deltaPct(totalRevenueYear, prevYearRow?.revenue)}
          deltaLabel={
            prevYearRow ? t("kpis.vsPrevYear", { year: year - 1 }) : undefined
          }
          spark={revSpark}
          sparkColor="var(--chart-1)"
        />
        <KpiCard
          id="fin-net"
          label={t("kpis.net")}
          value={net}
          format="eur"
          hero
          delta={deltaPct(net, prevYearRow?.net)}
          deltaLabel={
            prevYearRow ? t("kpis.vsPrevYear", { year: year - 1 }) : undefined
          }
          spark={netSpark}
          sparkColor="var(--chart-2)"
        />
        <KpiCard
          id="fin-margin"
          label={t("kpis.margin")}
          value={margin}
          format="pct"
          deltaLabel={t("kpis.marginHint")}
        />
      </div>

      {/* ── Chart mensuel + donut ─────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">{t("chart.title", { year })}</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("chart.subtitle")}
          </p>
          <PnlMonthlyChart data={monthly} />
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {(
              [
                ["revenue", "var(--chart-1)"],
                ["expenses", "var(--chart-4)"],
                ["net", "var(--chart-2)"],
              ] as const
            ).map(([key, color]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: color }}
                />
                {t(`chart.${key}`)}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">{t("donut.title")}</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {t("donut.subtitle")}
          </p>
          <CategoryDonut data={byCategory} />
        </section>
      </div>

      {/* ── Comparaisons ──────────────────────────────────────────────── */}
      <section className="mb-6 rounded-xl border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{t("compare.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("compare.subtitle")}
            </p>
          </div>
          {focusedArtist && (
            <span className="num text-xs text-muted-foreground">
              {focusedArtist.name} · {fmtPct(locale, margin, 0)}
            </span>
          )}
        </div>
        <PnlComparisons byYear={yearAgg} byProject={byProject} byTrack={byTrack} />
      </section>

      {/* ── Registre + Wavely ─────────────────────────────────────────── */}
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_300px]">
        <ExpenseRegister items={filteredExpenses} />
        <WavelyCard syncedCount={wavelyCount} />
      </div>
    </div>
  );
}

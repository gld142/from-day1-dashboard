"use client";

/**
 * Revenus — la vue consolidée multi-sources. Le module "qui fait tomber
 * le voile" : chaque euro, d'où qu'il vienne, lisible et comparé.
 */

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AudioLines,
  Clapperboard,
  Landmark,
  Mic2,
  PieChart as PieIcon,
  Radio,
  Scale,
  Shirt,
} from "lucide-react";
import {
  ARTISTS,
  ESTIMATE_PERIODS,
  dspEstimates,
  estimateSummaries,
  getArtist,
  hasReal,
  monthlyRevenueTotals,
  pnlByArtist,
  revenueBySource,
  revenueSeries,
  rosterDspEstimates,
  rosterEstimateSummaries,
} from "@/lib/demo/api";
import type { DspEstimate, EstimatePeriod, EstimateSummary } from "@/lib/demo/api";
import type { RevenueSource } from "@/lib/demo/types";
import { REVENUE_SOURCES } from "@/lib/demo/types";
import { downloadCsv, round2 } from "@/lib/export";
import { artistColor, fmtCompact, fmtEur, fmtMonth, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { useUrlParam } from "@/lib/url-param";
import { useSharesSnapshot } from "@/lib/userdata/use-shares";
import { cn } from "@/lib/utils";
import { DeltaChip, KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { SharesPanel } from "@/components/modules/finances/shares-panel";
import { EstimateBoard } from "@/components/modules/pilotage/estimate-board";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOURCE_COLOR: Record<RevenueSource, string> = {
  streaming: "var(--chart-1)",
  sacem: "var(--chart-2)",
  neighboring: "var(--chart-3)",
  spre: "var(--chart-5)",
  sync: "var(--chart-4)",
  live: "var(--chart-2)",
  merch: "var(--chart-3)",
};

const SOURCE_ICON: Record<
  RevenueSource,
  React.ComponentType<{ className?: string }>
> = {
  streaming: AudioLines,
  sacem: Scale,
  neighboring: Mic2,
  spre: Radio,
  sync: Clapperboard,
  live: Landmark,
  merch: Shirt,
};

const STACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-2)",
  "var(--chart-3)",
];

/** `?period=` : une des cinq périodes de l'estimateur, sinon null. */
function parsePeriod(raw: string | null): EstimatePeriod | null {
  return ESTIMATE_PERIODS.includes(raw as EstimatePeriod) ? (raw as EstimatePeriod) : null;
}

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

export default function RevenuePage() {
  const t = useTranslations("revenue");
  const tDsp = useTranslations("streams.dsp.names");
  const locale = useLocale();
  const { persona, artistId, isLabel, focusedArtistId, setFocusedArtistId } =
    useRole();
  const aggregated = isLabel && !focusedArtistId;

  /* Période de l'estimation, portée par l'URL (?period=) : le lien « Voir le
   * détail » de Pulse et un rechargement retombent sur la même vue. */
  const [period, setUrlPeriod] = useUrlParam("period", parsePeriod, "month");
  const setPeriod = useCallback(
    (v: string) => setUrlPeriod(v as EstimatePeriod),
    [setUrlPeriod],
  );

  const data = useMemo(() => {
    const ids = aggregated ? ARTISTS.map((a) => a.id) : [artistId];

    // Série mensuelle empilée par source (24 mois).
    const byMonth = new Map<string, Record<string, number>>();
    for (const id of ids) {
      for (const p of revenueSeries(id, 24)) {
        const row = byMonth.get(p.month) ?? {};
        row[p.source] = (row[p.source] ?? 0) + p.amount;
        byMonth.set(p.month, row);
      }
    }
    const stacked = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, sources]) => ({ month, ...sources }));

    // Totaux par source (12 mois).
    const bySource = new Map<RevenueSource, number>();
    for (const id of ids) {
      for (const r of revenueBySource(id, 12)) {
        bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.amount);
      }
    }
    const sources = Array.from(bySource.entries())
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount);
    const total12 = sources.reduce((s, r) => s + r.amount, 0);

    // Delta vs les 12 mois précédents.
    let prev12 = 0;
    let cur12 = 0;
    for (const id of ids) {
      const months = monthlyRevenueTotals(id, 24);
      prev12 += months.slice(0, 12).reduce((s, m) => s + m.amount, 0);
      cur12 += months.slice(12).reduce((s, m) => s + m.amount, 0);
    }
    const delta = prev12 === 0 ? 0 : ((cur12 - prev12) / prev12) * 100;

    // Tendance par source : 2e semestre vs 1er semestre (12 mois).
    const trendBySource = new Map<RevenueSource, number>();
    for (const source of REVENUE_SOURCES) {
      let first = 0;
      let second = 0;
      for (const id of ids) {
        const pts = revenueSeries(id, 12).filter((p) => p.source === source);
        const months = Array.from(new Set(pts.map((p) => p.month))).sort();
        const firstHalf = new Set(months.slice(0, Math.floor(months.length / 2)));
        for (const p of pts) {
          if (firstHalf.has(p.month)) first += p.amount;
          else second += p.amount;
        }
      }
      trendBySource.set(source, first === 0 ? 0 : ((second - first) / first) * 100);
    }

    return {
      stacked,
      sources,
      total12,
      delta,
      trendBySource,
      monthlyAvg: total12 / 12,
      pnl: aggregated ? pnlByArtist(12) : [],
      spark: monthlyRevenueTotals(ids[0], 24)
        .slice(-12)
        .map((m) => ({ value: m.amount })),
    };
  }, [aggregated, artistId]);

  /* ── Estimation live (couche réelle) : l'artiste en focus, ou le roster ────
   * Les parts renseignées (panneau « Ta part ») changent les cascades : la clé
   * du store est une dépendance, le memo se recalcule à chaque enregistrement. */
  const sharesKey = useSharesSnapshot();
  const est = useMemo<Record<EstimatePeriod, EstimateSummary> | null>(() => {
    void sharesKey;
    if (aggregated) return rosterEstimateSummaries();
    return hasReal(artistId) ? estimateSummaries(artistId) : null;
  }, [aggregated, artistId, sharesKey]);

  /* Par plateforme sur la période choisie : streams, brut master (mid),
   * provenance la plus faible, taux effectif €/stream — la somme des lignes
   * retombe sur le brut master de la tuile correspondante. */
  const byDsp = useMemo<DspEstimate[]>(() => {
    if (aggregated) return rosterDspEstimates(period);
    return hasReal(artistId) ? dspEstimates(artistId, period) : [];
  }, [aggregated, artistId, period]);

  const fmtRate = (rate: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(rate);

  const topShare =
    data.total12 === 0 ? 0 : (data.sources[0]?.amount ?? 0) / data.total12;
  const focused = focusedArtistId ? getArtist(focusedArtistId) : null;

  /* ── Export CSV mensuel par source (24 mois) ───────────────────────── */
  const exportMonthlyCsv = () => {
    const rows = data.stacked.flatMap((entry) =>
      REVENUE_SOURCES.flatMap((source) => {
        const amount = (entry as Record<string, string | number>)[source];
        return typeof amount === "number"
          ? [{ month: entry.month, source, amount }]
          : [];
      }),
    );
    downloadCsv("day1-revenue-24m", rows, [
      { header: t("export.month"), cell: (r) => r.month },
      { header: t("breakdown.source"), cell: (r) => t(`sources.${r.source}`) },
      { header: t("breakdown.amount"), cell: (r) => round2(r.amount) },
    ]);
  };

  return (
    <div>
      <PrintStyles />
      <PageHeader
        title={t("title")}
        subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}
      >
        {focused && <ArtistBadge artist={focused} size="md" />}
        <ExportMenu
          label={t("export.button")}
          csvLabel={t("export.csv")}
          printLabel={t("export.print")}
          onExportCsv={exportMonthlyCsv}
        />
      </PageHeader>

      {/* Estimation live — fourchettes jour / semaine / mois / année, la période
          choisie en relief. Le sélecteur pilote aussi le tableau par plateforme. */}
      {est && (
        <EstimateBoard
          className="rise-in mb-4"
          summaries={est}
          line={persona === "artist" ? "artistShare" : "grossMaster"}
          focus={period}
          title={aggregated ? t("estimate.titleLabel") : t("estimate.title")}
          subtitle={t("estimate.subtitle")}
          actions={
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList aria-label={t("estimate.selectPeriod")}>
                {ESTIMATE_PERIODS.map((p) => (
                  <TabsTrigger key={p} value={p} className="num text-xs">
                    {t(`estimate.period.${p}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
        />
      )}

      {/* Ta part, c'est ton contrat — un artiste (persona artiste ou label zoomé),
          jamais le roster agrégé : les pourcentages sont propres à chacun. */}
      {est && !aggregated && (
        <SharesPanel className="rise-in mb-4" artistId={artistId} gross={est.day.grossMaster.mid} />
      )}

      {/* Par plateforme · période — provenance, volume, taux effectif, brut */}
      {byDsp.length > 0 && (
        <section className="rise-in mb-4 rounded-xl border bg-card p-5">
          <h2 className="font-heading text-base font-semibold tracking-tight">
            {t("estimate.byDspPeriod", { period: t(`estimate.period.${period}`) })}
          </h2>
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>{t("estimate.colPlatform")}</TableHead>
                <TableHead>{t("estimate.colProvenance")}</TableHead>
                <TableHead className="text-right">{t("estimate.colStreams")}</TableHead>
                <TableHead className="text-right">{t("estimate.colRate")}</TableHead>
                <TableHead className="text-right">{t("estimate.colGross")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDsp.map((row) => (
                <TableRow key={row.dsp}>
                  <TableCell className="font-medium">{tDsp(row.dsp)}</TableCell>
                  <TableCell>
                    <ProvenanceBadge provenance={row.provenance} />
                  </TableCell>
                  <TableCell className="num text-right">
                    {fmtCompact(locale, row.streams)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {t("estimate.dspRate", { rate: fmtRate(row.rate) })}
                  </TableCell>
                  <TableCell className="num text-right font-semibold">
                    {fmtEur(locale, row.gross)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* KPIs */}
      <div className="rise-in grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          id="rev-total"
          label={t("kpis.total12m")}
          value={data.total12}
          format="eur"
          delta={data.delta}
          deltaLabel={t("kpis.vsPrevYear")}
          spark={data.spark}
          hero
        />
        <KpiCard
          id="rev-avg"
          label={t("kpis.monthlyAvg")}
          value={Math.round(data.monthlyAvg)}
          format="eur"
        />
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("kpis.topSource")}
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            {data.sources[0] ? t(`sources.${data.sources[0].source}`) : "—"}
          </span>
          <span className="num text-xs text-muted-foreground">
            {fmtPct(locale, topShare * 100, 0)}
          </span>
        </div>
        <div className="flex flex-col justify-between gap-1 rounded-xl border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("breakdown.title")}
          </span>
          <p className="text-[13px] leading-snug">
            {t("insight.diversification", {
              count: data.sources.filter((s) => s.amount > 0).length,
              top: data.sources[0] ? t(`sources.${data.sources[0].source}`) : "—",
              share: fmtPct(locale, topShare * 100, 0),
            })}
          </p>
          <p
            className={cn(
              "text-xs",
              topShare > 0.7 ? "text-warning" : "text-success",
            )}
          >
            {topShare > 0.7 ? t("insight.concentrated") : t("insight.balanced")}
          </p>
        </div>
      </div>

      {/* Chart empilé par source */}
      <section className="rise-in mt-4 rounded-xl border bg-card p-5">
        <div className="mb-4">
          <h2 className="font-heading text-base font-semibold">{t("chart.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("chart.subtitle")}</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data.stacked}
              margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
            >
              <defs>
                {REVENUE_SOURCES.map((s, i) => (
                  <linearGradient key={s} id={`rev-${s}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STACK_COLORS[i]} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={STACK_COLORS[i]} stopOpacity={0.08} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.07} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(m: string) => fmtMonth(locale, m)}
                interval={3}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => fmtEur(locale, v, { compact: true })}
                width={64}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [
                  fmtEur(locale, Number(value)),
                  t(`sources.${name as RevenueSource}`),
                ]}
                labelFormatter={(m) => fmtMonth(locale, String(m))}
              />
              {REVENUE_SOURCES.map((s, i) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stackId="rev"
                  stroke={STACK_COLORS[i]}
                  strokeWidth={1.5}
                  fill={`url(#rev-${s})`}
                  animationDuration={600}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Donut */}
        <section className="rise-in rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 font-heading text-base font-semibold">
            <PieIcon className="size-4 text-brand" aria-hidden />
            {t("breakdown.title")}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("breakdown.period12m")}
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.sources}
                  dataKey="amount"
                  nameKey="source"
                  innerRadius="62%"
                  outerRadius="90%"
                  paddingAngle={2}
                  strokeWidth={0}
                  animationDuration={600}
                >
                  {data.sources.map((s) => (
                    <Cell key={s.source} fill={SOURCE_COLOR[s.source]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [
                    fmtEur(locale, Number(value)),
                    t(`sources.${name as RevenueSource}`),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Liste par source */}
        <section className="rise-in rounded-xl border bg-card p-5 lg:col-span-3">
          <h2 className="mb-3 font-heading text-base font-semibold">
            {t("breakdown.source")}
          </h2>
          <ul className="flex flex-col">
            {data.sources.map((s) => {
              const Icon = SOURCE_ICON[s.source];
              const share =
                data.total12 === 0 ? 0 : (s.amount / data.total12) * 100;
              const trend = data.trendBySource.get(s.source) ?? 0;
              return (
                <li
                  key={s.source}
                  className="hairline-b flex items-center gap-3 py-2.5 last:shadow-none"
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: `color-mix(in oklch, ${SOURCE_COLOR[s.source]} 15%, transparent)`,
                    }}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {t(`sources.${s.source}`)}
                    </p>
                    {/* La description s'enroule sur deux lignes plutôt que d'être tronquée. */}
                    <p className="text-xs leading-snug text-muted-foreground">
                      {t(`sourceDescriptions.${s.source}`)}
                    </p>
                  </div>
                  <DeltaChip value={trend} />
                  <span className="num w-14 text-right text-xs text-muted-foreground">
                    {fmtPct(locale, share, 0)}
                  </span>
                  <span className="num w-24 text-right text-sm font-semibold">
                    {fmtEur(locale, s.amount, { compact: true })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Vue label : revenus par artiste */}
      {aggregated && (
        <section className="rise-in mt-4 rounded-xl border bg-card p-5">
          <h2 className="font-heading text-base font-semibold">
            {t("byArtist.title")}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">{t("byArtist.subtitle")}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.pnl.map((p) => ({
                  ...p,
                  name: getArtist(p.artistId).name,
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <CartesianGrid vertical={false} strokeOpacity={0.07} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => fmtEur(locale, v, { compact: true })}
                  width={64}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [
                    fmtEur(locale, Number(value)),
                    t("kpis.total12m"),
                  ]}
                  cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} animationDuration={600}>
                  {data.pnl.map((p) => (
                    <Cell
                      key={p.artistId}
                      fill={artistColor(getArtist(p.artistId).hue)}
                      cursor="pointer"
                      onClick={() => setFocusedArtistId(p.artistId)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.pnl.map((p) => {
              const a = getArtist(p.artistId);
              return (
                <li key={p.artistId}>
                  <button
                    onClick={() => setFocusedArtistId(p.artistId)}
                    className="flex w-full items-center gap-2 rounded-lg border bg-surface-2 p-2.5 text-left transition-colors hover:border-brand/40"
                  >
                    <ArtistBadge artist={a} size="sm" meta={a.genre} className="flex-1" />
                    <span className="text-right">
                      <span className="num block text-sm font-semibold">
                        {fmtEur(locale, p.revenue, { compact: true })}
                      </span>
                      <span
                        className={cn(
                          "num block text-xs",
                          p.net >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {t("byArtist.net")} {fmtEur(locale, p.net, { compact: true })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

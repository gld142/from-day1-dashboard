"use client";

/**
 * Revenus — la vue consolidée multi-sources. Le module "qui fait tomber
 * le voile" : chaque euro, d'où qu'il vienne, lisible et comparé.
 */

import { useMemo } from "react";
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
  getArtist,
  monthlyRevenueTotals,
  pnlByArtist,
  revenueBySource,
  revenueSeries,
} from "@/lib/demo/api";
import type { RevenueSource } from "@/lib/demo/types";
import { REVENUE_SOURCES } from "@/lib/demo/types";
import { artistColor, fmtEur, fmtMonth, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { DeltaChip, KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";

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

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

export default function RevenuePage() {
  const t = useTranslations("revenue");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId, setFocusedArtistId } = useRole();
  const aggregated = isLabel && !focusedArtistId;

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

  const topShare =
    data.total12 === 0 ? 0 : (data.sources[0]?.amount ?? 0) / data.total12;
  const focused = focusedArtistId ? getArtist(focusedArtistId) : null;

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}
      >
        {focused && <ArtistBadge artist={focused} size="md" />}
      </PageHeader>

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
          <span className="num text-[11px] text-muted-foreground">
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
              "text-[11px]",
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
                    <p className="truncate text-[11px] text-muted-foreground">
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
                          "num block text-[11px]",
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

"use client";

/**
 * Revenue Calculator — projection de revenus 6/12/24 mois.
 * Paramètres à gauche, résultats (chart, KPIs, table, donut) à droite.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import NumberFlow from "@number-flow/react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { DeltaChip, KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  ForecastChart,
  type ForecastChartPoint,
} from "@/components/modules/calculator/forecast-chart";
import {
  ForecastTable,
  type ForecastRow,
} from "@/components/modules/calculator/forecast-table";
import { MethodologyCard } from "@/components/modules/calculator/methodology-card";
import {
  SourceDonut,
  type SourceSlice,
} from "@/components/modules/calculator/source-donut";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ARTISTS,
  getArtist,
  revenueBySource,
  revenueForecast,
} from "@/lib/demo/api";
import { fmtEur, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";

const HORIZONS = [6, 12, 24] as const;

type Scenario = "none" | "single" | "ep" | "album";
const SCENARIO_BOOST: Record<Scenario, number> = {
  none: 0,
  single: 0.04,
  ep: 0.09,
  album: 0.18,
};
const SCENARIOS: Scenario[] = ["none", "single", "ep", "album"];

export default function CalculatorPage() {
  const locale = useLocale();
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  const { artistId, isLabel } = useRole();

  const [localArtistId, setLocalArtistId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<number>(12);
  const [scenario, setScenario] = useState<Scenario>("none");
  /** Ajustement de croissance en points de % mensuels (-5 → +15). */
  const [growthAdj, setGrowthAdj] = useState<number>(0);

  const effectiveArtistId = isLabel ? (localArtistId ?? artistId) : artistId;
  const artist = getArtist(effectiveArtistId);

  const growthDelta = SCENARIO_BOOST[scenario] + growthAdj / 100;
  const effectiveGrowth = artist.growthRate + growthDelta;

  /* ── Projection ────────────────────────────────────────────────────── */
  const forecast = useMemo(
    () => revenueForecast(effectiveArtistId, { growthDelta, horizon }),
    [effectiveArtistId, growthDelta, horizon],
  );

  const chartData = useMemo<ForecastChartPoint[]>(() => {
    const lastActualIdx = forecast.reduce(
      (idx, p, i) => (p.actual !== null ? i : idx),
      -1,
    );
    return forecast.map((p, i) => {
      // Raccord visuel : la projection démarre sur le dernier point réel.
      if (i === lastActualIdx && p.actual !== null) {
        return {
          month: p.month,
          actual: p.actual,
          projected: p.actual,
          band: [p.actual, p.actual] as [number, number],
        };
      }
      return {
        month: p.month,
        actual: p.actual,
        projected: p.projected,
        band:
          p.low !== null && p.high !== null
            ? ([p.low, p.high] as [number, number])
            : null,
      };
    });
  }, [forecast]);

  const projRows = useMemo<ForecastRow[]>(
    () =>
      forecast
        .filter((p) => p.projected !== null)
        .map((p) => ({
          month: p.month,
          low: p.low ?? 0,
          projected: p.projected ?? 0,
          high: p.high ?? 0,
        })),
    [forecast],
  );

  const { totalProjected, totalLow, totalHigh, monthlyAvg, deltaVsPast } =
    useMemo(() => {
      const totalProjected = projRows.reduce((s, r) => s + r.projected, 0);
      const totalLow = projRows.reduce((s, r) => s + r.low, 0);
      const totalHigh = projRows.reduce((s, r) => s + r.high, 0);
      const monthlyAvg = projRows.length ? totalProjected / projRows.length : 0;
      const actuals = forecast.filter((p) => p.actual !== null);
      const pastSame = actuals
        .slice(-Math.min(horizon, actuals.length))
        .reduce((s, p) => s + (p.actual ?? 0), 0);
      const deltaVsPast =
        pastSame === 0 ? 0 : ((totalProjected - pastSame) / pastSame) * 100;
      return { totalProjected, totalLow, totalHigh, monthlyAvg, deltaVsPast };
    }, [projRows, forecast, horizon]);

  /* ── Répartition par source appliquée au projeté ───────────────────── */
  const sourceSlices = useMemo<SourceSlice[]>(() => {
    const last12 = revenueBySource(effectiveArtistId, 12);
    const base = last12.reduce((s, r) => s + r.amount, 0);
    if (base === 0) return [];
    return last12.map((r) => ({
      source: r.source,
      amount: Math.round((r.amount / base) * totalProjected),
    }));
  }, [effectiveArtistId, totalProjected]);

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <ArtistBadge artist={artist} size="sm" />
      </PageHeader>

      <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
        {/* ── Colonne paramètres ──────────────────────────────────────── */}
        <aside className="rounded-xl border bg-card p-5 lg:sticky lg:top-4">
          <h2 className="text-sm font-semibold">{t("params.title")}</h2>
          <p className="mb-5 text-xs text-muted-foreground">
            {t("params.subtitle")}
          </p>

          <div className="space-y-5">
            {isLabel && (
              <div className="grid gap-2">
                <Label>{t("params.artist")}</Label>
                <Select
                  value={effectiveArtistId}
                  onValueChange={setLocalArtistId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARTISTS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>{t("params.horizon")}</Label>
              <Tabs
                value={String(horizon)}
                onValueChange={(v) => setHorizon(Number(v))}
              >
                <TabsList className="w-full">
                  {HORIZONS.map((h) => (
                    <TabsTrigger key={h} value={String(h)} className="num flex-1">
                      {t("params.months", { count: h })}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-2">
              <Label>{t("params.scenario")}</Label>
              <Select
                value={scenario}
                onValueChange={(v) => setScenario(v as Scenario)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`params.scenarios.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="num text-xs text-muted-foreground">
                {scenario === "none"
                  ? t("params.scenarioNone")
                  : t("params.scenarioBoost", {
                      points: SCENARIO_BOOST[scenario] * 100,
                    })}
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="growth-adj">{t("params.growth")}</Label>
                <span className="num text-sm font-semibold text-brand">
                  <NumberFlow
                    value={growthAdj}
                    locales={locale}
                    format={{ signDisplay: "exceptZero", maximumFractionDigits: 1 }}
                    suffix=" pts"
                  />
                </span>
              </div>
              <input
                id="growth-adj"
                type="range"
                min={-5}
                max={15}
                step={0.5}
                value={growthAdj}
                onChange={(e) => setGrowthAdj(Number(e.target.value))}
                className="w-full accent-brand"
              />
              <p className="text-xs text-muted-foreground">
                {t("params.growthHint")}
              </p>
            </div>

            <div className="space-y-1 rounded-lg bg-surface-2 p-3 text-xs">
              <p className="flex items-center justify-between text-muted-foreground">
                <span>{t("params.baseGrowth")}</span>
                <span className="num font-medium text-foreground">
                  {fmtPct(locale, artist.growthRate * 100)}
                  {tCommon("units.perMonth")}
                </span>
              </p>
              <p className="flex items-center justify-between text-muted-foreground">
                <span>{t("params.effectiveGrowth")}</span>
                <span className="num font-semibold text-brand">
                  {fmtPct(locale, effectiveGrowth * 100)}
                  {tCommon("units.perMonth")}
                </span>
              </p>
            </div>
          </div>
        </aside>

        {/* ── Colonne résultats ───────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              id="calc-total"
              label={t("kpis.projectedTotal", { count: horizon })}
              value={totalProjected}
              format="eur"
              hero
            />
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">
                {t("kpis.range")}
              </span>
              <span className="num text-lg font-semibold tracking-tight">
                {fmtEur(locale, totalLow, { compact: true })}
                <span className="mx-1 text-muted-foreground">–</span>
                {fmtEur(locale, totalHigh, { compact: true })}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("kpis.rangeHint")}
              </span>
            </div>
            <KpiCard
              id="calc-monthly"
              label={t("kpis.monthlyAvg")}
              value={monthlyAvg}
              format="eur"
            />
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">
                {t("kpis.delta", { count: horizon })}
              </span>
              <span className="num text-2xl font-semibold tracking-tight">
                <DeltaChip value={deltaVsPast} className="text-sm" />
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("kpis.deltaHint")}
              </span>
            </div>
          </div>

          <section className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{t("chart.title")}</h2>
                <p className="text-xs text-muted-foreground">
                  {t("chart.subtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-0.5 w-4 rounded-full"
                    style={{ background: "var(--chart-1)" }}
                  />
                  {t("chart.actual")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-0.5 w-4 rounded-full"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, var(--chart-2) 60%, transparent 60%)",
                      backgroundSize: "6px 100%",
                    }}
                  />
                  {t("chart.projected")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-4 rounded-sm"
                    style={{ background: "var(--chart-1)", opacity: 0.15 }}
                  />
                  {t("chart.band")}
                </span>
              </div>
            </div>
            <ForecastChart data={chartData} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border bg-card pb-1">
              <h2 className="border-b p-5 pb-4 text-sm font-semibold">
                {t("table.title")}
              </h2>
              <ForecastTable rows={projRows} />
            </section>

            <div className="space-y-4">
              <section className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold">{t("donut.title")}</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  {t("donut.subtitle")}
                </p>
                <SourceDonut data={sourceSlices} />
              </section>
              <MethodologyCard horizon={horizon} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

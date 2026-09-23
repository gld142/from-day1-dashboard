"use client";

/**
 * /calculator — le simulateur de revenus. Refondu le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Une seule question : **combien dans six, douze ou vingt-quatre mois**. Le
 * total projeté se pose au centre de sa propre courbe, les hypothèses vivent
 * juste dessous, et rien d'autre n'encombre.
 *
 * Deux blocs de l'ancienne page disparaissent :
 *  - la répartition projetée par source appliquait les proportions des douze
 *    derniers mois au total projeté. Elle ne disait donc rien que /revenue ne
 *    dise déjà mieux, en mesuré — elle devient une porte.
 *  - la carte « méthodologie » prenait la place d'un bloc de données pour du
 *    texte qu'on lit une fois : elle se replie.
 *
 * En vue label sans zoom, la projection somme celle de chaque artiste : le même
 * ajustement de croissance s'applique à tous, et les fourchettes s'additionnent.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import NumberFlow from "@number-flow/react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  CenteredValue,
  Sheet,
  SheetHeading,
  SheetSegments,
} from "@/components/dashboard/sheet";
import {
  ForecastChart,
  type ForecastChartPoint,
} from "@/components/modules/calculator/forecast-chart";
import {
  ForecastTable,
  type ForecastRow,
} from "@/components/modules/calculator/forecast-table";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
import { Label } from "@/components/ui/label";
import {
  ARTISTS,
  getArtist,
  monthlyRevenueTotals,
  revenueForecast,
} from "@/lib/demo/api";
import type { ForecastPoint } from "@/lib/demo/api";
import { fmtEur, fmtInt, fmtMonth, fmtPct } from "@/lib/format";
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

/** Somme de plusieurs projections mois par mois — la vue roster. */
function mergeForecasts(series: ForecastPoint[][]): ForecastPoint[] {
  const acc = new Map<string, ForecastPoint>();
  for (const one of series) {
    for (const p of one) {
      const cur = acc.get(p.month);
      if (!cur) {
        acc.set(p.month, { ...p });
        continue;
      }
      const add = (a: number | null, b: number | null) =>
        a === null && b === null ? null : (a ?? 0) + (b ?? 0);
      acc.set(p.month, {
        month: p.month,
        actual: add(cur.actual, p.actual),
        projected: add(cur.projected, p.projected),
        low: add(cur.low, p.low),
        high: add(cur.high, p.high),
      });
    }
  }
  return Array.from(acc.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export default function CalculatorPage() {
  const locale = useLocale();
  const t = useTranslations("calculator");
  const tc = useTranslations("common");
  const { artistId, focusedArtistId, isLabel } = useRole();

  const [horizon, setHorizon] = useState<number>(12);
  const [scenario, setScenario] = useState<Scenario>("none");
  /** Ajustement de croissance en points de % mensuels (-5 → +15). */
  const [growthAdj, setGrowthAdj] = useState<number>(0);

  const aggregated = isLabel && !focusedArtistId;
  const ids = useMemo(
    () => (aggregated ? ARTISTS.map((a) => a.id) : [artistId]),
    [aggregated, artistId],
  );
  const focusedArtist = isLabel && focusedArtistId ? getArtist(focusedArtistId) : null;

  const growthDelta = SCENARIO_BOOST[scenario] + growthAdj / 100;

  /* Le rythme de départ. Sur un roster, la moyenne pondérée par les revenus :
     un artiste à 2 % de croissance sur 80 % des revenus pèse plus qu'un autre
     à 20 % sur 2 %. */
  const baseGrowth = useMemo(() => {
    if (ids.length === 1) return getArtist(ids[0]).growthRate;
    let weighted = 0;
    let total = 0;
    for (const id of ids) {
      const revenue = monthlyRevenueTotals(id, 24)
        .slice(-12)
        .reduce((s, m) => s + m.amount, 0);
      weighted += getArtist(id).growthRate * revenue;
      total += revenue;
    }
    return total === 0 ? 0 : weighted / total;
  }, [ids]);
  const effectiveGrowth = baseGrowth + growthDelta;

  /* ── Projection ────────────────────────────────────────────────────── */
  const forecast = useMemo(
    () =>
      mergeForecasts(
        ids.map((id) => revenueForecast(id, { growthDelta, horizon })),
      ),
    [ids, growthDelta, horizon],
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

  const { totalProjected, totalLow, totalHigh, monthlyAvg, deltaVsPast, best } =
    useMemo(() => {
      const totalProjected = projRows.reduce((s, r) => s + r.projected, 0);
      const totalLow = projRows.reduce((s, r) => s + r.low, 0);
      const totalHigh = projRows.reduce((s, r) => s + r.high, 0);
      const monthlyAvg = projRows.length ? totalProjected / projRows.length : 0;
      const actuals = forecast.filter((p) => p.actual !== null);
      const pastSame = actuals
        .slice(-Math.min(horizon, actuals.length))
        .reduce((s, p) => s + (p.actual ?? 0), 0);
      const best = projRows.reduce<ForecastRow | null>(
        (b, r) => (!b || r.projected > b.projected ? r : b),
        null,
      );
      return {
        totalProjected,
        totalLow,
        totalHigh,
        monthlyAvg,
        deltaVsPast:
          pastSame === 0 ? 0 : ((totalProjected - pastSame) / pastSame) * 100,
        best,
      };
    }, [projRows, forecast, horizon]);

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  /** La largeur de la bande au terme choisi — la même règle que le générateur. */
  const maxSpread = Math.round((0.12 + horizon * 0.018) * 100);

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={
          aggregated
            ? t("subtitleLabel")
            : focusedArtist
              ? t("subtitleFocused", { name: focusedArtist.name })
              : t("subtitle")
        }
      >
        {focusedArtist && <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />}
      </PageHeader>

      <div className="space-y-3">
        {/* Combien, et dans quelle fourchette. */}
        <Sheet family="money">
          <SheetHeading
            action={
              <SheetSegments
                value={horizon}
                onChange={setHorizon}
                label={t("params.horizon")}
                options={HORIZONS.map((h) => ({
                  value: h as number,
                  label: t("params.months", { count: h }),
                }))}
              />
            }
          >
            {t("hero.title")}
          </SheetHeading>

          <div className="group relative">
            <CenteredValue
              value={eur(totalProjected)}
              caption={
                <>
                  {t("hero.caption", { count: horizon })}
                  {aggregated && <> · {t("hero.scopeRoster")}</>}
                  <span className="mt-0.5 block opacity-80">
                    {t("hero.range", {
                      low: eur(totalLow),
                      high: eur(totalHigh),
                    })}
                  </span>
                </>
              }
            />
            <ForecastChart data={chartData} centeredValue />
          </div>

          <div className="sheet-ink mt-1.5 flex flex-wrap items-center gap-4 text-[11.5px]">
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
                style={{ background: "var(--sheet-line)", opacity: 0.3 }}
              />
              {t("chart.band")}
            </span>
          </div>

          <AffiliatedPoints
            points={[
              {
                key: "avg",
                value: eur(monthlyAvg),
                label: t("kpis.monthlyAvg"),
              },
              {
                key: "delta",
                value: (
                  <span
                    className={deltaVsPast >= 0 ? "text-success" : "text-destructive"}
                  >
                    {fmtPct(locale, deltaVsPast)}
                  </span>
                ),
                label: t("kpis.deltaShort", { count: horizon }),
                note: t("kpis.deltaHint"),
              },
              {
                key: "growth",
                value: `${fmtPct(locale, effectiveGrowth * 100)}${tc("units.perMonth")}`,
                label: t("kpis.growth"),
                note: aggregated
                  ? t("kpis.growthHintRoster")
                  : t("kpis.growthHint", {
                      base: fmtPct(locale, baseGrowth * 100),
                    }),
              },
              {
                key: "best",
                value: best ? fmtMonth(locale, best.month) : "—",
                label: t("kpis.bestMonth"),
                note: best ? eur(best.projected) : undefined,
              },
            ]}
          />
        </Sheet>

        {/* Les hypothèses, juste sous leur effet. */}
        <Sheet family="money">
          <SheetHeading
            action={aggregated ? t("params.subtitleLabel") : t("params.subtitle")}
          >
            {aggregated ? t("params.titleLabel") : t("params.title")}
          </SheetHeading>

          <div className="mt-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid gap-2">
              <Label>{t("params.scenario")}</Label>
              <SheetSegments
                value={scenario}
                onChange={(v) => setScenario(v)}
                label={t("params.scenario")}
                className="flex-wrap text-[12px]"
                options={SCENARIOS.map((s) => ({
                  value: s,
                  label: t(`params.scenarios.${s}`),
                }))}
              />
              <p className="sheet-ink text-[11.5px]">
                {scenario === "none"
                  ? t("params.scenarioNone")
                  : t("params.scenarioHint", {
                      points: SCENARIO_BOOST[scenario] * 100,
                    })}
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="growth-adj">{t("params.growth")}</Label>
                <span className="num text-sm font-semibold tabular-nums">
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
                className="w-full accent-[var(--ink-money)]"
              />
              <p className="sheet-ink text-[11.5px]">{t("params.growthHint")}</p>
            </div>
          </div>
        </Sheet>

        {/* Le détail mois par mois, et la règle qui le produit. */}
        <Sheet family="money">
          <SheetHeading>{t("table.title")}</SheetHeading>
          <ForecastTable rows={projRows} bare />
          <details className="sheet-rule mt-3 pt-2.5 text-[11.5px] leading-relaxed">
            <summary className="sheet-ink cursor-pointer font-medium">
              {t("methodology.title")}
            </summary>
            <p className="text-muted-foreground mt-2">{t("methodology.intro")}</p>
            <ul className="text-muted-foreground mt-1.5 space-y-1">
              {(["point1", "point2", "point3"] as const).map((key) => (
                <li key={key}>— {t(`methodology.${key}`)}</li>
              ))}
              <li>
                —{" "}
                {t("methodology.point4", {
                  maxSpread: fmtInt(locale, maxSpread),
                })}
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              {t("methodology.disclaimer")}
            </p>
          </details>
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
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
              key: "valuation",
              family: "money",
              href: "/valuation",
              label: t("doors.valuation"),
              value: t("doors.valuationValue"),
            },
            {
              key: "catalog",
              family: "catalog",
              href: "/catalog",
              label: t("doors.catalog"),
              value: t("doors.catalogValue"),
            },
          ]}
        />

        <RestRow
          title={aggregated ? tc("blocks.restLabel") : tc("blocks.rest")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "streams", href: "/streams", label: t("rest.streams") },
            { key: "tour", href: "/tour", label: t("rest.tour") },
            { key: "sync", href: "/sync", label: t("rest.sync") },
            { key: "urssaf", href: "/urssaf", label: t("rest.urssaf") },
            { key: "audit", href: "/audit", label: t("rest.audit") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

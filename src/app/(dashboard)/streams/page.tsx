"use client";

/**
 * /streams — performance multi-DSP, territoires et titres.
 * Persona artiste : ses données. Persona label : roster agrégé + comparateur,
 * ou zoom sur l'artiste focus.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ARTISTS, PROJECTS, getArtist, topTracks } from "@/lib/demo/api";
import { fmtCompact, fmtDate, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  aggregateWeekly,
  combinedByDsp,
  combinedCountries,
  combinedDailyTotals,
} from "@/components/modules/data/derive";
import { DspBreakdown } from "@/components/modules/data/dsp-breakdown";
import { RosterCompare } from "@/components/modules/data/roster-compare";
import { StreamsTrendChart } from "@/components/modules/data/streams-trend-chart";
import {
  TopTracksTable,
  type TrackRow,
} from "@/components/modules/data/top-tracks-table";
import { WorldMap } from "@/components/modules/data/world-map";

const PERIODS = ["7d", "30d", "90d", "12m"] as const;
type Period = (typeof PERIODS)[number];
const DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

export default function StreamsPage() {
  const locale = useLocale();
  const t = useTranslations("streams");
  const tc = useTranslations("common");
  const { artistId, focusedArtistId, isLabel } = useRole();

  const [period, setPeriod] = useState<Period>("30d");
  const days = DAYS[period];
  const weekly = days >= 90;

  const aggregate = isLabel && !focusedArtistId;
  const ids = useMemo(
    () => (aggregate ? ARTISTS.map((a) => a.id) : [artistId]),
    [aggregate, artistId],
  );
  const focusedArtist =
    isLabel && focusedArtistId ? getArtist(focusedArtistId) : null;

  /* Série sur 2× la période : [0, days) = période précédente, [days, 2days) = courante. */
  const series2 = useMemo(
    () => combinedDailyTotals(ids, days * 2),
    [ids, days],
  );
  const cur = useMemo(() => series2.slice(days), [series2, days]);
  const prevTotal = useMemo(
    () => series2.slice(0, days).reduce((s, p) => s + p.streams, 0),
    [series2, days],
  );
  const total = useMemo(() => cur.reduce((s, p) => s + p.streams, 0), [cur]);
  const delta = prevTotal === 0 ? 0 : ((total - prevTotal) / prevTotal) * 100;

  const bestDay = useMemo(
    () =>
      cur.reduce(
        (best, p) => (p.streams > best.streams ? p : best),
        cur[0] ?? { date: "", streams: 0 },
      ),
    [cur],
  );

  const byDsp = useMemo(() => combinedByDsp(ids, days), [ids, days]);
  const topDsp = byDsp[0];

  const chartData = useMemo(
    () => (weekly ? aggregateWeekly(cur) : cur),
    [cur, weekly],
  );
  const spark = useMemo(
    () => chartData.map((p) => ({ value: p.streams })),
    [chartData],
  );

  const trackRows = useMemo<TrackRow[]>(() => {
    const all = ids.flatMap((id) => topTracks(id, days, 12));
    return all
      .sort((a, b) => b.streams - a.streams)
      .slice(0, 10)
      .map((tr, i) => ({
        id: tr.id,
        rank: i + 1,
        title: tr.title,
        project: PROJECTS.find((p) => p.id === tr.projectId)?.title ?? "—",
        artist: getArtist(tr.artistId),
        streams: tr.streams,
        share: total === 0 ? 0 : (tr.streams / total) * 100,
      }));
  }, [ids, days, total]);

  const countries = useMemo(() => combinedCountries(ids, days), [ids, days]);
  const maxCountry = Math.max(1, ...countries.map((c) => c.streams));

  const pct = (n: number) => fmtPct(locale, n).replace("+", "");

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {focusedArtist && (
          <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />
        )}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p} value={p} className="num text-xs">
                {tc(`periods.${p}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>

      {/* Rangée KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          id="streams-total"
          hero
          label={t("kpi.total")}
          value={total}
          delta={delta}
          spark={spark}
        />
        <KpiCard
          id="streams-delta"
          label={t("kpi.delta")}
          value={delta}
          format="pct"
          deltaLabel={t("kpi.deltaHint")}
        />
        <KpiCard
          id="streams-best"
          label={t("kpi.bestDay")}
          value={bestDay.streams}
          deltaLabel={
            bestDay.date
              ? t("kpi.bestDayOn", {
                  date: fmtDate(locale, bestDay.date, {
                    day: "numeric",
                    month: "long",
                  }),
                })
              : undefined
          }
        />
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("kpi.topDsp")}
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            {topDsp ? t(`dsp.names.${topDsp.dsp}`) : "—"}
          </span>
          {topDsp && (
            <span className="num text-[11px] text-muted-foreground">
              {t("kpi.topDspShare", {
                share: pct(total === 0 ? 0 : (topDsp.streams / total) * 100),
              })}
            </span>
          )}
        </div>
      </div>

      {/* Grand chart de tendance */}
      <section className="mt-4 rounded-xl border bg-card p-5">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">
              {t("chart.title")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {weekly ? t("chart.weekly") : t("chart.daily")}
            </p>
          </div>
          {aggregate && (
            <Badge variant="outline" className="num">
              {t("chart.rosterNote", { count: ids.length })}
            </Badge>
          )}
        </header>
        <div className="mt-4">
          <StreamsTrendChart data={chartData} />
        </div>
      </section>

      {/* Comparateur roster (vue label agrégée) */}
      {aggregate && (
        <div className="mt-4">
          <RosterCompare days={days} />
        </div>
      )}

      {/* Répartition DSP */}
      <div className="mt-4">
        <DspBreakdown ids={ids} days={days} />
      </div>

      {/* Top titres */}
      <div className="mt-4">
        <TopTracksTable rows={trackRows} showArtist={aggregate} />
      </div>

      {/* Carte monde + top territoires */}
      <section className="mt-4 rounded-xl border bg-card p-5">
        <header>
          <h2 className="font-heading text-base font-semibold tracking-tight">
            {t("map.title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("map.subtitle")}
          </p>
        </header>
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
          <WorldMap data={countries} />
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">
              {t("map.topCountries")}
            </h3>
            <ul className="mt-3 space-y-2.5">
              {countries.slice(0, 8).map((c) => (
                <li key={c.iso3} className="flex items-center gap-3">
                  <span className="w-24 truncate text-sm">
                    {locale === "fr" ? c.nameFr : c.nameEn}
                  </span>
                  <Progress
                    value={(c.streams / maxCountry) * 100}
                    className="flex-1"
                  />
                  <span className="num w-12 shrink-0 text-right text-xs text-muted-foreground">
                    {fmtCompact(locale, c.streams)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

/**
 * /streams — performance multi-DSP, territoires et titres.
 * Persona artiste : ses données. Persona label : roster agrégé + comparateur,
 * ou zoom sur l'artiste focus.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ARTISTS,
  PROJECTS,
  dailyTotals,
  getArtist,
  provenanceByDsp,
  tiktokSignal,
  topTracks,
} from "@/lib/demo/api";
import type { DSP } from "@/lib/demo/types";
import { fmtCompact, fmtDate, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  CenteredValue,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { StreamGlyph } from "@/components/dashboard/stream-glyph";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  aggregateWeekly,
  combinedByDsp,
  combinedCountries,
  combinedDailyTotals,
} from "@/components/modules/data/derive";
import { DspBreakdown } from "@/components/modules/data/dsp-breakdown";
import { ListeningCalendar } from "@/components/modules/data/listening-calendar";
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

  /* Calendrier 365 jours : un seul artiste, indépendant de la période choisie
   * (c'est l'année entière, toujours). Absent en vue roster agrégée. */
  const year = useMemo(
    () => (aggregate ? null : dailyTotals(artistId, 365)),
    [aggregate, artistId],
  );

  /* Provenance par plateforme (couche réelle, un seul artiste) — même ordre que
   * le tableau de répartition (par volume), sur la fenêtre affichée. Vide en vue
   * roster agrégée. */
  const provByDsp = useMemo(() => {
    if (aggregate) return [];
    const prov = provenanceByDsp(artistId, days);
    return byDsp.flatMap(({ dsp }) => {
      const p = prov[dsp as DSP];
      return p ? [{ dsp, provenance: p }] : [];
    });
  }, [aggregate, artistId, days, byDsp]);
  const maxCountry = Math.max(1, ...countries.map((c) => c.streams));

  /* Signal TikTok (viralité, pas revenu) — un seul artiste réel, jamais en roster agrégé. */
  const tiktok = useMemo(
    () => (aggregate ? null : tiktokSignal(artistId)),
    [aggregate, artistId],
  );

  const pct = (n: number) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
      n / 100,
    );

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {focusedArtist && (
          <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />
        )}
      </PageHeader>

      <div className="space-y-3">
        {/* Le volume de la période, au centre de sa courbe. */}
        <Sheet family="streams">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <SheetHeading>{t("chart.title")}</SheetHeading>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="h-7">
                {PERIODS.map((p) => (
                  <TabsTrigger key={p} value={p} className="num px-2.5 text-[11px]">
                    {tc(`periods.${p}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="group relative">
            <CenteredValue
              glyph={<StreamGlyph size="lg" className="opacity-80" />}
              value={fmtCompact(locale, total)}
              caption={
                <>
                  {weekly ? t("chart.weekly") : t("chart.daily")}{" "}
                  <b className={delta >= 0 ? "text-success" : "text-destructive"}>
                    {fmtPct(locale, delta)}
                  </b>
                </>
              }
            />
            <StreamsTrendChart data={chartData} />
          </div>
          <AffiliatedPoints
            points={[
              {
                key: "best",
                value: fmtCompact(locale, bestDay.streams),
                label: t("kpi.bestDay"),
                note: bestDay.date
                  ? fmtDate(locale, bestDay.date, { day: "numeric", month: "long" })
                  : undefined,
              },
              {
                key: "avg",
                value: fmtCompact(locale, Math.round(total / Math.max(1, cur.length))),
                label: t("kpi.perDay"),
                note: t("kpi.perDayNote", { days: cur.length }),
              },
              ...(topDsp
                ? [
                    {
                      key: "dsp",
                      value: t(`dsp.names.${topDsp.dsp}`),
                      label: t("kpi.topDsp"),
                      note: t("kpi.topDspShare", {
                        share: pct(total === 0 ? 0 : (topDsp.streams / total) * 100),
                      }),
                    },
                  ]
                : []),
              {
                key: "prev",
                value: fmtCompact(locale, prevTotal),
                label: t("kpi.prevPeriod"),
                note: t("kpi.deltaHint"),
              },
            ]}
          />
        </Sheet>

        {/* Par plateforme — et d'où vient chaque chiffre. */}
        <Sheet family="streams">
          <SheetHeading action={t("dsp.subtitle")}>{t("dsp.title")}</SheetHeading>
          <DspBreakdown ids={ids} days={days} bare />
          {provByDsp.length > 0 && (
            <div className="sheet-rule mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2.5 text-xs">
              <span className="sheet-ink">{t("provenanceLegend")}</span>
              {provByDsp.map(({ dsp, provenance }) => (
                <span key={dsp} className="inline-flex items-center gap-1">
                  <span>{t(`dsp.names.${dsp}`)}</span>
                  <ProvenanceBadge provenance={provenance} />
                </span>
              ))}
            </div>
          )}
          {tiktok && (
            <p className="text-muted-foreground mt-2 text-xs">
              {t("tiktokSignal", { videos: fmtCompact(locale, tiktok.videos) })} ·{" "}
              {t("tiktokNote")} <ProvenanceBadge provenance={tiktok.provenance} />
            </p>
          )}
        </Sheet>

        {/* Les titres relèvent du catalogue : ils en prennent la couleur. */}
        <Sheet family="catalog">
          <SheetHeading action={t("tracks.subtitle", { count: trackRows.length })}>
            {t("tracks.title")}
          </SheetHeading>
          <TopTracksTable rows={trackRows} showArtist={aggregate} bare />
        </Sheet>

        {/* Où on t'écoute : c'est de l'audience, pas du volume. */}
        <Sheet family="audience">
          <SheetHeading action={t("map.subtitle")}>{t("map.title")}</SheetHeading>
          <div className="mt-2 grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
            <WorldMap data={countries} />
            <div>
              <h3 className="sheet-ink text-[11px] font-semibold tracking-[0.06em] uppercase">
                {t("map.topCountries")}
              </h3>
              <ul className="mt-2 space-y-2.5">
                {countries.slice(0, 8).map((c) => (
                  <li key={c.iso3} className="flex items-center gap-3">
                    <span className="w-24 truncate text-sm">
                      {locale === "fr" ? c.nameFr : c.nameEn}
                    </span>
                    <Progress value={(c.streams / maxCountry) * 100} className="flex-1" />
                    <span className="num w-12 shrink-0 text-right text-xs">
                      {fmtCompact(locale, c.streams)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Sheet>

        {/* Une année jour par jour — un seul artiste. */}
        {year && (
          <Sheet family="streams">
            <SheetHeading action={t("calendar.subtitle")}>
              {t("calendar.title")}
            </SheetHeading>
            <ListeningCalendar days={year} className="mt-2" />
          </Sheet>
        )}

        {aggregate && <RosterCompare days={days} />}

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
              key: "audience",
              family: "audience",
              href: "/audience",
              label: t("doors.audience"),
              value: t("doors.audienceValue", { count: countries.length }),
            },
            {
              key: "market",
              family: "trends",
              href: "/market",
              label: t("doors.market"),
              value: t("doors.marketValue"),
            },
            {
              key: "algo",
              family: "trends",
              href: "/algo-position",
              label: t("doors.algo"),
              value: t("doors.algoValue"),
            },
            {
              key: "catalog",
              family: "catalog",
              href: "/catalog",
              label: t("doors.catalog"),
              value: t("doors.catalogValue", { count: trackRows.length }),
            },
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              value: t("doors.auditValue"),
            },
          ]}
        />
        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

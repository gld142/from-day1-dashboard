"use client";

/**
 * /pulse — le rituel quotidien.
 * Artiste : streams du jour en héro, KPIs, aire 90 j, insights de la nuit.
 * Label : mêmes rituels agrégés roster + top movers cliquables.
 */
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Crown,
  FileWarning,
  Flame,
  Music2,
  Radio,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import {
  InsightCard,
  type InsightTone,
} from "@/components/modules/pilotage/insight-card";
import {
  KpiStagger,
  KpiStaggerItem,
} from "@/components/modules/signature/kpi-stagger";
import { SunriseArc } from "@/components/modules/signature/sunrise-arc";
import { SharesPanel } from "@/components/modules/finances/shares-panel";
import { EstimateBoard } from "@/components/modules/pilotage/estimate-board";
import { StreamsAreaChart } from "@/components/modules/pilotage/streams-area-chart";
import { TopMovers } from "@/components/modules/pilotage/top-movers";
import {
  ARTISTS,
  CONTRACTS,
  dailyTotals,
  estimateSummaries,
  getArtist,
  hasReal,
  labelTotals,
  monthlyRevenueTotals,
  provenanceByDsp,
  rosterEstimateSummaries,
  rosterRows,
  rosterTiktokSignal,
  streamsByDsp,
  streamsDelta,
  sumStreams,
  tiktokSignal,
  topTracks,
  tourDates,
} from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { TikTokSignal } from "@/lib/demo/api";
import type { Provenance } from "@/lib/demo/types";
import { fmtCompact, fmtDate, fmtEur, fmtInt, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { useSharesSnapshot } from "@/lib/userdata/use-shares";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

function daysUntil(iso: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(`${iso}T00:00:00Z`).getTime() - DEMO_TODAY.getTime()) / DAY_MS,
    ),
  );
}

/** Somme des dailyTotals de tout le roster, jour par jour. */
function aggregatedDaily(days: number): Array<{ date: string; streams: number }> {
  const acc = new Map<string, number>();
  for (const a of ARTISTS) {
    for (const d of dailyTotals(a.id, days)) {
      acc.set(d.date, (acc.get(d.date) ?? 0) + d.streams);
    }
  }
  return Array.from(acc.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([date, streams]) => ({ date, streams }));
}

/** Le détail des revenus s'ouvre sur la période des tuiles « 30 jours ». */
const REVENUE_DETAIL_HREF = "/revenue?period=month";

type Insight = {
  key: string;
  icon: LucideIcon;
  kicker: string;
  body: string;
  tone: InsightTone;
  /** Provenance affichée en badge (ex. : signal TikTok simulé). */
  badge?: Provenance;
  /** Note discrète sous le corps. */
  footnote?: string;
};

/** Delta signé (« +1 234 » / « −56 » / « +0 ») pour les compteurs de vidéos. */
function fmtSigned(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    signDisplay: "always",
  }).format(n);
}

/**
 * Corps de l'insight TikTok : la phrase avec rang FR quand il existe, sinon
 * sans — deux clés distinctes plutôt qu'une concaténation, pour que chaque
 * langue garde sa propre ponctuation.
 */
function tiktokBody(
  t: ReturnType<typeof useTranslations<"pulse">>,
  locale: string,
  ns: "overnight.tiktok" | "overnight.tiktokRoster",
  s: TikTokSignal,
): string {
  const params = {
    videos: fmtCompact(locale, s.videos),
    delta: fmtSigned(locale, s.deltaYesterday),
    sound: s.topSound ?? "—",
  };
  return s.trendingRankFr === null
    ? t(`${ns}.body`, params)
    : t(`${ns}.bodyWithTrend`, { ...params, rank: s.trendingRankFr });
}

export default function PulsePage() {
  const t = useTranslations("pulse");
  const locale = useLocale();
  const { persona, artistId, focusedArtistId, isLabel, setFocusedArtistId } =
    useRole();

  const showArtist = persona === "artist" || focusedArtistId !== null;
  /* Parts renseignées : les cascades des estimations en dépendent. */
  const sharesKey = useSharesSnapshot();

  const dateChip = fmtDate(locale, DEMO_TODAY.toISOString(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  /* ───────────── Vue artiste (persona artiste ou label zoomé) ───────────── */

  const artistView = useMemo(() => {
    void sharesKey;
    if (!showArtist) return null;
    const artist = getArtist(artistId);

    const today = sumStreams(artistId, 1);
    const deltaToday = streamsDelta(artistId, 1);
    const heroSpark = dailyTotals(artistId, 14).map((d) => ({ value: d.streams }));

    const s7 = sumStreams(artistId, 7);
    const d7 = streamsDelta(artistId, 7);
    const spark7 = dailyTotals(artistId, 7).map((d) => ({ value: d.streams }));

    const monthly = monthlyRevenueTotals(artistId, 24);
    const revMonth = monthly[monthly.length - 1]?.amount ?? 0;
    const revPrev = monthly[monthly.length - 2]?.amount ?? 0;
    const revDelta = revPrev === 0 ? 0 : ((revMonth - revPrev) / revPrev) * 100;
    const revSpark = monthly.slice(-8).map((m) => ({ value: m.amount }));

    const series90 = dailyTotals(artistId, 90);

    /* Estimation € (couche réelle uniquement) + provenance du compteur du jour */
    const est = hasReal(artistId) ? estimateSummaries(artistId) : null;
    const streamsProvenance = provenanceByDsp(artistId, 1).spotify;

    /* Insights de la nuit */
    const night = streamsByDsp(artistId, 1);
    const nightTotal = night.reduce((s, d) => s + d.streams, 0);
    const bestDsp = night[0];
    const topTrack = topTracks(artistId, 1, 1)[0];
    const tiktok = tiktokSignal(artistId);
    const nextShow = tourDates(artistId).find((d) => d.status === "upcoming");
    const alerts = CONTRACTS.filter((c) => c.artistId === artistId).flatMap(
      (c) => c.alerts,
    );
    const alert =
      alerts.find((a) => a.severity === "danger") ??
      alerts.find((a) => a.severity === "warning") ??
      alerts[0];

    const insights: Insight[] = [];
    if (topTrack) {
      insights.push({
        key: "topTrack",
        icon: Flame,
        kicker: t("overnight.topTrack.kicker"),
        body: t("overnight.topTrack.body", {
          title: topTrack.title,
          streams: fmtCompact(locale, topTrack.streams),
        }),
        tone: "brand",
      });
    }
    if (bestDsp) {
      insights.push({
        key: "bestDsp",
        icon: Radio,
        kicker: t("overnight.bestDsp.kicker"),
        body: t("overnight.bestDsp.body", {
          dsp: t(`dsp.${bestDsp.dsp}`),
          share: `${fmtInt(locale, Math.round((bestDsp.streams / Math.max(1, nightTotal)) * 100))} %`,
        }),
        tone: "muted",
      });
    }
    insights.push({
      key: "momentum",
      icon: d7 >= 0 ? TrendingUp : TrendingDown,
      kicker: t("overnight.momentum.kicker"),
      body: t("overnight.momentum.body", { delta: fmtPct(locale, d7) }),
      tone: d7 >= 0 ? "success" : "destructive",
    });
    if (tiktok) {
      // Signal de viralité, pas un revenu : badge de provenance + note explicite.
      insights.push({
        key: "tiktok",
        icon: Music2,
        kicker: t("overnight.tiktok.kicker"),
        body: tiktokBody(t, locale, "overnight.tiktok", tiktok),
        tone: "brand",
        badge: tiktok.provenance,
        footnote: t("overnight.tiktok.note"),
      });
    }
    if (nextShow) {
      insights.push({
        key: "nextShow",
        icon: CalendarDays,
        kicker: t("overnight.nextShow.kicker"),
        body: t("overnight.nextShow.body", {
          venue: nextShow.venue,
          city: nextShow.city,
          days: daysUntil(nextShow.date),
          sold: fmtInt(locale, nextShow.ticketsSold),
          capacity: fmtInt(locale, nextShow.capacity),
        }),
        tone: "brand",
      });
    }
    if (alert) {
      insights.push({
        key: "contract",
        icon: FileWarning,
        kicker: t("overnight.contract.kicker"),
        body: t("overnight.contract.body", {
          message: alert.message[locale === "fr" ? "fr" : "en"],
        }),
        tone: alert.severity === "danger" ? "destructive" : "warning",
      });
    }

    return {
      artist,
      today,
      deltaToday,
      heroSpark,
      s7,
      d7,
      spark7,
      revMonth,
      revDelta,
      revSpark,
      series90,
      est,
      streamsProvenance,
      insights,
    };
  }, [showArtist, artistId, locale, t, sharesKey]);

  /* ───────────── Vue label agrégée (focusedArtistId === null) ───────────── */

  const labelView = useMemo(() => {
    void sharesKey;
    if (showArtist) return null;

    const totals = labelTotals();
    const rows = rosterRows();

    const agg14 = aggregatedDaily(14);
    const today = agg14[agg14.length - 1]?.streams ?? 0;
    const yesterday = agg14[agg14.length - 2]?.streams ?? 0;
    const deltaToday =
      yesterday === 0 ? 0 : ((today - yesterday) / yesterday) * 100;
    const heroSpark = agg14.map((d) => ({ value: d.streams }));

    const cur7 = agg14.slice(-7).reduce((s, d) => s + d.streams, 0);
    const prev7 = agg14.slice(0, 7).reduce((s, d) => s + d.streams, 0);
    const d7 = prev7 === 0 ? 0 : ((cur7 - prev7) / prev7) * 100;

    const series90 = aggregatedDaily(90);
    const movers = [...rows].sort((a, b) => b.delta30d - a.delta30d).slice(0, 5);
    const est = rosterEstimateSummaries();

    /* Insights roster */
    const topMover = movers[0];
    const topEarner = rows[0]; // rosterRows est trié par revenus 12 m
    const nextShow = ARTISTS.flatMap((a) =>
      tourDates(a.id)
        .filter((d) => d.status === "upcoming")
        .map((d) => ({ ...d, artistName: getArtist(a.id).name })),
    ).sort((a, b) => a.date.localeCompare(b.date))[0];
    const alertCount = CONTRACTS.flatMap((c) => c.alerts).filter(
      (a) => a.severity !== "info",
    ).length;
    const tiktok = rosterTiktokSignal();

    const insights: Insight[] = [];
    if (topMover) {
      insights.push({
        key: "topMover",
        icon: TrendingUp,
        kicker: t("overnight.topMover.kicker"),
        body: t("overnight.topMover.body", {
          name: topMover.name,
          delta: fmtPct(locale, topMover.delta30d),
        }),
        tone: "success",
      });
    }
    if (topEarner) {
      insights.push({
        key: "topEarner",
        icon: Crown,
        kicker: t("overnight.topEarner.kicker"),
        body: t("overnight.topEarner.body", {
          name: topEarner.name,
          share: `${fmtInt(locale, Math.round((topEarner.revenue12m / Math.max(1, totals.revenue12m)) * 100))} %`,
        }),
        tone: "brand",
      });
    }
    if (nextShow) {
      insights.push({
        key: "labelNextShow",
        icon: CalendarDays,
        kicker: t("overnight.labelNextShow.kicker"),
        body: t("overnight.labelNextShow.body", {
          name: nextShow.artistName,
          venue: nextShow.venue,
          city: nextShow.city,
          days: daysUntil(nextShow.date),
        }),
        tone: "muted",
      });
    }
    if (tiktok) {
      insights.push({
        key: "tiktokRoster",
        icon: Music2,
        kicker: t("overnight.tiktokRoster.kicker"),
        body: tiktokBody(t, locale, "overnight.tiktokRoster", tiktok),
        tone: "brand",
        badge: tiktok.provenance,
        footnote: t("overnight.tiktok.note"),
      });
    }
    insights.push({
      key: "contractCount",
      icon: FileWarning,
      kicker: t("overnight.contractCount.kicker"),
      body: t("overnight.contractCount.body", { count: alertCount }),
      tone: "warning",
    });

    return {
      totals,
      cur7,
      d7,
      today,
      deltaToday,
      heroSpark,
      series90,
      movers,
      est,
      insights,
    };
  }, [showArtist, locale, t, sharesKey]);

  /* Cascade mise en avant : part artiste pour l'artiste, brut master pour le label. */
  const line = persona === "artist" ? "artistShare" : "grossMaster";

  /* « Voir le détail des revenus » : Revenus s'ouvre sur la même période. */
  const detailLink = (
    <Button asChild variant="ghost" size="sm">
      <Link href={REVENUE_DETAIL_HREF}>
        {t("estimate.detail")}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  );

  /* ───────────────────────────── Rendu ───────────────────────────── */

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={showArtist ? t("subtitle") : t("subtitleLabel")}
      >
        {isLabel && focusedArtistId !== null && artistView && (
          <>
            <ArtistBadge artist={artistView.artist} size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFocusedArtistId(null)}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              {t("backToRoster")}
            </Button>
          </>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          {dateChip}
        </span>
      </PageHeader>

      {artistView && (
        <div className="space-y-4">
          {/* Héro + KPIs */}
          <KpiStagger
            className={cn(
              "grid gap-4 sm:grid-cols-2",
              artistView.est ? "xl:grid-cols-7" : "xl:grid-cols-6",
            )}
          >
            <KpiStaggerItem className="relative sm:col-span-2 xl:col-span-2">
              <KpiCard
                hero
                id="pulse-hero"
                className="h-full"
                label={t("hero.today")}
                value={artistView.today}
                delta={artistView.deltaToday}
                deltaLabel={t("hero.vsYesterday")}
                spark={artistView.heroSpark}
                sparkColor="var(--brand)"
                provenance={artistView.streamsProvenance}
              />
              <SunriseArc />
            </KpiStaggerItem>
            <KpiStaggerItem>
              <KpiCard
                id="pulse-7d"
                className="h-full"
                label={t("kpis.streams7d")}
                value={artistView.s7}
                delta={artistView.d7}
                spark={artistView.spark7}
              />
            </KpiStaggerItem>
            {artistView.est ? (
              <>
                {/* Gains estimés : hier + 7 jours, en fourchette et avec provenance */}
                <KpiStaggerItem>
                  <KpiCard
                    id="pulse-earned-day"
                    className="h-full"
                    label={t("kpis.earnedYesterday")}
                    value={Math.round(artistView.est.day[line].mid)}
                    format="eur"
                    deltaLabel={t("kpis.rangeHint", {
                      low: fmtEur(locale, artistView.est.day[line].low),
                      high: fmtEur(locale, artistView.est.day[line].high),
                    })}
                    provenance={artistView.est.day.provenance}
                  />
                </KpiStaggerItem>
                <KpiStaggerItem>
                  <KpiCard
                    id="pulse-earned-week"
                    className="h-full"
                    label={t("kpis.earnedWeek")}
                    value={Math.round(artistView.est.week[line].mid)}
                    format="eur"
                    deltaLabel={
                      persona === "artist"
                        ? t("kpis.artistShareHint")
                        : t("kpis.grossHint")
                    }
                    provenance={artistView.est.week.provenance}
                  />
                </KpiStaggerItem>
              </>
            ) : (
              <KpiStaggerItem>
                <KpiCard
                  id="pulse-rev"
                  className="h-full"
                  label={t("kpis.revenueMonth")}
                  value={artistView.revMonth}
                  format="eur"
                  delta={artistView.revDelta}
                  deltaLabel={t("kpis.vsPrevMonth")}
                  spark={artistView.revSpark}
                  sparkColor="var(--chart-2)"
                />
              </KpiStaggerItem>
            )}
            <KpiStaggerItem>
              <KpiCard
                id="pulse-listeners"
                className="h-full"
                label={t("kpis.monthlyListeners")}
                value={artistView.artist.monthlyListeners}
                delta={artistView.artist.growthRate * 100}
                deltaLabel={t("kpis.growthHint")}
              />
            </KpiStaggerItem>
            <KpiStaggerItem>
              <KpiCard
                id="pulse-index"
                className="h-full"
                label={t("kpis.day1Index")}
                value={artistView.artist.day1Index}
                format="int"
                deltaLabel={t("kpis.day1IndexHint")}
              />
            </KpiStaggerItem>
          </KpiStagger>

          {/* Grand chart 90 j */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              {t("chart.title")}
            </h2>
            <StreamsAreaChart
              data={artistView.series90}
              seriesLabel={t("chart.streams")}
            />
          </section>

          {/* Ce que ça rapporte — estimation jour / semaine / mois / année */}
          {artistView.est && (
            <EstimateBoard
              summaries={artistView.est}
              line={line}
              title={t("estimate.title")}
              subtitle={t("estimate.subtitle")}
              actions={detailLink}
            />
          )}

          {/* Ta part, c'est ton contrat — rappel en une ligne, l'édition se fait sur Revenus. */}
          {artistView.est && persona === "artist" && (
            <SharesPanel variant="compact" artistId={artistId} gross={artistView.est.day.grossMaster.mid} />
          )}

          {/* Ce qui a changé cette nuit */}
          <section>
            <h2 className="mb-3 font-heading text-base font-semibold tracking-tight">
              {t("overnight.title")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {artistView.insights.map((i) => (
                <InsightCard
                  key={i.key}
                  icon={i.icon}
                  kicker={i.kicker}
                  body={i.body}
                  tone={i.tone}
                  badge={i.badge}
                  footnote={i.footnote}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {labelView && (
        <div className="space-y-4">
          {/* Héro + KPIs label */}
          <KpiStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiStaggerItem className="relative sm:col-span-2 xl:col-span-2">
              <KpiCard
                hero
                id="pulse-label-hero"
                className="h-full"
                label={t("hero.todayLabel")}
                value={labelView.today}
                delta={labelView.deltaToday}
                deltaLabel={t("hero.vsYesterday")}
                spark={labelView.heroSpark}
                sparkColor="var(--brand)"
              />
              <SunriseArc />
            </KpiStaggerItem>
            <KpiStaggerItem>
              <KpiCard
                id="pulse-label-7d"
                className="h-full"
                label={t("kpis.streams7d")}
                value={labelView.cur7}
                delta={labelView.d7}
              />
            </KpiStaggerItem>
            <KpiStaggerItem>
              <KpiCard
                id="pulse-label-rev"
                className="h-full"
                label={t("kpis.revenue12m")}
                value={labelView.totals.revenue12m}
                format="eur"
              />
            </KpiStaggerItem>
            <KpiStaggerItem>
              <KpiCard
                id="pulse-label-net"
                className="h-full"
                label={t("kpis.net12m")}
                value={labelView.totals.net12m}
                format="eur"
                deltaLabel={t("kpis.netHint")}
              />
            </KpiStaggerItem>
            <KpiStaggerItem>
              <KpiCard
                id="pulse-label-valo"
                className="h-full"
                label={t("kpis.valuation")}
                value={labelView.totals.valuationMid}
                format="eur"
                deltaLabel={t("kpis.valuationHint")}
              />
            </KpiStaggerItem>
          </KpiStagger>

          {/* Chart agrégé + top movers */}
          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-xl border bg-card p-5 xl:col-span-2">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                {t("chart.titleLabel")}
              </h2>
              <StreamsAreaChart
                data={labelView.series90}
                seriesLabel={t("chart.streams")}
              />
            </section>
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-medium">{t("movers.title")}</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("movers.subtitle")}
              </p>
              <TopMovers
                rows={labelView.movers}
                unitLabel={t("movers.streams30d")}
                onSelect={setFocusedArtistId}
              />
            </section>
          </div>

          {/* Ce que le roster rapporte — estimation agrégée */}
          <EstimateBoard
            summaries={labelView.est}
            line="grossMaster"
            title={t("estimate.titleLabel")}
            subtitle={t("estimate.subtitle")}
            actions={detailLink}
          />

          {/* Ce qui a changé cette nuit — roster */}
          <section>
            <h2 className="mb-3 font-heading text-base font-semibold tracking-tight">
              {t("overnight.title")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {labelView.insights.map((i) => (
                <InsightCard
                  key={i.key}
                  icon={i.icon}
                  kicker={i.kicker}
                  body={i.body}
                  tone={i.tone}
                  badge={i.badge}
                  footnote={i.footnote}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

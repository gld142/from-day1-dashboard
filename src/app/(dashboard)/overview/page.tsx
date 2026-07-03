"use client";

/**
 * /overview — la photo complète.
 * Artiste : KPIs 30 j / 12 m / valo / superfans, revenus × streams,
 * donut DSP, top titres, top territoires.
 * Label : KPIs roster + grille mini-cards cliquables + chart agrégé.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { DspDonut } from "@/components/modules/pilotage/dsp-donut";
import { RevenueStreamsChart } from "@/components/modules/pilotage/revenue-streams-chart";
import {
  RosterGrid,
  type RosterCardRow,
} from "@/components/modules/pilotage/roster-grid";
import {
  TopTracksList,
  type TopTrackRow,
} from "@/components/modules/pilotage/top-tracks-list";
import { TerritoryBars } from "@/components/modules/pilotage/territory-bars";
import {
  ARTISTS,
  catalogValuation,
  countryBreakdown,
  dailyTotals,
  fanSegments,
  getArtist,
  labelTotals,
  monthlyRevenueTotals,
  rosterRows,
  streamsByDsp,
  streamsDelta,
  sumStreams,
  topTracks,
  totalRevenue,
} from "@/lib/demo/api";
import { useRole } from "@/lib/role";

/** Streams mensuels dérivés des totaux quotidiens (clé "YYYY-MM"). */
function monthlyStreamsMap(artistIds: string[], days = 396): Map<string, number> {
  const acc = new Map<string, number>();
  for (const id of artistIds) {
    for (const d of dailyTotals(id, days)) {
      const m = d.date.slice(0, 7);
      acc.set(m, (acc.get(m) ?? 0) + d.streams);
    }
  }
  return acc;
}

/** Revenus mensuels agrégés + streams mensuels, joints sur 12 mois. */
function composedSeries(
  artistIds: string[],
): Array<{ month: string; revenue: number; streams: number }> {
  const revenue = new Map<string, number>();
  for (const id of artistIds) {
    for (const m of monthlyRevenueTotals(id, 24)) {
      revenue.set(m.month, (revenue.get(m.month) ?? 0) + m.amount);
    }
  }
  const streams = monthlyStreamsMap(artistIds);
  return Array.from(revenue.keys())
    .sort()
    .slice(-12)
    .map((month) => ({
      month,
      revenue: revenue.get(month) ?? 0,
      streams: streams.get(month) ?? 0,
    }));
}

/** Variation déterministe par titre pour différencier les sparklines. */
function trackSeed(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s += id.charCodeAt(i);
  return s % 7;
}

export default function OverviewPage() {
  const t = useTranslations("overview");
  const locale = useLocale();
  const { persona, artistId, focusedArtistId, isLabel, setFocusedArtistId } =
    useRole();

  const showArtist = persona === "artist" || focusedArtistId !== null;

  /* ───────────── Vue artiste (persona artiste ou label zoomé) ───────────── */

  const artistView = useMemo(() => {
    if (!showArtist) return null;
    const artist = getArtist(artistId);

    const s30 = sumStreams(artistId, 30);
    const d30 = streamsDelta(artistId, 30);
    const spark30 = dailyTotals(artistId, 30).map((d) => ({ value: d.streams }));

    const rev12 = totalRevenue(artistId, 12);
    const valuation = catalogValuation(artistId);
    const superfans = fanSegments(artistId).find((s) => s.id === "superfans");

    const composed = composedSeries([artistId]);

    const dsp = streamsByDsp(artistId, 30).map((d) => ({
      ...d,
      label: t(`dsp.${d.dsp}`),
    }));

    const sparkBase = dailyTotals(artistId, 14);
    const tracks: TopTrackRow[] = topTracks(artistId, 30, 5).map((tr) => {
      const seed = trackSeed(tr.id);
      return {
        id: tr.id,
        title: tr.title,
        streams: tr.streams,
        spark: sparkBase.map((d, i) => ({
          value: d.streams * tr.weight * (1 + 0.22 * Math.sin(i * 0.9 + seed)),
        })),
      };
    });

    const territories = [...countryBreakdown(artistId, 30)]
      .sort((a, b) => b.streams - a.streams)
      .slice(0, 6)
      .map((c) => ({
        iso3: c.iso3,
        name: locale === "fr" ? c.nameFr : c.nameEn,
        streams: c.streams,
      }));

    return {
      artist,
      s30,
      d30,
      spark30,
      rev12,
      valuation,
      superfans,
      composed,
      dsp,
      tracks,
      territories,
    };
  }, [showArtist, artistId, locale, t]);

  /* ───────────── Vue label agrégée (focusedArtistId === null) ───────────── */

  const labelView = useMemo(() => {
    if (showArtist) return null;

    const totals = labelTotals();
    const allIds = ARTISTS.map((a) => a.id);

    // Delta 30 j agrégé : 60 derniers jours coupés en deux fenêtres.
    let cur30 = 0;
    let prev30 = 0;
    for (const id of allIds) {
      const s60 = dailyTotals(id, 60);
      prev30 += s60.slice(0, 30).reduce((s, d) => s + d.streams, 0);
      cur30 += s60.slice(30).reduce((s, d) => s + d.streams, 0);
    }
    const d30 = prev30 === 0 ? 0 : ((cur30 - prev30) / prev30) * 100;

    const composed = composedSeries(allIds);

    const rows: RosterCardRow[] = rosterRows().map((r) => ({
      ...r,
      spark: dailyTotals(r.id, 30).map((d) => ({ value: d.streams })),
    }));

    return { totals, d30, composed, rows };
  }, [showArtist]);

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
      </PageHeader>

      {artistView && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              id="ov-streams"
              label={t("kpis.streams30d")}
              value={artistView.s30}
              delta={artistView.d30}
              deltaLabel={t("kpis.vsPrev30d")}
              spark={artistView.spark30}
            />
            <KpiCard
              id="ov-revenue"
              label={t("kpis.revenue12m")}
              value={artistView.rev12}
              format="eur"
              deltaLabel={t("kpis.revenue12mHint")}
            />
            <KpiCard
              id="ov-valuation"
              label={t("kpis.valuation")}
              value={artistView.valuation.mid}
              format="eur"
              deltaLabel={t("kpis.valuationHint")}
            />
            <KpiCard
              id="ov-superfans"
              label={t("kpis.superfans")}
              value={artistView.superfans?.count ?? 0}
              delta={artistView.superfans?.trend}
              deltaLabel={t("kpis.superfansHint")}
            />
          </div>

          {/* Revenus × streams */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              {t("chart.title")}
            </h2>
            <RevenueStreamsChart
              data={artistView.composed}
              revenueLabel={t("chart.revenue")}
              streamsLabel={t("chart.streams")}
            />
          </section>

          {/* Donut DSP · Top titres · Top territoires */}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-medium">{t("dspCard.title")}</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {t("dspCard.subtitle")}
              </p>
              <DspDonut data={artistView.dsp} totalLabel={t("dspCard.total")} />
            </section>
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-medium">{t("tracks.title")}</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {t("tracks.subtitle")}
              </p>
              <TopTracksList tracks={artistView.tracks} />
            </section>
            <section className="rounded-xl border bg-card p-5 lg:col-span-2 xl:col-span-1">
              <h2 className="text-sm font-medium">{t("territories.title")}</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {t("territories.subtitle")}
              </p>
              <TerritoryBars data={artistView.territories} />
            </section>
          </div>
        </div>
      )}

      {labelView && (
        <div className="space-y-4">
          {/* KPIs roster */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              id="ov-label-artists"
              label={t("kpis.artists")}
              value={labelView.totals.artists}
              format="int"
              deltaLabel={t("kpis.artistsHint")}
            />
            <KpiCard
              id="ov-label-streams"
              label={t("kpis.streams30d")}
              value={labelView.totals.streams30d}
              delta={labelView.d30}
              deltaLabel={t("kpis.vsPrev30d")}
            />
            <KpiCard
              id="ov-label-revenue"
              label={t("kpis.revenue12m")}
              value={labelView.totals.revenue12m}
              format="eur"
              deltaLabel={t("kpis.revenue12mHint")}
            />
            <KpiCard
              id="ov-label-valuation"
              label={t("kpis.valuation")}
              value={labelView.totals.valuationMid}
              format="eur"
              deltaLabel={t("kpis.valuationHint")}
            />
          </div>

          {/* Grille roster cliquable */}
          <section>
            <h2 className="font-heading text-base font-semibold tracking-tight">
              {t("roster.title")}
            </h2>
            <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
              {t("roster.subtitle")}
            </p>
            <RosterGrid
              rows={labelView.rows}
              labels={{
                streams30d: t("roster.streams30d"),
                revenue12m: t("roster.revenue12m"),
                margin: t("roster.margin"),
                day1Index: t("roster.day1Index"),
                zoom: (name) => t("roster.zoom", { name }),
              }}
              onSelect={setFocusedArtistId}
            />
          </section>

          {/* Revenus × streams agrégés */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              {t("chart.title")}
            </h2>
            <RevenueStreamsChart
              data={labelView.composed}
              revenueLabel={t("chart.revenue")}
              streamsLabel={t("chart.streams")}
            />
          </section>
        </div>
      )}
    </div>
  );
}

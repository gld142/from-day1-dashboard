"use client";

/**
 * /algo-position — "X-RAY" : où l'artiste se situe dans l'algorithme Spotify.
 * Part algorithmique, décomposition par surface de reco, évolution 90 j,
 * signaux actionnables et carte pédagogique "comment l'algo te voit".
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  BookmarkCheck,
  CircleCheck,
  Compass,
  Eye,
  Play,
  Radar,
  Radio,
  Shuffle,
  type LucideIcon,
} from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { DeltaChip, KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  PERCEPTION_THRESHOLDS,
  algoHealthScore,
  algoMixSeries,
  algoPerception,
  algoShare,
  algoSourceBreakdown,
  releaseRadarBoost,
  type AlgoSourceId,
} from "@/components/modules/algo/algo-data";
import {
  AlgoMixChart,
  MIX_COLORS,
  type MixKey,
} from "@/components/modules/algo/algo-mix-chart";
import {
  InsightCard,
  type InsightTone,
} from "@/components/modules/pilotage/insight-card";
import { Progress } from "@/components/ui/progress";
import {
  ARTISTS,
  PROJECTS,
  dailyTotals,
  getArtist,
  streamsDelta,
} from "@/lib/demo/api";
import { hashString } from "@/lib/demo/seed";
import { fmtCompact } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";

const SOURCE_ICONS: Record<AlgoSourceId, LucideIcon> = {
  discoverWeekly: Compass,
  releaseRadar: Radar,
  radio: Radio,
  autoplay: Play,
  dailyMix: Shuffle,
};

const SOURCE_COLORS: Record<AlgoSourceId, string> = {
  discoverWeekly: "var(--chart-1)",
  releaseRadar: "var(--chart-2)",
  radio: "var(--chart-3)",
  autoplay: "var(--chart-4)",
  dailyMix: "var(--chart-5)",
};

const MIX_KEYS: MixKey[] = ["algorithmic", "editorial", "organic"];

function latestRelease(artistId: string) {
  return PROJECTS.filter((p) => p.artistId === artistId).sort((a, b) =>
    b.releaseDate.localeCompare(a.releaseDate),
  )[0];
}

export default function AlgoPositionPage() {
  const t = useTranslations("algoposition");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId, setFocusedArtistId } = useRole();
  const aggregated = isLabel && !focusedArtistId;

  const artist = getArtist(artistId);
  const dec = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);

  /* ─── Dérivations artiste ─── */
  const share = algoShare(artistId);
  const score = algoHealthScore(artistId);
  const breakdown = useMemo(() => algoSourceBreakdown(artistId), [artistId]);
  const mix = useMemo(() => algoMixSeries(artistId, 90), [artistId]);
  const daily28 = useMemo(() => dailyTotals(artistId, 28), [artistId]);
  const perception = algoPerception(artistId);

  const rr = breakdown.find((b) => b.id === "releaseRadar")!;
  const radioStreams = breakdown
    .filter((b) => b.id === "radio" || b.id === "autoplay")
    .reduce((s, b) => s + b.streams28d, 0);

  const delta28 = streamsDelta(artistId, 28);
  const shareDelta = (hashString(`${artistId}:algo:share-delta`) % 700) / 100 - 1.5;
  const rrDelta = delta28 + (hashString(`${artistId}:algo:rr-delta`) % 1500) / 100;
  const radioDelta =
    delta28 + (hashString(`${artistId}:algo:radio-delta`) % 1000) / 100 - 3;

  /* ─── Signaux ─── */
  const release = latestRelease(artistId);
  const rrBoost = releaseRadarBoost(artistId);
  const dwShare = breakdown.find((b) => b.id === "discoverWeekly")!.sharePct;
  const dwRosterAvg =
    ARTISTS.reduce(
      (s, a) =>
        s +
        algoSourceBreakdown(a.id).find((b) => b.id === "discoverWeekly")!.sharePct,
      0,
    ) / ARTISTS.length;
  const dwDiff = dwShare - dwRosterAvg;
  const saveOk = perception.saveRate >= PERCEPTION_THRESHOLDS.saveRate;
  const completionOk = perception.completion >= PERCEPTION_THRESHOLDS.completion;

  const signals: Array<{
    key: string;
    icon: LucideIcon;
    tone: InsightTone;
    kicker: string;
    body: string;
  }> = [
    {
      key: "rr",
      icon: Radar,
      tone: "success",
      kicker: t("signals.rrKicker"),
      body: t("signals.rrBody", { title: release?.title ?? "—", pct: dec(rrBoost) }),
    },
    {
      key: "save",
      icon: BookmarkCheck,
      tone: saveOk ? "success" : "warning",
      kicker: t("signals.saveKicker"),
      body: saveOk
        ? t("signals.saveAbove", {
            rate: dec(perception.saveRate),
            threshold: dec(PERCEPTION_THRESHOLDS.saveRate),
          })
        : t("signals.saveBelow", {
            rate: dec(perception.saveRate),
            missing: dec(PERCEPTION_THRESHOLDS.saveRate - perception.saveRate),
          }),
    },
    {
      key: "dw",
      icon: Compass,
      tone: dwDiff >= 0 ? "brand" : "muted",
      kicker: t("signals.dwKicker"),
      body:
        dwDiff >= 0
          ? t("signals.dwAbove", { share: dec(dwShare), diff: dec(dwDiff) })
          : t("signals.dwBelow", { share: dec(dwShare), diff: dec(Math.abs(dwDiff)) }),
    },
    {
      key: "completion",
      icon: CircleCheck,
      tone: completionOk ? "success" : "warning",
      kicker: t("signals.completionKicker"),
      body: completionOk
        ? t("signals.completionGood", { rate: dec(perception.completion) })
        : t("signals.completionLow", { rate: dec(perception.completion) }),
    },
  ];

  /* ─── Vue label agrégée ─── */
  const rosterRows = useMemo(
    () =>
      aggregated
        ? ARTISTS.map((a) => ({
            artist: a,
            score: algoHealthScore(a.id),
            share: algoShare(a.id),
            rr28: algoSourceBreakdown(a.id).find((b) => b.id === "releaseRadar")!
              .streams28d,
            trend: streamsDelta(a.id, 28),
          })).sort((x, y) => y.score - x.score)
        : [],
    [aggregated],
  );

  const rosterAvgShare =
    rosterRows.length === 0
      ? 0
      : rosterRows.reduce((s, r) => s + r.share, 0) / rosterRows.length;
  const rosterAvgScore =
    rosterRows.length === 0
      ? 0
      : Math.round(rosterRows.reduce((s, r) => s + r.score, 0) / rosterRows.length);

  const mixLabels: Record<MixKey, string> = {
    algorithmic: t("mix.algorithmic"),
    editorial: t("mix.editorial"),
    organic: t("mix.organic"),
  };

  const perceptionRows = [
    {
      key: "saveRate" as const,
      value: perception.saveRate,
      threshold: PERCEPTION_THRESHOLDS.saveRate,
      good: saveOk,
    },
    {
      key: "skipRate" as const,
      value: perception.skipRate,
      threshold: PERCEPTION_THRESHOLDS.skipRate,
      good: perception.skipRate <= PERCEPTION_THRESHOLDS.skipRate,
    },
    {
      key: "completion" as const,
      value: perception.completion,
      threshold: PERCEPTION_THRESHOLDS.completion,
      good: completionOk,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}
      >
        {!aggregated && isLabel && <ArtistBadge artist={artist} size="md" />}
      </PageHeader>

      {aggregated ? (
        /* ─── Vue roster (label) ─── */
        <>
          <div className="rise-in grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              id="algo-roster-share"
              label={t("roster.avgShare")}
              value={Math.round(rosterAvgShare * 10) / 10}
              format="pct"
            />
            <KpiCard
              id="algo-roster-score"
              label={t("roster.avgScore")}
              value={rosterAvgScore}
              format="int"
              deltaLabel={t("kpis.of100")}
            />
            <KpiCard
              id="algo-roster-rr"
              label={t("kpis.releaseRadar")}
              value={rosterRows.reduce((s, r) => s + r.rr28, 0)}
            />
            <KpiCard
              id="algo-roster-top"
              label={t("roster.bestScore")}
              value={rosterRows[0]?.score ?? 0}
              format="int"
              deltaLabel={rosterRows[0]?.artist.name}
            />
          </div>

          <section className="rise-in mt-4 rounded-xl border bg-card p-5">
            <h2 className="mb-1 font-heading text-base font-semibold">
              {t("roster.title")}
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {t("roster.description")}
            </p>
            <div className="flex flex-col">
              {rosterRows.map((r) => (
                <button
                  key={r.artist.id}
                  onClick={() => setFocusedArtistId(r.artist.id)}
                  className="hairline-b group flex items-center gap-3 py-3 text-left transition-colors last:shadow-none hover:bg-surface-2"
                >
                  <ArtistBadge
                    artist={r.artist}
                    size="md"
                    meta={r.artist.genre}
                    className="w-44 shrink-0"
                  />
                  <span className="num w-9 text-right text-sm font-semibold">
                    {r.score}
                  </span>
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          r.score >= 70
                            ? "bg-success"
                            : r.score >= 50
                              ? "bg-brand"
                              : "bg-warning",
                        )}
                        style={{ width: `${r.score}%` }}
                      />
                    </div>
                  </div>
                  <span className="num w-14 text-right text-xs text-muted-foreground">
                    {dec(r.share)} %
                  </span>
                  <span className="num hidden w-20 text-right text-xs text-muted-foreground md:block">
                    {fmtCompact(locale, r.rr28)}
                  </span>
                  <DeltaChip value={r.trend} />
                  <ArrowRight
                    className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
              <span>{t("roster.artist")}</span>
              <span className="flex gap-6">
                <span>{t("roster.score")}</span>
                <span>{t("roster.share")}</span>
                <span className="hidden md:inline">{t("roster.rr")}</span>
                <span>{t("roster.trend")}</span>
              </span>
            </div>
          </section>
        </>
      ) : (
        /* ─── Vue artiste ─── */
        <>
          {/* KPIs */}
          <div className="rise-in grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              id="algo-share"
              label={t("kpis.algoShare")}
              value={share}
              format="pct"
              delta={shareDelta}
              spark={mix.map((m) => ({ value: m.algorithmic }))}
              hero
            />
            <KpiCard
              id="algo-score"
              label={t("kpis.healthScore")}
              value={score}
              format="int"
              deltaLabel={t("kpis.of100")}
            />
            <KpiCard
              id="algo-rr"
              label={t("kpis.releaseRadar")}
              value={rr.streams28d}
              delta={rrDelta}
              spark={daily28.map((d) => ({
                value: (d.streams * rr.sharePct) / 100,
              }))}
              sparkColor="var(--chart-2)"
            />
            <KpiCard
              id="algo-radio"
              label={t("kpis.radio")}
              value={radioStreams}
              delta={radioDelta}
              spark={daily28.map((d) => ({
                value: (d.streams * (share - rr.sharePct)) / 100,
              }))}
              sparkColor="var(--chart-3)"
            />
          </div>

          {/* Décomposition + perception */}
          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <section className="rise-in rounded-xl border bg-card p-5 lg:col-span-3">
              <h2 className="mb-1 font-heading text-base font-semibold">
                {t("sources.title")}
              </h2>
              <p className="mb-5 text-xs text-muted-foreground">
                {t("sources.description", { share: dec(share) })}
              </p>
              <div className="flex flex-col gap-4">
                {breakdown.map((slice) => {
                  const Icon = SOURCE_ICONS[slice.id];
                  const maxShare = breakdown[0].sharePct;
                  return (
                    <div key={slice.id}>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            background: `color-mix(in oklab, ${SOURCE_COLORS[slice.id]} 14%, transparent)`,
                            color: SOURCE_COLORS[slice.id],
                          }}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {t(`sources.${slice.id}.name`)}
                        </span>
                        <span className="num text-xs text-muted-foreground">
                          {fmtCompact(locale, slice.streams28d)}
                        </span>
                        <span className="num w-14 text-right text-sm font-semibold">
                          {dec(slice.sharePct)} %
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(slice.sharePct / maxShare) * 100}%`,
                            background: SOURCE_COLORS[slice.id],
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                        {t(`sources.${slice.id}.hint`)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Comment l'algo te voit */}
            <section className="rise-in rounded-xl border bg-card p-5 lg:col-span-2">
              <h2 className="mb-1 flex items-center gap-2 font-heading text-base font-semibold">
                <Eye className="size-4 text-brand" aria-hidden />
                {t("perception.title")}
              </h2>
              <p className="mb-5 text-xs text-muted-foreground">
                {t("perception.description")}
              </p>
              <div className="flex flex-col gap-5">
                {perceptionRows.map((row) => (
                  <div key={row.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {t(`perception.${row.key}`)}
                      </span>
                      <span
                        className={cn(
                          "num text-sm font-semibold",
                          row.good ? "text-success" : "text-warning",
                        )}
                      >
                        {dec(row.value)} %
                      </span>
                    </div>
                    <div className="relative mt-2">
                      <Progress
                        value={row.value}
                        className={cn(
                          "h-1.5",
                          row.good
                            ? "[&_[data-slot=progress-indicator]]:bg-success"
                            : "[&_[data-slot=progress-indicator]]:bg-warning",
                        )}
                      />
                      <span
                        aria-hidden
                        className="absolute -top-0.5 h-2.5 w-px bg-foreground/50"
                        style={{ left: `${row.threshold}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      {t(`perception.${row.key}Hint`, {
                        threshold: dec(row.threshold),
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-lg bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {t("perception.note")}
              </p>
            </section>
          </div>

          {/* Évolution 90 j */}
          <section className="rise-in mt-4 rounded-xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-base font-semibold">
                  {t("mix.title")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("mix.description")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {MIX_KEYS.map((k) => (
                  <span
                    key={k}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: MIX_COLORS[k] }}
                    />
                    {mixLabels[k]}
                  </span>
                ))}
              </div>
            </div>
            <AlgoMixChart data={mix} labels={mixLabels} />
          </section>

          {/* Signaux */}
          <section className="rise-in mt-4">
            <h2 className="mb-3 font-heading text-base font-semibold">
              {t("signals.title")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {signals.map((s) => (
                <InsightCard
                  key={s.key}
                  icon={s.icon}
                  kicker={s.kicker}
                  body={s.body}
                  tone={s.tone}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

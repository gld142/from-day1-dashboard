"use client";

/**
 * /algo-position — "X-RAY" : où l'artiste se situe dans l'algorithme Spotify.
 * Part algorithmique, décomposition par surface de reco, évolution 90 j,
 * signaux actionnables et carte pédagogique "comment l'algo te voit".
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Compass,
  Play,
  Radar,
  Radio,
  Shuffle,
  type LucideIcon,
} from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { RankMedal } from "@/components/dashboard/rank-medal";
import {
  AffiliatedPoints,
  CenteredValue,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors, NightStrip } from "@/components/modules/pilotage/pulse-blocks";
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
  type MixKey,
} from "@/components/modules/algo/algo-mix-chart";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  ARTISTS,
  PROJECTS,
  getArtist,
  streamsDelta,
} from "@/lib/demo/api";
import { hashString } from "@/lib/demo/seed";
import { fmtCompact, fmtPct } from "@/lib/format";
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


function latestRelease(artistId: string) {
  return PROJECTS.filter((p) => p.artistId === artistId).sort((a, b) =>
    b.releaseDate.localeCompare(a.releaseDate),
  )[0];
}

export default function AlgoPositionPage() {
  const t = useTranslations("algoposition");
  const tc = useTranslations("common");
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

  const signals: Array<{ key: string; kicker: string; body: string }> = [
    {
      key: "rr",
      kicker: t("signals.rrKicker"),
      body: t("signals.rrBody", { title: release?.title ?? "—", pct: dec(rrBoost) }),
    },
    {
      key: "save",
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
      kicker: t("signals.dwKicker"),
      body:
        dwDiff >= 0
          ? t("signals.dwAbove", { share: dec(dwShare), diff: dec(dwDiff) })
          : t("signals.dwBelow", { share: dec(dwShare), diff: dec(Math.abs(dwDiff)) }),
    },
    {
      key: "completion",
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

  /** La source qui pèse le plus, et l'échelle des barres du bloc sources. */
  const topSource = breakdown.reduce((a, b) => (b.sharePct > a.sharePct ? b : a), breakdown[0]);
  const maxSourceShare = Math.max(1, ...breakdown.map((b) => b.sharePct));

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
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}>
        {!aggregated && isLabel && <ArtistBadge artist={artist} size="md" />}
      </PageHeader>

      {aggregated ? (
        /* ─── Vue roster ─── */
        <div className="space-y-3">
          <Sheet family="trends">
            <SheetHeading action={t("roster.description")}>{t("roster.title")}</SheetHeading>
            <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
              {dec(rosterAvgShare)} %
            </p>
            <p className="sheet-ink mt-1.5 text-[13px]">
              {t("roster.avgShare")} <ProvenanceBadge provenance="simulated" className="align-middle" />
            </p>
            <AffiliatedPoints
              points={[
                {
                  key: "score",
                  value: t("kpis.scoreOf", { score: rosterAvgScore }),
                  label: t("roster.avgScore"),
                },
                ...(rosterRows[0]
                  ? [
                      {
                        key: "best",
                        value: rosterRows[0].artist.name,
                        label: t("roster.bestScore"),
                        note: t("kpis.scoreOf", { score: rosterRows[0].score }),
                      },
                    ]
                  : []),
                {
                  key: "rr",
                  value: fmtCompact(locale, rosterRows.reduce((s, r) => s + r.rr28, 0)),
                  label: t("kpis.releaseRadar"),
                },
                {
                  key: "artists",
                  value: rosterRows.length,
                  label: t("roster.artist"),
                },
              ]}
            />
          </Sheet>

          <Sheet family="trends">
            <SheetHeading action={t("roster.trend")}>{t("roster.ranking")}</SheetHeading>
            <div className="mt-1">
              {rosterRows.map((r, i) => (
                <button
                  key={r.artist.id}
                  type="button"
                  onClick={() => setFocusedArtistId(r.artist.id)}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto_auto_auto] items-baseline gap-4 py-2 text-left text-[12.5px]",
                    i === 0 ? "sheet-rule" : "border-border/30 border-t",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <RankMedal rank={i + 1} size="sm" />
                    <span className="truncate">{r.artist.name}</span>
                  </span>
                  <span className="sheet-ink w-20 text-right tabular-nums">
                    {dec(r.share)} %
                  </span>
                  <span className="sheet-ink w-20 text-right tabular-nums">
                    {fmtCompact(locale, r.rr28)}
                  </span>
                  <b className="w-16 text-right font-semibold tabular-nums">
                    {t("kpis.scoreOf", { score: r.score })}
                  </b>
                </button>
              ))}
            </div>
            <p className="sheet-ink mt-2 text-[11px]">
              {t("roster.share")} · {t("roster.rr")} · {t("roster.score")}
            </p>
          </Sheet>

          <Doors
            title={tc("blocks.doors")}
            doors={[
              {
                key: "market",
                href: "/market",
                label: t("doors.market"),
                family: "trends",
                value: t("doors.marketValue"),
              },
              {
                key: "streams",
                href: "/streams",
                label: t("doors.streams"),
                family: "streams",
                value: t("doors.streamsValue"),
              },
              {
                key: "arwatch",
                href: "/ar-watch",
                label: t("doors.arwatch"),
                family: "audience",
                value: t("doors.arwatchValue"),
              },
              {
                key: "discovery",
                href: "/discovery",
                label: t("doors.discovery"),
                family: "catalog",
                value: t("doors.discoveryValue"),
              },
              {
                key: "sync",
                href: "/sync",
                label: t("doors.sync"),
                family: "money",
                value: t("doors.syncValue"),
              },
              {
                key: "catalog",
                href: "/catalog",
                label: t("doors.catalog"),
                family: "catalog",
                value: t("doors.catalogValue"),
              },
            ]}
          />
          <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
        </div>
      ) : (
        /* ─── Vue artiste ─── */
        <div className="space-y-3">
          {/* La part algorithmique, au centre de son évolution sur 90 jours. */}
          <Sheet family="trends">
            <SheetHeading action={t("mix.description")}>{t("mix.title")}</SheetHeading>
            <div className="group relative">
              <CenteredValue
                value={`${dec(share)} %`}
                caption={
                  <>
                    {t("kpis.algoShare")}{" "}
                    <b className={shareDelta >= 0 ? "text-success" : "text-destructive"}>
                      {fmtPct(locale, shareDelta)}
                    </b>{" "}
                    <ProvenanceBadge provenance="simulated" className="align-middle" />
                  </>
                }
              />
              <AlgoMixChart data={mix} labels={mixLabels} height={210} />
            </div>
            <AffiliatedPoints
              points={[
                {
                  key: "score",
                  value: t("kpis.scoreOf", { score }),
                  label: t("kpis.healthScore"),
                },
                {
                  key: "rr",
                  value: fmtCompact(locale, rr.streams28d),
                  label: t("kpis.releaseRadar"),
                  note: fmtPct(locale, rrDelta),
                },
                {
                  key: "radio",
                  value: fmtCompact(locale, radioStreams),
                  label: t("kpis.radio"),
                  note: fmtPct(locale, radioDelta),
                },
                {
                  key: "top",
                  value: t(`sources.${topSource.id}.name`),
                  label: t("sources.title"),
                  note: `${dec(topSource.sharePct)} %`,
                },
              ]}
            />
          </Sheet>

          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            {/* Les cinq portes de l'algorithme, et ce que chacune veut. */}
            <Sheet family="trends">
              <SheetHeading>{t("sources.title")}</SheetHeading>
              <p className="sheet-ink mb-1 text-xs">
                {t("sources.description", { share: dec(share) })}
              </p>
              <div className="mt-2">
                {breakdown.map((b, i) => {
                  const Icon = SOURCE_ICONS[b.id];
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "py-2.5",
                        i === 0 ? "sheet-rule" : "border-border/30 border-t",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="flex items-center gap-2 font-medium">
                          <Icon className="size-3.5 shrink-0" aria-hidden />
                          {t(`sources.${b.id}.name`)}
                        </span>
                        <span className="flex items-baseline gap-3 tabular-nums">
                          <span className="sheet-ink">{fmtCompact(locale, b.streams28d)}</span>
                          <b className="w-12 text-right font-semibold">{dec(b.sharePct)} %</b>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_14%,transparent)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(1.5, (b.sharePct / maxSourceShare) * 100)}%`,
                            background: SOURCE_COLORS[b.id],
                          }}
                        />
                      </div>
                      <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
                        {t(`sources.${b.id}.hint`)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Sheet>

            {/* Ce que l'algorithme mesure de toi. */}
            <Sheet family="audience">
              <SheetHeading>{t("perception.title")}</SheetHeading>
              <p className="sheet-ink mb-1 text-xs">{t("perception.description")}</p>
              <div className="mt-2">
                {perceptionRows.map((row, i) => (
                  <div
                    key={row.key}
                    className={cn(
                      "py-2.5",
                      i === 0 ? "sheet-rule" : "border-border/30 border-t",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className="font-medium">{t(`perception.${row.key}`)}</span>
                      <b
                        className={cn(
                          "font-semibold tabular-nums",
                          row.good ? "text-success" : "text-destructive",
                        )}
                      >
                        {dec(row.value)} %
                      </b>
                    </div>
                    <Progress value={Math.min(100, row.value)} className="mt-1.5 h-1.5" />
                    <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
                      {t(`perception.${row.key}Hint`, { threshold: dec(row.threshold) })}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-2 text-[11px]">{t("perception.note")}</p>
            </Sheet>
          </div>

          {/* Ce qu'il faut en retenir aujourd'hui. */}
          <NightStrip
            items={signals.map((s) => ({
              key: s.key,
              kicker: s.kicker,
              body: s.body,
            }))}
          />

          <Doors
            title={tc("blocks.doors")}
            doors={[
              {
                key: "market",
                href: "/market",
                label: t("doors.market"),
                family: "trends",
                value: t("doors.marketValue"),
              },
              {
                key: "streams",
                href: "/streams",
                label: t("doors.streams"),
                family: "streams",
                value: t("doors.streamsValue"),
              },
              {
                key: "audience",
                href: "/audience",
                label: t("doors.audience"),
                family: "audience",
                value: t("doors.audienceValue"),
              },
              {
                key: "catalog",
                href: "/catalog",
                label: t("doors.catalog"),
                family: "catalog",
                value: t("doors.catalogValue"),
              },
              {
                key: "sync",
                href: "/sync",
                label: t("doors.sync"),
                family: "money",
                value: t("doors.syncValue"),
              },
              {
                key: "discovery",
                href: "/discovery",
                label: t("doors.discovery"),
                family: "catalog",
                value: t("doors.discoveryValue"),
              },
            ]}
          />
          <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
        </div>
      )}
    </div>
  );
}

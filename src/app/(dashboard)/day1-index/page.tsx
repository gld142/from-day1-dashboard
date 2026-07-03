"use client";

/**
 * /day1-index — le score signature.
 * Jauge circulaire SVG animée + décomposition en 5 sous-scores calculés
 * des données réelles + leaderboard roster + preview de page publique.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  IndexGauge,
  SubScoreBar,
} from "@/components/modules/intelligence/index-gauge";
import { PublicPreview } from "@/components/modules/intelligence/public-preview";
import { Badge } from "@/components/ui/badge";
import {
  ARTISTS,
  fanSegments,
  getArtist,
  revenueBySource,
  streamsDelta,
} from "@/lib/demo/api";
import { REVENUE_SOURCES } from "@/lib/demo/types";
import { fmtCompact } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Sous-scores déterministes, dérivés des données démo. */
function useSubScores(artistId: string) {
  return useMemo(() => {
    const artist = getArtist(artistId);
    const maxListeners = Math.max(...ARTISTS.map((a) => a.monthlyListeners));

    const volume = clamp((artist.monthlyListeners / maxListeners) * 100);
    const growth = clamp(artist.growthRate * 1000);

    const activeSources = revenueBySource(artistId, 12).filter(
      (s) => s.amount > 0,
    ).length;
    const diversification = clamp((activeSources / REVENUE_SOURCES.length) * 100);

    const superfans =
      fanSegments(artistId).find((f) => f.id === "superfans")?.count ?? 0;
    const engagement = clamp((superfans / artist.monthlyListeners / 0.02) * 100);

    const momentum = clamp(50 + streamsDelta(artistId, 30) * 3);

    return { volume, growth, diversification, engagement, momentum };
  }, [artistId]);
}

export default function Day1IndexPage() {
  const t = useTranslations("day1index");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel, setFocusedArtistId } = useRole();

  const isRoster = isLabel && focusedArtistId === null;
  const artist = getArtist(artistId);
  const subScores = useSubScores(artistId);

  const ranked = useMemo(
    () => [...ARTISTS].sort((a, b) => b.day1Index - a.day1Index),
    [],
  );
  const rosterAvg =
    ARTISTS.reduce((s, a) => s + a.day1Index, 0) / ARTISTS.length;
  const bestIndex = ranked[0].day1Index;
  const spread = bestIndex - ranked[ranked.length - 1].day1Index;

  /* Percentile déterministe, dérivé du score lui-même. */
  const topPct = Math.max(1, Math.round(100 - artist.day1Index));

  const bars = [
    { key: "volume", value: subScores.volume, color: "var(--chart-1)" },
    { key: "growth", value: subScores.growth, color: "var(--chart-2)" },
    {
      key: "diversification",
      value: subScores.diversification,
      color: "var(--chart-3)",
    },
    { key: "engagement", value: subScores.engagement, color: "var(--chart-4)" },
    { key: "momentum", value: subScores.momentum, color: "var(--chart-5)" },
  ] as const;

  const leaderboard = (
    <section
      className={cn(
        "rounded-xl border bg-card p-5",
        !isRoster && "lg:col-span-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">
            {t("leaderboard.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("leaderboard.subtitle")}
          </p>
        </div>
        {isLabel && (
          <span className="hidden text-[11px] text-muted-foreground sm:block">
            {t("leaderboard.focusHint")}
          </span>
        )}
      </div>
      <ol className="mt-4 space-y-1">
        {ranked.map((a, i) => {
          const isCurrent = !isRoster && a.id === artistId;
          const row = (
            <>
              <span className="num w-5 shrink-0 text-center text-xs text-muted-foreground">
                {i + 1}
              </span>
              <ArtistBadge artist={a} meta={a.genre} className="min-w-0 flex-1" />
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {t(`stages.${a.careerStage}`)}
              </span>
              <span className="num hidden shrink-0 text-xs text-muted-foreground md:block">
                {fmtCompact(locale, a.monthlyListeners)}
              </span>
              <span className="flex w-24 shrink-0 items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${a.day1Index}%` }}
                  />
                </span>
                <span className="num w-7 text-right text-sm font-semibold">
                  {a.day1Index}
                </span>
              </span>
              {isCurrent && (
                <Badge className="shrink-0 bg-brand/10 text-brand">
                  {t("leaderboard.you")}
                </Badge>
              )}
            </>
          );
          const rowClass = cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
            isCurrent
              ? "bg-brand/5 ring-1 ring-brand/25"
              : "hover:bg-surface-2/60",
          );
          return (
            <li key={a.id}>
              {isLabel ? (
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => setFocusedArtistId(a.id)}
                >
                  {row}
                </button>
              ) : (
                <div className={rowClass}>{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );

  /* ── Vue label agrégée : moyenne + leaderboard ── */
  if (isRoster) {
    return (
      <div className="rise-in">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="brand-glow flex flex-col items-center gap-4 rounded-xl border bg-gradient-to-b from-card to-surface-2 p-6">
            <p className="text-xs font-medium text-muted-foreground">
              {t("gauge.labelAvg")}
            </p>
            <IndexGauge value={rosterAvg} />
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <div>
                <p className="num text-sm font-semibold">{ARTISTS.length}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t("gauge.artistsCount", { count: ARTISTS.length })}
                </p>
              </div>
              <div>
                <p className="num text-sm font-semibold">{bestIndex}</p>
                <p className="text-[10px] text-muted-foreground">{t("gauge.best")}</p>
              </div>
              <div>
                <p className="num text-sm font-semibold">{spread}</p>
                <p className="text-[10px] text-muted-foreground">{t("gauge.spread")}</p>
              </div>
            </div>
          </section>
          <div className="lg:col-span-2">{leaderboard}</div>
        </div>
      </div>
    );
  }

  /* ── Vue artiste (ou label zoomé) ── */
  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <Badge variant="outline">{t(`stages.${artist.careerStage}`)}</Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Jauge héro */}
        <section className="brand-glow flex flex-col items-center justify-center gap-3 rounded-xl border bg-gradient-to-b from-card to-surface-2 p-6">
          <p className="text-xs font-medium text-muted-foreground">
            {t("gauge.label")}
          </p>
          <IndexGauge value={artist.day1Index} />
          <Badge className="num bg-brand/10 text-brand">
            {t("gauge.percentile", { pct: topPct })}
          </Badge>
          <p className="text-center text-[11px] text-muted-foreground">
            {t("gauge.updated")}
          </p>
        </section>

        {/* Décomposition */}
        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="font-heading text-base font-semibold">
            {t("breakdown.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("breakdown.subtitle")}
          </p>
          <div className="mt-5 space-y-5">
            {bars.map((b, i) => (
              <SubScoreBar
                key={b.key}
                label={t(`breakdown.${b.key}`)}
                description={t(`breakdown.${b.key}Desc`)}
                value={b.value}
                color={b.color}
                delay={0.1 + i * 0.08}
              />
            ))}
          </div>
        </section>

        {leaderboard}

        <PublicPreview artist={artist} />
      </div>
    </div>
  );
}

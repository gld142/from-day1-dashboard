"use client";

/**
 * /day1-index — un score, et les cinq choses qui le font bouger.
 * Refondue le 23/09. Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Deux corrections de fond :
 *
 *  - Le badge « Top {x} % des artistes comparables » se calculait
 *    `100 - day1Index`. Il n'existait aucune population de comparaison : un
 *    score de 72 devenait « top 28 % », sans que rien n'ait été comparé. Il est
 *    remplacé par le rang dans le roster, qui lui se mesure.
 *
 *  - « Momentum », « Volume », « Diversification » : le vocabulaire
 *    d'indicateur que l'artiste ne décode pas. Les cinq dimensions disent
 *    maintenant ce qu'elles mesurent — « Élan récent : tes 30 derniers jours de
 *    streams face aux 30 d'avant ».
 *
 * La jauge et les barres n'ont plus d'animation d'entrée : voir le commentaire
 * dans `index-gauge.tsx`.
 *
 * ATTENTION — le score global (`artist.day1Index`) est une donnée stockée : il
 * n'est **pas** la moyenne des cinq dimensions affichées à côté (88 face à une
 * moyenne de 68,8 pour Dadju). La page ne prétend donc pas qu'il en découle ;
 * elle dit seulement que chaque dimension est notée sur 100. Le jour où le
 * score sera calculé, ce sera au même endroit pour toutes les pages qui
 * l'affichent — classement, page publique, roster — sous peine de les voir
 * diverger comme Pulse et Revenus l'ont fait.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import {
  IndexGauge,
  SubScoreBar,
} from "@/components/modules/intelligence/index-gauge";
import { PublicPreview } from "@/components/modules/intelligence/public-preview";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
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

const DIMENSIONS = [
  { key: "volume", color: "var(--chart-1)" },
  { key: "growth", color: "var(--chart-2)" },
  { key: "diversification", color: "var(--chart-3)" },
  { key: "engagement", color: "var(--chart-4)" },
  { key: "momentum", color: "var(--chart-5)" },
] as const;

type DimensionKey = (typeof DIMENSIONS)[number]["key"];
type SubScores = Record<DimensionKey, number>;

/** Sous-scores déterministes, dérivés des données démo. */
function subScoresFor(artistId: string): SubScores {
  const artist = getArtist(artistId);
  const maxListeners = Math.max(...ARTISTS.map((a) => a.monthlyListeners));

  const activeSources = revenueBySource(artistId, 12).filter(
    (s) => s.amount > 0,
  ).length;
  const superfans =
    fanSegments(artistId).find((f) => f.id === "superfans")?.count ?? 0;

  return {
    volume: clamp((artist.monthlyListeners / maxListeners) * 100),
    growth: clamp(artist.growthRate * 1000),
    diversification: clamp((activeSources / REVENUE_SOURCES.length) * 100),
    engagement: clamp((superfans / artist.monthlyListeners / 0.02) * 100),
    momentum: clamp(50 + streamsDelta(artistId, 30) * 3),
  };
}

export default function Day1IndexPage() {
  const t = useTranslations("day1index");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel, setFocusedArtistId } = useRole();

  const isRoster = isLabel && focusedArtistId === null;
  const artist = getArtist(artistId);

  const ranked = useMemo(
    () => [...ARTISTS].sort((a, b) => b.day1Index - a.day1Index),
    [],
  );
  const rosterAvg = ARTISTS.reduce((s, a) => s + a.day1Index, 0) / ARTISTS.length;
  const bestIndex = ranked[0].day1Index;
  const spread = bestIndex - ranked[ranked.length - 1].day1Index;

  /* Vue artiste : ses cinq dimensions. Vue roster : leur moyenne — un roster
     n'a pas d'auditeurs à lui, mais la moyenne de ses artistes se lit. */
  const scores = useMemo<SubScores>(() => {
    if (!isRoster) return subScoresFor(artistId);
    const all = ARTISTS.map((a) => subScoresFor(a.id));
    const avg = {} as SubScores;
    for (const { key } of DIMENSIONS) {
      avg[key] = Math.round(
        all.reduce((s, one) => s + one[key], 0) / Math.max(1, all.length),
      );
    }
    return avg;
  }, [isRoster, artistId]);

  /** Le rang se mesure ; le percentile d'avant était fabriqué du score lui-même. */
  const rank = ranked.findIndex((a) => a.id === artistId) + 1;

  const ordered = useMemo(
    () =>
      [...DIMENSIONS].sort((a, b) => scores[b.key] - scores[a.key]),
    [scores],
  );
  const strongest = ordered[0];
  const weakest = ordered[ordered.length - 1];

  const gaugeValue = isRoster ? rosterAvg : artist.day1Index;

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={isRoster ? t("subtitleLabel") : t("subtitle")}
      >
        {!isRoster && (
          <Badge variant="outline">{t(`stages.${artist.careerStage}`)}</Badge>
        )}
      </PageHeader>

      <div className="space-y-3">
        {/* Le score et ses cinq composantes, dans la même feuille : séparés,
            on lisait un chiffre sans sa cause. */}
        <Sheet family="trends">
          <SheetHeading action={t("gauge.updated")}>
            {isRoster ? t("gauge.labelAvg") : t("gauge.label")}
          </SheetHeading>

          <div className="mt-1 grid items-center gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
            <div className="flex justify-center lg:justify-start">
              <IndexGauge value={gaugeValue} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {DIMENSIONS.map((d) => (
                <SubScoreBar
                  key={d.key}
                  label={t(`breakdown.${d.key}`)}
                  description={t(`breakdown.${d.key}Desc`)}
                  value={scores[d.key]}
                  color={d.color}
                />
              ))}
            </div>
          </div>

          <AffiliatedPoints
            points={
              isRoster
                ? [
                    {
                      key: "artists",
                      value: String(ARTISTS.length),
                      label: t("gauge.artistsCount", { count: ARTISTS.length }),
                    },
                    {
                      key: "best",
                      value: String(bestIndex),
                      label: t("gauge.best"),
                      note: ranked[0].name,
                    },
                    {
                      key: "spread",
                      value: String(spread),
                      label: t("gauge.spread"),
                    },
                    {
                      key: "weakest",
                      value: t(`breakdown.${weakest.key}`),
                      label: t("kpis.weakest"),
                      note: t("kpis.outOf100", { value: scores[weakest.key] }),
                    },
                  ]
                : [
                    {
                      key: "rank",
                      value:
                        rank === 1
                          ? t("kpis.rankFirst")
                          : t("kpis.rankValue", { rank }),
                      label: t("kpis.rank"),
                      note: t("kpis.rankHint", { total: ARTISTS.length }),
                    },
                    {
                      key: "stage",
                      value: t(`stages.${artist.careerStage}`),
                      label: t("kpis.stage"),
                    },
                    {
                      key: "strongest",
                      value: t(`breakdown.${strongest.key}`),
                      label: t("kpis.strongest"),
                      note: t("kpis.outOf100", { value: scores[strongest.key] }),
                    },
                    {
                      key: "weakest",
                      value: t(`breakdown.${weakest.key}`),
                      label: t("kpis.weakest"),
                      note: t("kpis.outOf100", { value: scores[weakest.key] }),
                    },
                  ]
            }
          />
        </Sheet>

        {/* Le classement du roster. */}
        <Sheet family="trends">
          <SheetHeading action={isLabel ? t("leaderboard.focusHint") : t("leaderboard.subtitle")}>
            {t("leaderboard.title")}
          </SheetHeading>
          <ol className="mt-1 space-y-0.5">
            {ranked.map((a, i) => {
              const isCurrent = !isRoster && a.id === artistId;
              const row = (
                <>
                  <span className="sheet-ink w-5 shrink-0 text-center text-xs tabular-nums">
                    {i + 1}
                  </span>
                  <ArtistBadge artist={a} meta={a.genre} className="min-w-0 flex-1" />
                  <span className="sheet-ink hidden shrink-0 text-xs sm:block">
                    {t(`stages.${a.careerStage}`)}
                  </span>
                  <span className="sheet-ink hidden shrink-0 text-xs tabular-nums md:block">
                    {fmtCompact(locale, a.monthlyListeners)}
                  </span>
                  <span className="flex w-24 shrink-0 items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_16%,transparent)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${a.day1Index}%`,
                          background: "var(--sheet-line)",
                        }}
                      />
                    </span>
                    <span className="w-7 text-right text-sm font-semibold tabular-nums">
                      {a.day1Index}
                    </span>
                  </span>
                  {isCurrent && (
                    <Badge
                      /* Encre de la feuille, pas le violet de marque : un badge
                         violet sur un papier « tendances » rosé mesurait 3,90:1
                         en nuit et 4,26 à l'aube, sous le seuil AA — et il
                         affichait la couleur du produit là où la règle veut
                         celle de la famille. */
                      className="shrink-0 border-transparent bg-[color-mix(in_oklab,var(--sheet-line)_22%,transparent)] text-foreground"
                    >
                      {t("leaderboard.you")}
                    </Badge>
                  )}
                </>
              );
              const rowClass = cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                isCurrent
                  ? "bg-[color-mix(in_oklab,var(--sheet-line)_14%,transparent)]"
                  : "hover:bg-[color-mix(in_oklab,var(--sheet-line)_8%,transparent)]",
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
        </Sheet>

        {/* Ce que les pros voient — une action, pas un bloc de données. */}
        {!isRoster && <PublicPreview artist={artist} />}

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "audience",
              family: "audience",
              href: "/audience",
              label: t("doors.audience"),
              value: t("doors.audienceValue"),
            },
            {
              key: "streams",
              family: "streams",
              href: "/streams",
              label: t("doors.streams"),
              value: t("doors.streamsValue"),
            },
            {
              key: "fans",
              family: "audience",
              href: "/fans",
              label: t("doors.fans"),
              value: t("doors.fansValue"),
            },
            {
              key: "revenue",
              family: "money",
              href: "/revenue",
              label: t("doors.revenue"),
              value: t("doors.revenueValue"),
            },
            {
              key: "market",
              family: "trends",
              href: "/market",
              label: t("doors.market"),
              value: t("doors.marketValue"),
            },
            {
              key: "valuation",
              family: "money",
              href: "/valuation",
              label: t("doors.valuation"),
              value: t("doors.valuationValue"),
            },
          ]}
        />

        <RestRow
          title={isRoster ? tc("blocks.restLabel") : tc("blocks.rest")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "algo", href: "/algo-position", label: t("rest.algo") },
            { key: "discovery", href: "/discovery", label: t("rest.discovery") },
            { key: "roster", href: "/roster", label: t("rest.roster") },
            { key: "arwatch", href: "/ar-watch", label: t("rest.arwatch") },
            { key: "catalog", href: "/catalog", label: t("rest.catalog") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

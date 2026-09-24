"use client";

/**
 * /ar-watch — qui monte, et à quelle vitesse. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * « Momentum » disparaît du vocabulaire visible : l'écran dit « accélération
 * sur 30 jours » et, sous le chiffre, ce qu'on a comparé à quoi.
 *
 * Le signal fort quitte la grille pour prendre la tête de page : un A&R ouvre
 * cet écran pour savoir qui monte, pas pour chercher la carte qui porte le
 * badge. Il reste mis en avant dans le feed, où il garde son rang de tri.
 *
 * Réservé à la vue structure.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
  SheetSegments,
} from "@/components/dashboard/sheet";
import { EmergingCard } from "@/components/modules/structure/emerging-card";
import { LabelGuard } from "@/components/modules/structure/label-guard";
import { ScoringDialog } from "@/components/modules/structure/scoring-dialog";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMERGING, LABEL } from "@/lib/demo/api";
import type { EmergingArtist } from "@/lib/demo/types";
import { fmtCompact, fmtInt, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";

const ALL = "__all__";
type SortKey = "momentum" | "listeners" | "index";

const SORTERS: Record<SortKey, (a: EmergingArtist, b: EmergingArtist) => number> = {
  momentum: (a, b) => b.momentum30d - a.momentum30d,
  listeners: (a, b) => b.monthlyListeners - a.monthlyListeners,
  index: (a, b) => b.day1Index - a.day1Index,
};

export default function ArWatchPage() {
  const t = useTranslations("arwatch");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { isLabel, setPersona } = useRole();

  const [genre, setGenre] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("momentum");
  /** Watchlist en state local, initialisée depuis les données démo. */
  const [watchlist, setWatchlist] = useState<Set<string>>(
    () => new Set(EMERGING.filter((e) => e.watchlisted).map((e) => e.id)),
  );
  const [scoring, setScoring] = useState<EmergingArtist | null>(null);

  /** Le signal fort : plus forte accélération du radar sur 30 jours. */
  const topSignal = useMemo(
    () => [...EMERGING].sort((a, b) => b.momentum30d - a.momentum30d)[0] ?? null,
    [],
  );

  const genres = useMemo(
    () => Array.from(new Set(EMERGING.map((e) => e.genre))).sort(),
    [],
  );

  const feed = useMemo(
    () =>
      EMERGING.filter((e) => genre === ALL || e.genre === genre).sort(SORTERS[sort]),
    [genre, sort],
  );

  const avgMomentum = useMemo(
    () =>
      EMERGING.length === 0
        ? 0
        : EMERGING.reduce((s, e) => s + e.momentum30d, 0) / EMERGING.length,
    [],
  );
  const totalListeners = useMemo(
    () => EMERGING.reduce((s, e) => s + e.monthlyListeners, 0),
    [],
  );

  if (!isLabel) {
    return (
      <LabelGuard
        title={t("guard.title")}
        description={t("guard.description")}
        cta={t("guard.cta")}
        onSwitch={() => setPersona("label")}
      />
    );
  }

  function toggleWatch(id: string) {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: EMERGING.length, label: LABEL.name })}
      />

      <div className="space-y-3">
        {/* Qui monte le plus vite, tout de suite. */}
        <Sheet family="trends">
          <SheetHeading action={t("hero.window")}>{t("hero.title")}</SheetHeading>
          {topSignal ? (
            <>
              <p className="text-success text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
                {fmtPct(locale, topSignal.momentum30d)}
              </p>
              <p className="sheet-ink mt-1.5 text-[13px]">
                <b className="text-foreground font-semibold">{topSignal.name}</b>
                {" · "}
                {topSignal.genre}
                {" · "}
                {topSignal.country}
              </p>
            </>
          ) : (
            <p className="sheet-ink mt-1 text-[13px]">{t("hero.none")}</p>
          )}

          <AffiliatedPoints
            points={[
              {
                key: "tracked",
                value: fmtInt(locale, EMERGING.length),
                label: t("kpis.tracked"),
              },
              {
                key: "watchlisted",
                value: fmtInt(locale, watchlist.size),
                label: t("kpis.watchlisted"),
                note: t("kpis.watchlistedHint"),
              },
              {
                key: "avg",
                value: fmtPct(locale, avgMomentum),
                label: t("kpis.avgMomentum"),
                note: t("kpis.avgMomentumHint"),
              },
              {
                key: "listeners",
                value: fmtCompact(locale, totalListeners),
                label: t("kpis.listeners"),
                note: t("kpis.listenersHint"),
              },
            ]}
          />
        </Sheet>

        {/* Le radar lui-même : une carte par artiste, un objet par carte. */}
        <section className="mt-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
              {t("feedTitle")}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger size="sm" className="w-44" aria-label={t("filters.genre")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filters.allGenres")}</SelectItem>
                  {genres.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SheetSegments
                value={sort}
                onChange={setSort}
                label={t("filters.sort")}
                className="[--sheet-line:var(--border)]"
                options={(["momentum", "listeners", "index"] as const).map((v) => ({
                  value: v as SortKey,
                  label: t(
                    v === "momentum"
                      ? "filters.sortMomentum"
                      : v === "listeners"
                        ? "filters.sortListeners"
                        : "filters.sortIndex",
                  ),
                }))}
              />
            </div>
          </div>

          {feed.length === 0 ? (
            <div className="text-muted-foreground flex h-32 items-center justify-center rounded-xl border border-dashed text-sm">
              {t("empty")}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {feed.map((e) => (
                <EmergingCard
                  key={e.id}
                  artist={e}
                  hero={topSignal !== null && e.id === topSignal.id}
                  watchlisted={watchlist.has(e.id)}
                  onToggleWatch={() => toggleWatch(e.id)}
                  onScore={() => setScoring(e)}
                />
              ))}
            </div>
          )}
        </section>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "roster",
              family: "money",
              href: "/roster",
              label: t("doors.roster"),
              value: t("doors.rosterValue"),
            },
            {
              key: "market",
              family: "trends",
              href: "/market",
              label: t("doors.market"),
              value: t("doors.marketValue"),
            },
            {
              key: "discovery",
              family: "trends",
              href: "/discovery",
              label: t("doors.discovery"),
              value: t("doors.discoveryValue"),
            },
            {
              key: "index",
              family: "trends",
              href: "/day1-index",
              label: t("doors.index"),
              value: t("doors.indexValue"),
            },
            {
              key: "valuation",
              family: "money",
              href: "/valuation",
              label: t("doors.valuation"),
              value: t("doors.valuationValue"),
            },
            {
              key: "calculator",
              family: "money",
              href: "/calculator",
              label: t("doors.calculator"),
              value: t("doors.calculatorValue"),
            },
          ]}
        />
        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>

      <ScoringDialog artist={scoring} onClose={() => setScoring(null)} />
    </div>
  );
}

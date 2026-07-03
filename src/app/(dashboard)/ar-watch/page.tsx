"use client";

/**
 * /ar-watch — radar de scouting du label : feed d'artistes émergents,
 * watchlist, filtres, signal fort et scoring d'investissement.
 * Réservé à la vue structure.
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmergingCard } from "@/components/modules/structure/emerging-card";
import { LabelGuard } from "@/components/modules/structure/label-guard";
import { ScoringDialog } from "@/components/modules/structure/scoring-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMERGING, LABEL } from "@/lib/demo/api";
import type { EmergingArtist } from "@/lib/demo/types";
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
  const { isLabel, setPersona } = useRole();

  const [genre, setGenre] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("momentum");
  /** Watchlist en state local, initialisée depuis les données démo. */
  const [watchlist, setWatchlist] = useState<Set<string>>(
    () => new Set(EMERGING.filter((e) => e.watchlisted).map((e) => e.id)),
  );
  const [scoring, setScoring] = useState<EmergingArtist | null>(null);

  /** Le "signal fort" : plus gros momentum 30 j du radar. */
  const topSignal = useMemo(
    () => [...EMERGING].sort((a, b) => b.momentum30d - a.momentum30d)[0],
    [],
  );

  const genres = useMemo(
    () => Array.from(new Set(EMERGING.map((e) => e.genre))).sort(),
    [],
  );

  const feed = useMemo(
    () =>
      EMERGING.filter((e) => genre === ALL || e.genre === genre).sort(
        SORTERS[sort],
      ),
    [genre, sort],
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

  const avgMomentum =
    EMERGING.reduce((s, e) => s + e.momentum30d, 0) / EMERGING.length;

  function toggleWatch(id: string) {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rise-in space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: EMERGING.length, label: LABEL.name })}
      >
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger size="sm" aria-label={t("filters.genre")}>
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
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" aria-label={t("filters.sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="momentum">{t("filters.sortMomentum")}</SelectItem>
            <SelectItem value="listeners">{t("filters.sortListeners")}</SelectItem>
            <SelectItem value="index">{t("filters.sortIndex")}</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPIs watchlist */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          id="arwatch-tracked"
          label={t("kpis.tracked")}
          value={EMERGING.length}
          format="int"
        />
        <KpiCard
          id="arwatch-watchlisted"
          label={t("kpis.watchlisted")}
          value={watchlist.size}
          format="int"
        />
        <KpiCard
          id="arwatch-momentum"
          label={t("kpis.avgMomentum")}
          value={avgMomentum}
          format="pct"
          hero
        />
        <KpiCard
          id="arwatch-listeners"
          label={t("kpis.listeners")}
          value={EMERGING.reduce((s, e) => s + e.monthlyListeners, 0)}
          format="compact"
        />
      </section>

      {/* Feed de scouting — le signal fort est mis en avant */}
      <section>
        <p className="mb-3 text-[11px] text-muted-foreground">{t("signal.hint")}</p>
        {feed.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {feed.map((e) => (
              <EmergingCard
                key={e.id}
                artist={e}
                hero={e.id === topSignal.id}
                watchlisted={watchlist.has(e.id)}
                onToggleWatch={() => toggleWatch(e.id)}
                onScore={() => setScoring(e)}
              />
            ))}
          </div>
        )}
      </section>

      <ScoringDialog artist={scoring} onClose={() => setScoring(null)} />
    </div>
  );
}

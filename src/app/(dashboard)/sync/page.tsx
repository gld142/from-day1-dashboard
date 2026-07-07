"use client";

/**
 * Sync & Licensing — le catalogue exposé aux superviseurs (pub, film, jeu).
 * Briefs fictifs déterministes + matching seedé contre le catalogue réel.
 */

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Film,
  Gamepad2,
  HandCoins,
  Inbox,
  MonitorPlay,
  Music4,
  Send,
  TriangleAlert,
  Tv,
} from "lucide-react";
import { ARTISTS, SPLITS, TRACKS, getArtist, revenueSeries } from "@/lib/demo/api";
import type { Artist, Track } from "@/lib/demo/types";
import { hashString } from "@/lib/demo/seed";
import { fmtDate, fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArtistBadge } from "@/components/dashboard/artist-badge";

/* ─────────────────────────── Constantes démo ─────────────────────────── */

const MOODS = [
  "melancholic",
  "energetic",
  "nocturnal",
  "cinematic",
  "dreamy",
  "dark",
  "uplifting",
  "raw",
] as const;
type Mood = (typeof MOODS)[number];

type BriefType = "tv" | "series" | "game" | "film";

type Brief = {
  id: string;
  brand: string;
  type: BriefType;
  budgetLow: number;
  budgetHigh: number;
  deadline: string; // ISO — figé pour la démo
  mood: Mood;
};

const BRIEFS: Brief[] = [
  {
    id: "nova-tv",
    brand: "Nova Motors",
    type: "tv",
    budgetLow: 18_000,
    budgetHigh: 35_000,
    deadline: "2026-07-17",
    mood: "energetic",
  },
  {
    id: "palier-series",
    brand: "Studio Palier",
    type: "series",
    budgetLow: 8_000,
    budgetHigh: 15_000,
    deadline: "2026-07-28",
    mood: "nocturnal",
  },
  {
    id: "helios-game",
    brand: "Helios Games",
    type: "game",
    budgetLow: 22_000,
    budgetHigh: 45_000,
    deadline: "2026-08-14",
    mood: "cinematic",
  },
  {
    id: "meridien-film",
    brand: "Les Films du Méridien",
    type: "film",
    budgetLow: 3_000,
    budgetHigh: 7_000,
    deadline: "2026-07-10",
    mood: "melancholic",
  },
  {
    id: "ondine-tv",
    brand: "Maison Ondine",
    type: "tv",
    budgetLow: 12_000,
    budgetHigh: 20_000,
    deadline: "2026-08-03",
    mood: "dreamy",
  },
];

const BRIEF_ICON: Record<BriefType, React.ComponentType<{ className?: string }>> = {
  tv: MonitorPlay,
  series: Tv,
  game: Gamepad2,
  film: Film,
};

/* ─────────────────────────── Dérivations seedées ─────────────────────────── */

function trackMoods(trackId: string): [Mood, Mood] {
  const h = hashString(`sync:mood:${trackId}`);
  const m1 = MOODS[h % MOODS.length];
  let m2 = MOODS[(h >>> 4) % MOODS.length];
  if (m2 === m1) m2 = MOODS[((h % MOODS.length) + 3) % MOODS.length];
  return [m1, m2];
}

function trackBpm(trackId: string): number {
  return 72 + (hashString(`sync:bpm:${trackId}`) % 89);
}

function trackScore(briefId: string, track: Track, briefMood: Mood): number {
  const base = 40 + (hashString(`sync:score:${briefId}:${track.id}`) % 45);
  const moods = trackMoods(track.id);
  return Math.min(96, base + (moods.includes(briefMood) ? 12 : 0));
}

function artistMatch(briefId: string, artist: Artist, bestTrackScore: number): number {
  const base = 52 + (hashString(`sync:match:${briefId}:${artist.id}`) % 25);
  return Math.min(97, Math.round(base * 0.55 + bestTrackScore * 0.45));
}

function pipelineFor(artistId: string) {
  const h = hashString(`sync:pipe:${artistId}`);
  return {
    proposed: 1 + (h % 2),
    negotiation: 1 + ((h >>> 3) % 2),
    signed: (h >>> 6) % 3,
  };
}

function fmtTrackDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/* ─────────────────────────── Page ─────────────────────────── */

const CATALOG_LIMIT = 12;

export default function SyncPage() {
  const t = useTranslations("sync");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId } = useRole();
  const aggregated = isLabel && !focusedArtistId;

  // Filtre artiste local (vue label agrégée uniquement).
  const [filter, setFilter] = useState<string>("all");
  const [proposed, setProposed] = useState<string[]>([]);

  const scopeIds = useMemo(() => {
    if (!aggregated) return [artistId];
    return filter === "all" ? ARTISTS.map((a) => a.id) : [filter];
  }, [aggregated, artistId, filter]);
  const multiArtist = scopeIds.length > 1;

  const splitsByTrack = useMemo(
    () => new Map(SPLITS.map((s) => [s.trackId, s.status])),
    [],
  );

  const data = useMemo(() => {
    const ids = new Set(scopeIds);
    const tracks = TRACKS.filter((tr) => ids.has(tr.artistId));
    const ready = tracks.filter((tr) => splitsByTrack.get(tr.id) === "signed");

    // Revenus sync : 12 derniers mois vs 12 précédents + spark mensuel.
    let cur = 0;
    let prev = 0;
    const monthly = new Map<string, number>();
    for (const id of scopeIds) {
      const series = revenueSeries(id, 24);
      const months = Array.from(new Set(series.map((p) => p.month))).sort();
      const last12 = new Set(months.slice(-12));
      const prev12 = new Set(months.slice(-24, -12));
      for (const p of series) {
        if (p.source !== "sync") continue;
        if (last12.has(p.month)) {
          cur += p.amount;
          monthly.set(p.month, (monthly.get(p.month) ?? 0) + p.amount);
        } else if (prev12.has(p.month)) {
          prev += p.amount;
        }
      }
    }
    const spark = Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => ({ value }));

    // Briefs : meilleur artiste du scope + meilleurs titres à proposer.
    const briefs = BRIEFS.map((brief) => {
      const perArtist = scopeIds.map((id) => {
        const artist = getArtist(id);
        const scored = tracks
          .filter((tr) => tr.artistId === id)
          .map((tr) => ({ track: tr, score: trackScore(brief.id, tr, brief.mood) }))
          .sort((a, b) => b.score - a.score);
        const best = scored[0]?.score ?? 0;
        return { artist, scored, match: artistMatch(brief.id, artist, best) };
      });
      const bestArtist = perArtist.sort((a, b) => b.match - a.match)[0];
      return {
        brief,
        artist: bestArtist.artist,
        match: bestArtist.match,
        topTracks: bestArtist.scored.slice(0, 3),
      };
    }).sort((a, b) => b.match - a.match);

    // Pipeline : compteurs seedés, sommés sur le scope.
    const pipe = scopeIds.reduce(
      (acc, id) => {
        const p = pipelineFor(id);
        return {
          proposed: acc.proposed + p.proposed,
          negotiation: acc.negotiation + p.negotiation,
          signed: acc.signed + p.signed,
        };
      },
      { proposed: 0, negotiation: 0, signed: 0 },
    );

    const catalog = [...tracks].sort((a, b) => b.weight - a.weight);

    return {
      tracks,
      readyCount: ready.length,
      syncCur: cur,
      syncDelta: prev === 0 ? 0 : ((cur - prev) / prev) * 100,
      spark,
      briefs,
      pipe,
      catalog,
    };
  }, [scopeIds, splitsByTrack]);

  const proposalsCount = data.pipe.proposed + proposed.length;
  const focused = !aggregated && isLabel ? getArtist(artistId) : null;

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={aggregated ? t("subtitleLabel") : t("subtitle")}
      >
        {focused && <ArtistBadge artist={focused} size="md" />}
        {aggregated && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              {ARTISTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      {/* ─── KPIs ─── */}
      <div className="rise-in grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          id="sync-ready"
          label={t("kpis.readyTracks")}
          value={data.readyCount}
          format="int"
          deltaLabel={t("kpis.readyHint", { total: data.tracks.length })}
        />
        <KpiCard
          id="sync-briefs"
          label={t("kpis.briefs")}
          value={BRIEFS.length}
          format="int"
          deltaLabel={t("kpis.briefsHint")}
        />
        <KpiCard
          id="sync-proposals"
          label={t("kpis.proposals")}
          value={proposalsCount}
          format="int"
          deltaLabel={t("kpis.proposalsHint")}
        />
        <KpiCard
          id="sync-revenue"
          label={t("kpis.syncRevenue")}
          value={data.syncCur}
          format="eur"
          delta={data.syncDelta}
          deltaLabel={t("kpis.syncRevenueHint")}
          spark={data.spark}
          sparkColor="var(--chart-4)"
        />
      </div>

      {/* ─── Briefs ouverts ─── */}
      <section className="rise-in mt-4">
        <div className="mb-3">
          <h2 className="font-heading text-base font-semibold">{t("briefs.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("briefs.subtitle")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.briefs.map(({ brief, artist, match, topTracks }) => {
            const Icon = BRIEF_ICON[brief.type];
            const isProposed = proposed.includes(brief.id);
            return (
              <article
                key={brief.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                      <Icon className="size-4 text-brand" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">
                        {brief.brand}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t(`briefs.types.${brief.type}`)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="num rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                      {match} %
                    </span>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {t("briefs.match")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="num">
                    {t("briefs.budget")}{" "}
                    {fmtEur(locale, brief.budgetLow, { compact: true })}–
                    {fmtEur(locale, brief.budgetHigh, { compact: true })}
                  </span>
                  <span className="num">
                    {t("briefs.deadline", {
                      date: fmtDate(locale, brief.deadline, {
                        day: "numeric",
                        month: "short",
                      }),
                    })}
                  </span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {t(`moods.${brief.mood}`)}
                  </Badge>
                </div>

                {multiArtist && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {t("briefs.bestArtist")}
                    </span>
                    <ArtistBadge artist={artist} size="sm" />
                  </div>
                )}

                <div className="flex-1">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("briefs.bestTracks")}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {topTracks.map(({ track, score }) => (
                      <li key={track.id} className="flex items-center gap-2 text-xs">
                        <Music4
                          className="size-3 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{track.title}</span>
                        <span className="h-1 w-14 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className="block h-full rounded-full bg-brand/70"
                            style={{ width: `${score}%` }}
                            aria-hidden
                          />
                        </span>
                        <span className="num w-8 text-right text-[11px] text-muted-foreground">
                          {score}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isProposed ? (
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
                    <Check className="size-3.5" aria-hidden />
                    {t("briefs.proposed")}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setProposed((p) => [...p, brief.id])}
                  >
                    <Send className="size-3.5" aria-hidden />
                    {t("briefs.propose")}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        {/* ─── Catalogue tagué ─── */}
        <section className="rise-in rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="font-heading text-base font-semibold">{t("catalog.title")}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t("catalog.subtitle")}</p>
          <ul className="flex flex-col">
            {data.catalog.slice(0, CATALOG_LIMIT).map((track) => {
              const [m1, m2] = trackMoods(track.id);
              const signed = splitsByTrack.get(track.id) === "signed";
              const artist = getArtist(track.artistId);
              return (
                <li
                  key={track.id}
                  className="hairline-b flex items-center gap-3 py-2.5 last:shadow-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {track.title}
                    </p>
                    {multiArtist && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {artist.name}
                      </p>
                    )}
                  </div>
                  <span className="hidden gap-1 sm:flex">
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {t(`moods.${m1}`)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {t(`moods.${m2}`)}
                    </Badge>
                  </span>
                  <span className="num hidden w-16 text-right text-xs text-muted-foreground md:block">
                    {trackBpm(track.id)} {t("catalog.bpm")}
                  </span>
                  <span className="num hidden w-10 text-right text-xs text-muted-foreground md:block">
                    {fmtTrackDuration(track.durationSec)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex w-32 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      signed
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning",
                    )}
                  >
                    {signed ? (
                      <Check className="size-3" aria-hidden />
                    ) : (
                      <TriangleAlert className="size-3" aria-hidden />
                    )}
                    {signed ? t("catalog.splitsOk") : t("catalog.splitsWarning")}
                  </span>
                </li>
              );
            })}
          </ul>
          {data.catalog.length > CATALOG_LIMIT && (
            <p className="num mt-3 text-[11px] text-muted-foreground">
              {t("catalog.more", { count: data.catalog.length - CATALOG_LIMIT })}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {/* ─── Pipeline ─── */}
          <section className="rise-in rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <Inbox className="size-4 text-brand" aria-hidden />
              {t("pipeline.title")}
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">{t("pipeline.subtitle")}</p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["received", BRIEFS.length],
                  ["proposed", proposalsCount],
                  ["negotiation", data.pipe.negotiation],
                  ["signed", data.pipe.signed],
                ] as const
              ).map(([key, count], i) => (
                <div
                  key={key}
                  className={cn(
                    "rounded-lg bg-surface-2 px-2 py-3 text-center",
                    i === 3 && "bg-success/10",
                  )}
                >
                  <p
                    className={cn(
                      "num text-lg font-semibold leading-none",
                      i === 3 && "text-success",
                    )}
                  >
                    {count}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
                    {t(`pipeline.${key}`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Commission ─── */}
          <section className="rise-in rounded-xl border bg-gradient-to-b from-card to-surface-2 p-5">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <HandCoins className="size-4 text-brand" aria-hidden />
              {t("commission.title")}
            </h2>
            <p className="num mt-3 text-3xl font-semibold tracking-tight">
              {t("commission.rate")}
            </p>
            <p className="text-xs text-muted-foreground">{t("commission.rateLabel")}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {t("commission.body")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

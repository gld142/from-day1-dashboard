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
  MonitorPlay,
  Music4,
  Send,
  TriangleAlert,
  Tv,
} from "lucide-react";
import { ARTISTS, SPLITS, TRACKS, getArtist, revenueSeries } from "@/lib/demo/api";
import type { Artist, Track } from "@/lib/demo/types";
import { hashString } from "@/lib/demo/seed";
import { fmtDate, fmtEur, fmtInt, fmtPct } from "@/lib/format";
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
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
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
  const tc = useTranslations("common");
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

      <div className="space-y-3">
      {/* Ce que le sync rapporte, et l'état du pipeline. */}
      <Sheet family="money">
        <SheetHeading action={t("hero.caption")}>{t("hero.title")}</SheetHeading>
        <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
          {fmtEur(locale, data.syncCur, { compact: data.syncCur >= 100_000 })}
        </p>
        <p className="sheet-ink mt-1.5 text-[13px]">
          <b className={data.syncDelta >= 0 ? "text-success" : "text-destructive"}>
            {fmtPct(locale, data.syncDelta)}
          </b>{" "}
          {t("kpis.syncRevenueHint")}
        </p>
        <AffiliatedPoints
          points={[
            {
              key: "ready",
              value: fmtInt(locale, data.readyCount),
              label: t("kpis.readyTracks"),
              note: t("kpis.readyHint", { total: data.tracks.length }),
            },
            {
              key: "briefs",
              value: fmtInt(locale, BRIEFS.length),
              label: t("kpis.briefs"),
              note: t("kpis.briefsHint"),
            },
            {
              key: "proposals",
              value: fmtInt(locale, proposalsCount),
              label: t("kpis.proposals"),
              note: t("kpis.proposalsHint"),
            },
            {
              key: "signed",
              value: fmtInt(locale, data.pipe.signed),
              label: t("kpis.signed"),
              note: t("kpis.signedHint"),
            },
          ]}
        />
      </Sheet>

      {/* ─── Briefs ouverts ─── */}
      <section className="mt-1">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            {t("briefs.title")}
          </h2>
          <p className="text-muted-foreground text-[11.5px]">{t("briefs.subtitle")}</p>
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

      <div className="grid items-start gap-3 lg:grid-cols-3">
        {/* ─── Catalogue tagué ─── */}
        <Sheet family="catalog" className="lg:col-span-2">
          <SheetHeading action={t("catalog.subtitle")}>
            {t("catalog.title")}
          </SheetHeading>
          <ul className="mt-1 flex flex-col">
            {data.catalog.slice(0, CATALOG_LIMIT).map((track) => {
              const [m1, m2] = trackMoods(track.id);
              const signed = splitsByTrack.get(track.id) === "signed";
              const artist = getArtist(track.artistId);
              return (
                <li
                  key={track.id}
                  className="border-border/50 flex items-center gap-3 border-t py-2.5 first:border-t-0"
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
            <p className="sheet-ink mt-3 text-[11px] tabular-nums">
              {t("catalog.more", { count: data.catalog.length - CATALOG_LIMIT })}
            </p>
          )}
        </Sheet>

        <div className="flex flex-col gap-3">
          {/* ─── Pipeline ─── */}
          <Sheet family="money">
            <SheetHeading action={t("pipeline.subtitle")}>
              {t("pipeline.title")}
            </SheetHeading>
            <div className="mt-1 grid grid-cols-4 gap-2">
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
                    "rounded-lg px-2 py-3 text-center",
                    i === 3
                      ? "bg-success/10"
                      : "bg-[color-mix(in_oklab,var(--sheet-line)_12%,transparent)]",
                  )}
                >
                  <p
                    className={cn(
                      "text-lg leading-none font-semibold tabular-nums",
                      i === 3 && "text-success",
                    )}
                  >
                    {count}
                  </p>
                  <p className="sheet-ink mt-1.5 text-[10px] leading-tight">
                    {t(`pipeline.${key}`)}
                  </p>
                </div>
              ))}
            </div>
          </Sheet>

          {/* ─── Commission ─── */}
          <Sheet family="money">
            <SheetHeading>{t("commission.title")}</SheetHeading>
            <p className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">
              {t("commission.rate")}
            </p>
            <p className="sheet-ink text-xs">{t("commission.rateLabel")}</p>
            <p className="sheet-ink mt-2 text-[11.5px] leading-relaxed">
              {t("commission.body")}
            </p>
          </Sheet>
        </div>
      </div>

      <Doors
        title={tc("blocks.doors")}
        doors={[
          { key: "splits", family: "money", href: "/splits", label: t("doors.splits"), value: t("doors.splitsValue") },
          { key: "catalog", family: "catalog", href: "/catalog", label: t("doors.catalog"), value: t("doors.catalogValue") },
          { key: "revenue", family: "money", href: "/revenue", label: t("doors.revenue"), value: t("doors.revenueValue") },
          { key: "discovery", family: "trends", href: "/discovery", label: t("doors.discovery"), value: t("doors.discoveryValue") },
          { key: "contracts", family: "money", href: "/contracts", label: t("doors.contracts"), value: t("doors.contractsValue") },
          { key: "rights", family: "money", href: "/rights", label: t("doors.rights"), value: t("doors.rightsValue") },
        ]}
      />

      <RestRow
        title={aggregated ? tc("blocks.restLabel") : tc("blocks.rest")}
        items={[
          { key: "pulse", href: "/pulse", label: t("rest.pulse") },
          { key: "fans", href: "/fans", label: t("rest.fans") },
          { key: "tour", href: "/tour", label: t("rest.tour") },
          { key: "market", href: "/market", label: t("rest.market") },
          { key: "valuation", href: "/valuation", label: t("rest.valuation") },
          { key: "team", href: "/team", label: t("rest.team") },
        ]}
      />

      <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}

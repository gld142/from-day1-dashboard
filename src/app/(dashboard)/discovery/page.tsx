"use client";

/**
 * /discovery — Discovery Lab : le potentiel des inédits AVANT sortie.
 * L'artiste "uploade" ses démos, l'IA les score : Discovery Score global,
 * sous-scores (TikTok, playlists, hits, hook), podium + méthodologie.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import NumberFlow from "@number-flow/react";
import {
  ArrowRight,
  AudioLines,
  History,
  Loader,
  Music2,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  DemoCompareChart,
  demoColor,
} from "@/components/modules/algo/demo-compare-chart";
import {
  DEMO_SUB_KEYS,
  demoTier,
  demosFor,
  firstWeekEstimate,
  fmtDurationSec,
  type DemoTier,
  type DemoTrack,
} from "@/components/modules/algo/discovery-data";
import { UploadDemoDialog } from "@/components/modules/algo/upload-demo-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ARTISTS, getArtist } from "@/lib/demo/api";
import { fmtCompact, fmtInt } from "@/lib/format";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";

const TIER_CLASSES: Record<DemoTier, string> = {
  priority: "border-brand/50 bg-brand/10 text-brand",
  strong: "border-success/40 bg-success/10 text-success",
  promising: "border-border text-foreground",
  development: "border-border text-muted-foreground",
};

function TierBadge({ tier, label }: { tier: DemoTier; label: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", TIER_CLASSES[tier])}>
      {tier === "priority" && <Sparkles aria-hidden />}
      {label}
    </Badge>
  );
}

function DemoMeta({ demo, bpmLabel }: { demo: DemoTrack; bpmLabel: string }) {
  return (
    <span className="num text-[11px] text-muted-foreground">
      {fmtDurationSec(demo.durationSec)} · {demo.bpm} {bpmLabel} · {demo.key}
    </span>
  );
}

export default function DiscoveryPage() {
  const t = useTranslations("discovery");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId, setFocusedArtistId } = useRole();
  const aggregated = isLabel && !focusedArtistId;

  const artist = getArtist(artistId);
  const demos = useMemo(() => demosFor(artistId), [artistId]);
  const best = demos[0];
  const avgScore = Math.round(
    demos.reduce((s, d) => s + d.score, 0) / demos.length,
  );
  const estimate = firstWeekEstimate(artistId, best);

  /* Démos "en analyse…" ajoutées via le Dialog (state local, démo produit). */
  const [pending, setPending] = useState<string[]>([]);
  useEffect(() => setPending([]), [artistId]);

  const subLabels = {
    tiktok: t("scores.tiktok"),
    playlist: t("scores.playlist"),
    hit: t("scores.hit"),
    hook: t("scores.hook"),
  } as const;

  /* ─── Vue label agrégée : meilleurs inédits du roster ─── */
  const rosterBest = useMemo(
    () =>
      aggregated
        ? ARTISTS.map((a) => ({ artist: a, demo: demosFor(a.id)[0] })).sort(
            (x, y) => y.demo.score - x.demo.score,
          )
        : [],
    [aggregated],
  );

  const methodItems: Array<{ key: string; icon: LucideIcon }> = [
    { key: "audio", icon: AudioLines },
    { key: "market", icon: TrendingUp },
    { key: "history", icon: History },
  ];

  const methodCard = (
    <section className="rise-in mt-4 rounded-xl border bg-card p-5">
      <h2 className="mb-1 font-heading text-base font-semibold">
        {t("method.title")}
      </h2>
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
        {t("method.description")}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {methodItems.map(({ key, icon: Icon }) => (
          <div key={key} className="rounded-lg bg-surface-2 p-4">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <p className="mt-2.5 text-sm font-medium">{t(`method.${key}.title`)}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {t(`method.${key}.description`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );

  if (aggregated) {
    return (
      <div>
        <PageHeader title={t("title")} subtitle={t("subtitleLabel")}>
          <Select onValueChange={(v) => setFocusedArtistId(v)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t("rosterView.selectArtist")} />
            </SelectTrigger>
            <SelectContent>
              {ARTISTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PageHeader>

        <section className="rise-in rounded-xl border bg-card p-5">
          <h2 className="mb-1 font-heading text-base font-semibold">
            {t("rosterView.title")}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {t("rosterView.description")}
          </p>
          <div className="flex flex-col">
            {rosterBest.map(({ artist: a, demo }) => (
              <button
                key={a.id}
                onClick={() => setFocusedArtistId(a.id)}
                className="hairline-b group flex items-center gap-3 py-3 text-left transition-colors last:shadow-none hover:bg-surface-2"
              >
                <ArtistBadge artist={a} size="md" meta={a.genre} className="w-44 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {demo.title}
                  </span>
                  <DemoMeta demo={demo} bpmLabel={t("list.bpm")} />
                </span>
                <div className="hidden w-28 shrink-0 sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${demo.score}%` }}
                    />
                  </div>
                </div>
                <span className="num w-14 text-right text-sm font-semibold">
                  {demo.score}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    /100
                  </span>
                </span>
                <span className="hidden md:block">
                  <TierBadge tier={demoTier(demo)} label={t(`tiers.${demoTier(demo)}`)} />
                </span>
                <ArrowRight
                  className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {t("rosterView.hint")}
          </p>
        </section>

        {methodCard}
      </div>
    );
  }

  /* ─── Vue artiste : le lab complet ─── */
  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {isLabel && <ArtistBadge artist={artist} size="md" />}
        <UploadDemoDialog onAdd={(title) => setPending((p) => [...p, title])} />
      </PageHeader>

      {/* KPIs */}
      <div className="rise-in grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          id="disc-count"
          label={t("kpis.demos")}
          value={demos.length + pending.length}
          format="int"
        />
        <KpiCard
          id="disc-best"
          label={t("kpis.best")}
          value={best.score}
          format="int"
          deltaLabel={best.title}
          hero
        />
        <KpiCard
          id="disc-avg"
          label={t("kpis.avg")}
          value={avgScore}
          format="int"
          deltaLabel={t("kpis.of100")}
        />
        <KpiCard
          id="disc-estimate"
          label={t("kpis.firstWeek")}
          value={estimate}
          deltaLabel={t("kpis.firstWeekHint")}
        />
      </div>

      {/* Podium : le meilleur inédit */}
      <section className="rise-in brand-glow mt-4 rounded-2xl border bg-gradient-to-b from-card to-surface-2 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-brand">
              <Trophy className="size-3.5" aria-hidden />
              {t("podium.kicker")}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
              {best.title}
            </h2>
            <div className="mt-1.5">
              <DemoMeta demo={best} bpmLabel={t("list.bpm")} />
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("podium.reason", {
                hook: fmtInt(locale, best.sub.hook),
                tiktok: fmtInt(locale, best.sub.tiktok),
                playlist: fmtInt(locale, best.sub.playlist),
              })}
            </p>
            <p className="num mt-3 text-xs text-muted-foreground">
              {t("podium.estimate", { streams: fmtCompact(locale, estimate) })}
            </p>
          </div>
          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="num text-5xl font-semibold tracking-tight">
                <NumberFlow
                  value={best.score}
                  format={{ maximumFractionDigits: 0 }}
                  locales={locale}
                />
              </span>
              <span className="num text-sm text-muted-foreground">/100</span>
            </div>
            <div className="flex flex-col gap-3">
              {DEMO_SUB_KEYS.map((k, i) => (
                <div key={k}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      {subLabels[k]}
                    </span>
                    <span className="num text-xs font-semibold">
                      {best.sub[k]}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${best.sub[k]}%`,
                        background: demoColor(i),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Liste des inédits */}
        <section className="rise-in rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-heading text-base font-semibold">
            {t("list.title")}
          </h2>
          <div className="flex flex-col gap-3">
            {pending.map((title, i) => (
              <div
                key={`pending-${i}`}
                className="flex items-center gap-3 rounded-lg border border-dashed bg-surface-2/50 p-3"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Loader className="size-4 animate-spin" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("list.analyzing")}
                  </span>
                </span>
                <Badge variant="outline" className="animate-pulse rounded-full">
                  {t("list.analyzingBadge")}
                </Badge>
              </div>
            ))}
            {demos.map((d) => {
              const tier = demoTier(d);
              return (
                <div
                  key={d.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors hover:bg-surface-2/50",
                    tier === "priority" && "border-brand/40",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
                      <Music2 className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {d.title}
                      </span>
                      <DemoMeta demo={d} bpmLabel={t("list.bpm")} />
                    </span>
                    <TierBadge tier={tier} label={t(`tiers.${tier}`)} />
                    <span className="num w-12 text-right text-lg font-semibold">
                      {d.score}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {DEMO_SUB_KEYS.map((k, i) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground">
                          {subLabels[k]}
                        </span>
                        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${d.sub[k]}%`,
                              background: demoColor(i),
                            }}
                          />
                        </div>
                        <span className="num w-6 text-right text-[10px] text-muted-foreground">
                          {d.sub[k]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Comparaison */}
        <section className="rise-in rounded-xl border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-heading text-base font-semibold">
              {t("compare.title")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("compare.description")}
            </p>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {demos.map((d, i) => (
              <span
                key={d.id}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: demoColor(i) }}
                />
                {d.title}
              </span>
            ))}
          </div>
          <DemoCompareChart demos={demos} dimLabels={subLabels} />
        </section>
      </div>

      {methodCard}
    </div>
  );
}

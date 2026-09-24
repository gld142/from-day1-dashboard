"use client";

/**
 * /discovery — le potentiel des inédits avant la sortie. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Les quatre sous-scores du meilleur inédit s'affichaient trois fois sur la
 * même page : dans le podium, dans sa ligne de la liste, et dans le graphique
 * de comparaison. Ils ne restent qu'au podium — qui les explique — et dans la
 * comparaison, qui les met face aux autres. La liste garde le score global et
 * le rang, et renvoie à la comparaison pour le détail.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  AudioLines,
  History,
  Loader,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
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
  const tc = useTranslations("common");
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

  /* Démos "en analyse…" ajoutées via le Dialog (state local, démo produit).
     Le changement d'artiste vide la file : un ajustement d'état au rendu, et
     non un effet — un `setState` synchrone dans un effet déclenche un second
     rendu en cascade (react-hooks/set-state-in-effect). */
  const [pending, setPending] = useState<string[]>([]);
  const [pendingFor, setPendingFor] = useState(artistId);
  if (pendingFor !== artistId) {
    setPendingFor(artistId);
    setPending([]);
  }

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

  const methodDetails = (
    <Sheet family="trends">
      <details className="text-[11.5px] leading-relaxed">
        <summary className="sheet-ink cursor-pointer font-medium">
          {t("method.title")}
        </summary>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          {t("method.description")}
        </p>
        <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-3">
          {methodItems.map(({ key, icon: Icon }) => (
            <div key={key}>
              <p className="flex items-center gap-2 text-[12px] font-semibold">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {t(`method.${key}.title`)}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {t(`method.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </details>
    </Sheet>
  );

  const doors = (
    <Doors
      title={tc("blocks.doors")}
      doors={[
        { key: "catalog", family: "catalog", href: "/catalog", label: t("doors.catalog"), value: t("doors.catalogValue") },
        { key: "market", family: "trends", href: "/market", label: t("doors.market"), value: t("doors.marketValue") },
        { key: "algo", family: "trends", href: "/algo-position", label: t("doors.algo"), value: t("doors.algoValue") },
        { key: "streams", family: "streams", href: "/streams", label: t("doors.streams"), value: t("doors.streamsValue") },
        { key: "audience", family: "audience", href: "/audience", label: t("doors.audience"), value: t("doors.audienceValue") },
        { key: "sync", family: "money", href: "/sync", label: t("doors.sync"), value: t("doors.syncValue") },
      ]}
    />
  );

  const legend = (
    <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
  );

  if (aggregated) {
    return (
      <div className="rise-in">
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

        <div className="space-y-3">
          <Sheet family="trends">
            <SheetHeading action={t("rosterView.hint")}>
              {t("rosterView.title")}
            </SheetHeading>
            <p className="sheet-ink mt-0.5 text-[11.5px]">
              {t("rosterView.description")}
            </p>
            <div className="mt-2 flex flex-col">
              {rosterBest.map(({ artist: a, demo }) => (
                <button
                  key={a.id}
                  onClick={() => setFocusedArtistId(a.id)}
                  className="border-border/50 group flex items-center gap-3 border-t py-2.5 text-left transition-colors first:border-t-0 hover:bg-[color-mix(in_oklab,var(--sheet-line)_8%,transparent)]"
                >
                  <ArtistBadge
                    artist={a}
                    size="md"
                    meta={a.genre}
                    className="hidden w-44 shrink-0 sm:flex"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {demo.title}
                    </span>
                    <DemoMeta demo={demo} bpmLabel={t("list.bpm")} />
                  </span>
                  <div className="hidden w-28 shrink-0 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_16%,transparent)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${demo.score}%`,
                          background: "var(--sheet-line)",
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {demo.score}
                    <span className="sheet-ink text-[11px] font-normal">/100</span>
                  </span>
                  <span className="hidden md:block">
                    <TierBadge
                      tier={demoTier(demo)}
                      label={t(`tiers.${demoTier(demo)}`)}
                    />
                  </span>
                  <ArrowRight
                    className="sheet-ink hidden size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 sm:block"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </Sheet>

          {methodDetails}
          {doors}
          {legend}
        </div>
      </div>
    );
  }

  /* ─── Vue artiste : le lab complet ─── */
  const weakest = DEMO_SUB_KEYS.reduce((w, k) =>
    best.sub[k] < best.sub[w] ? k : w,
  );

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {isLabel && <ArtistBadge artist={artist} meta={artist.genre} />}
        <UploadDemoDialog onAdd={(title) => setPending((p) => [...p, title])} />
      </PageHeader>

      <div className="space-y-3">
        {/* Le meilleur inédit, et pourquoi c'est lui. */}
        <Sheet family="trends">
          <SheetHeading action={t("podium.kicker")}>{t("hero.title")}</SheetHeading>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div>
              <p className="flex items-baseline gap-2">
                <span className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
                  {best.score}
                </span>
                <span className="sheet-ink text-sm tabular-nums">
                  {t("hero.of100")}
                </span>
              </p>
              <p className="mt-1.5 text-[15px] font-semibold">{best.title}</p>
              <div className="mt-0.5">
                <DemoMeta demo={best} bpmLabel={t("list.bpm")} />
              </div>
              <p className="sheet-ink mt-2 max-w-xl text-[12.5px] leading-relaxed">
                {t("podium.reason", {
                  hook: fmtInt(locale, best.sub.hook),
                  tiktok: fmtInt(locale, best.sub.tiktok),
                  playlist: fmtInt(locale, best.sub.playlist),
                })}
              </p>
            </div>

            {/* Les quatre dimensions du meilleur : elles ne se répètent plus
                ni dans la liste, ni ailleurs. */}
            <div className="flex flex-col justify-center gap-2.5">
              {DEMO_SUB_KEYS.map((k, i) => (
                <div key={k}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="sheet-ink text-xs font-medium">
                      {subLabels[k]}
                    </span>
                    <span className="text-xs font-semibold tabular-nums">
                      {best.sub[k]}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_16%,transparent)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${best.sub[k]}%`, background: demoColor(i) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AffiliatedPoints
            points={[
              {
                key: "count",
                value: fmtInt(locale, demos.length + pending.length),
                label: t("kpis.demos"),
              },
              {
                key: "avg",
                value: fmtInt(locale, avgScore),
                label: t("kpis.avg"),
                note: t("kpis.avgHint", { count: demos.length }),
              },
              {
                key: "estimate",
                value: fmtCompact(locale, estimate),
                label: t("kpis.firstWeek"),
                note: t("kpis.firstWeekHint"),
              },
              {
                key: "weakest",
                value: subLabels[weakest],
                label: t("kpis.weakest"),
                note: t("kpis.weakestHint", { value: fmtInt(locale, best.sub[weakest]) }),
              },
            ]}
          />
        </Sheet>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* La liste : rang, titre, score. Le détail est en face. */}
          <Sheet family="trends">
            <SheetHeading action={t("list.hint")}>{t("list.title")}</SheetHeading>
            <div className="mt-1 flex flex-col">
              {pending.map((title, i) => (
                <div
                  key={`pending-${i}`}
                  className="border-border/50 flex items-center gap-3 border-t py-2.5 first:border-t-0"
                >
                  <Loader className="sheet-ink size-4 shrink-0 animate-spin" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{title}</span>
                    <span className="sheet-ink text-[11px]">{t("list.analyzing")}</span>
                  </span>
                  <Badge variant="outline" className="rounded-full">
                    {t("list.analyzingBadge")}
                  </Badge>
                </div>
              ))}
              {demos.map((d, i) => {
                const tier = demoTier(d);
                return (
                  <div
                    key={d.id}
                    className="border-border/50 flex items-center gap-3 border-t py-2.5 first:border-t-0"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: demoColor(i) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {d.title}
                      </span>
                      <DemoMeta demo={d} bpmLabel={t("list.bpm")} />
                    </span>
                    <TierBadge tier={tier} label={t(`tiers.${tier}`)} />
                    <span className="w-12 shrink-0 text-right text-lg font-semibold tabular-nums">
                      {d.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </Sheet>

          {/* Les quatre dimensions, tous inédits confondus. */}
          <Sheet family="trends">
            <SheetHeading action={t("compare.description")}>
              {t("compare.title")}
            </SheetHeading>
            <div className="mt-1 mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {demos.map((d, i) => (
                <span key={d.id} className="sheet-ink flex items-center gap-1.5 text-[11px]">
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
          </Sheet>
        </div>

        {methodDetails}
        {doors}
        {legend}
      </div>
    </div>
  );
}

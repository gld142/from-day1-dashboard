"use client";

/**
 * Position algo & tendances — SIMULATION de démo.
 *
 * Ce que l'algorithme fait du titre ce matin, sur chaque plateforme (Spotify,
 * Apple, Deezer, YouTube) et sur les réseaux (TikTok, Instagram) : le son qui
 * a percé, quand, les 3 créateurs qui l'ont porté cette semaine, et ce que ça
 * a fait aux streams et aux ajouts. Tout est simulé (badge obligatoire) :
 * en production, ces lignes se relèvent (Soundcharts, comptes connectés).
 */
import { useLocale, useTranslations } from "next-intl";
import { Flame, Radar, Sparkles, Users } from "lucide-react";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { fmtCompact, fmtDate, fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type PlatformKey = "spotify" | "apple" | "deezer" | "youtube" | "tiktok" | "instagram";

type Placement = { platform: PlatformKey; surface: string; rank: number; delta: number };
type Creator = { handle: string; followers: number; videos: number; views: number };

type Scenario = {
  sound: string;
  brokeOn: string;
  brokeAt: string;
  videos: number;
  videosDelta: number;
  trendRankFr: number | null;
  creators: Creator[];
  streams7: number;
  streams14: number;
  savesSpotify: number;
  savesApple: number;
  playlistAdds: number;
  placements: Placement[];
};

/** Un scénario par artiste réel, calibré sur leur taille d'audience. */
const SCENARIOS: Record<string, Scenario> = {
  dadju: {
    sound: "Reine",
    brokeOn: "2026-09-04",
    brokeAt: "19:40",
    videos: 48_200,
    videosDelta: 3_100,
    trendRankFr: 4,
    creators: [
      { handle: "@lea.mkp", followers: 2_100_000, videos: 1, views: 4_800_000 },
      { handle: "@yassine.danse", followers: 860_000, videos: 3, views: 2_900_000 },
      { handle: "@maelys.off", followers: 410_000, videos: 2, views: 1_600_000 },
    ],
    streams7: 18,
    streams14: 31,
    savesSpotify: 12_400,
    savesApple: 3_200,
    playlistAdds: 6,
    placements: [
      { platform: "spotify", surface: "Top 50 France", rank: 23, delta: 9 },
      { platform: "apple", surface: "Top 100 France", rank: 31, delta: 12 },
      { platform: "deezer", surface: "Top France", rank: 27, delta: 6 },
      { platform: "youtube", surface: "Tendances musique FR", rank: 14, delta: 5 },
      { platform: "tiktok", surface: "Sons en tendance FR", rank: 4, delta: 21 },
      { platform: "instagram", surface: "Audios Reels FR", rank: 7, delta: 11 },
    ],
  },
  "nono-la-grinta": {
    sound: "LOVE YOU",
    brokeOn: "2026-09-08",
    brokeAt: "22:15",
    videos: 71_500,
    videosDelta: 5_400,
    trendRankFr: 2,
    creators: [
      { handle: "@inesbcn", followers: 3_400_000, videos: 2, views: 9_100_000 },
      { handle: "@rayane.fit", followers: 1_200_000, videos: 1, views: 3_700_000 },
      { handle: "@la.team.93", followers: 690_000, videos: 4, views: 2_200_000 },
    ],
    streams7: 27,
    streams14: 44,
    savesSpotify: 19_800,
    savesApple: 4_900,
    playlistAdds: 9,
    placements: [
      { platform: "spotify", surface: "Top 50 France", rank: 11, delta: 17 },
      { platform: "apple", surface: "Top 100 France", rank: 19, delta: 22 },
      { platform: "deezer", surface: "Top France", rank: 15, delta: 10 },
      { platform: "youtube", surface: "Tendances musique FR", rank: 8, delta: 9 },
      { platform: "tiktok", surface: "Sons en tendance FR", rank: 2, delta: 38 },
      { platform: "instagram", surface: "Audios Reels FR", rank: 3, delta: 15 },
    ],
  },
  kiko: {
    sound: "Golden Boy",
    brokeOn: "2026-09-12",
    brokeAt: "20:05",
    videos: 640,
    videosDelta: 85,
    trendRankFr: null,
    creators: [
      { handle: "@afrovibes.lome", followers: 92_000, videos: 2, views: 310_000 },
      { handle: "@kossi.dance", followers: 38_000, videos: 1, views: 120_000 },
      { handle: "@togo.trend", followers: 21_000, videos: 3, views: 74_000 },
    ],
    streams7: 9,
    streams14: 14,
    savesSpotify: 260,
    savesApple: 40,
    playlistAdds: 1,
    placements: [
      { platform: "spotify", surface: "Viral 50 Togo", rank: 38, delta: 4 },
      { platform: "apple", surface: "Top 100 Togo", rank: 71, delta: 3 },
      { platform: "deezer", surface: "Top Togo", rank: 44, delta: 2 },
      { platform: "youtube", surface: "Tendances musique TG", rank: 26, delta: 6 },
      { platform: "tiktok", surface: "Sons en tendance TG", rank: 17, delta: 12 },
      { platform: "instagram", surface: "Audios Reels TG", rank: 24, delta: 8 },
    ],
  },
};

function signed(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: "always" }).format(n);
}

export function AlgoTrendPanel({ artistId, artistName, className }: { artistId: string; artistName: string; className?: string }) {
  const t = useTranslations("pulse.algo");
  const locale = useLocale();
  const s = SCENARIOS[artistId] ?? SCENARIOS.kiko;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-heading text-base font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle", { name: artistName })}</p>
        <ProvenanceBadge provenance="simulated" className="ml-auto" />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {/* Position algo par plateforme */}
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Radar className="size-3.5" aria-hidden />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("platforms")}</span>
          </div>
          <ul className="divide-y">
            {s.placements.map((p) => (
              <li key={p.platform} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 font-medium">{t(`platform.${p.platform}`)}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.surface}</span>
                <span className="font-heading text-base font-semibold tabular-nums">{t("rank", { rank: p.rank })}</span>
                <span className="w-12 text-right text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                  {signed(locale, p.delta)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t("deltaNote")}</p>
        </div>

        {/* Le son qui a percé */}
        <div className="rounded-xl border bg-card p-4 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Flame className="size-3.5" aria-hidden />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("breakout.kicker")}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading text-2xl font-semibold tracking-tight">« {s.sound} »</span>
            <span className="text-sm text-muted-foreground">
              {t("breakout.since", { date: fmtDate(locale, s.brokeOn, { day: "numeric", month: "long" }), time: s.brokeAt })}
            </span>
          </div>
          <p className="mt-1 text-sm">
            {t("breakout.videos", { videos: fmtCompact(locale, s.videos), delta: signed(locale, s.videosDelta) })}
            {" · "}
            {s.trendRankFr !== null ? t("breakout.trend", { rank: s.trendRankFr }) : t("breakout.noTrend")}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Users className="size-3.5" aria-hidden />
                {t("creators.title")}
              </div>
              <ol className="space-y-1.5">
                {s.creators.map((c, i) => (
                  <li key={c.handle} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="font-medium">{c.handle}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {t("creators.line", { followers: fmtCompact(locale, c.followers), videos: c.videos, views: fmtCompact(locale, c.views) })}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" aria-hidden />
                {t("impact.title")}
              </div>
              <dl className="space-y-1.5 text-sm">
                {[
                  [t("impact.streams7"), fmtPct(locale, s.streams7, 0)],
                  [t("impact.streams14"), fmtPct(locale, s.streams14, 0)],
                  [t("impact.saves"), fmtInt(locale, s.savesSpotify)],
                  [t("impact.savesApple"), fmtInt(locale, s.savesApple)],
                  [t("impact.playlists"), fmtInt(locale, s.playlistAdds)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
